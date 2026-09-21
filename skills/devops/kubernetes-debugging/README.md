# kubernetes-debugging

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A systematic kubectl workflow for diagnosing pods that will not start, stay Pending, crash in a loop, or cannot reach the network.

## What it does

The skill encodes a fixed diagnostic path so you stop guessing and start reading what the cluster already told you:

1. Read pod status (`kubectl get pod`) to classify the failure.
2. Read the Events section of `kubectl describe pod`, which usually names the cause outright.
3. Pull logs from the crashed container with `--previous`, not the current one.
4. Check the exit code in "Last State" (137 is OOMKilled, 1 is an app error, 127 is command not found).
5. Compare resource requests against node capacity when scheduling fails.
6. Test Service endpoints, DNS, and pod-to-pod connectivity from inside a debug pod.
7. Inspect mounted config, env vars, and live filesystem via `kubectl exec` or an ephemeral container.

It covers the five failure modes that account for most incidents (CrashLoopBackOff, Pending, ImagePullBackOff, OOMKilled, Evicted), plus Service and DNS failures, NotReady nodes, and advanced tooling such as `kubectl debug` with `nicolaka/netshoot` and in-pod `tcpdump` capture.

## When to use this

Use it when:

- A pod is Pending, CrashLoopBackOff, ImagePullBackOff, or Evicted.
- Pods cannot reach each other or an external service.
- DNS resolution fails inside pods (`nslookup` of a `.svc.cluster.local` name returns nothing).
- A node shows NotReady, MemoryPressure, or DiskPressure.
- You need to inspect a running pod's filesystem or capture its network traffic.

Skip it when:

- The bug is application logic and reproduces outside Kubernetes.
- You are authoring manifests from scratch rather than debugging running ones.
- The problem is cluster bootstrap or CNI plugin level.

## Quick start

A real session: the `checkout` deployment in `production` went to 0/3 ready after a release.

```bash
# 1. Classify the failure
kubectl get pods -n production -l app=checkout
# NAME                        READY   STATUS             RESTARTS   AGE
# checkout-7d9f5c6b4-2xlqp    0/1     CrashLoopBackOff   6          9m
# checkout-7d9f5c6b4-8vkzn    0/1     CrashLoopBackOff   6          9m
# checkout-7d9f5c6b4-mp4rt    0/1     Pending            0          9m
```

Two different symptoms, so two different investigations.

```bash
# 2. Events first, always
kubectl describe pod checkout-7d9f5c6b4-2xlqp -n production | tail -20
# Events:
#   Normal   Pulled     9m    kubelet  Successfully pulled image "reg.internal/checkout:v2.4.0"
#   Warning  Unhealthy  8m    kubelet  Liveness probe failed: Get "http://10.1.4.22:8080/health": dial tcp: connect: connection refused
#   Warning  BackOff    2m    kubelet  Back-off restarting failed container
```

```bash
# 3. Logs from the container that actually died
kubectl logs checkout-7d9f5c6b4-2xlqp -n production --previous | tail -5
# 2026-09-22T10:14:02Z INFO  loading schema cache (takes ~45s on cold start)
# 2026-09-22T10:14:41Z INFO  schema cache 82% complete
# (no error, the process was killed mid-startup)
```

```bash
# 4. Confirm with the exit code
kubectl describe pod checkout-7d9f5c6b4-2xlqp -n production | grep -A5 "Last State"
# Last State:     Terminated
#   Reason:       Error
#   Exit Code:    143        <- SIGTERM, the kubelet killed it
```

Exit code 143 plus a failing liveness probe at 8 minutes means the probe is killing a
healthy but slow-starting app. The app needs about 50 seconds; the probe allows 10.

```yaml
# Fix: let a startupProbe cover the cold start, then hand off to liveness
livenessProbe:
  httpGet: { path: /health, port: 8080 }
  periodSeconds: 5
startupProbe:
  httpGet: { path: /health, port: 8080 }
  periodSeconds: 5
  failureThreshold: 18   # 18 * 5s = 90s budget, comfortably over the 50s cold start
```

Now the third pod, stuck Pending:

```bash
kubectl describe pod checkout-7d9f5c6b4-mp4rt -n production | grep -A4 Events
# Events:
#   Warning  FailedScheduling  9m  default-scheduler
#     0/4 nodes are available: 3 Insufficient cpu, 1 node(s) had untolerated taint {node-role: infra}
```

```bash
# What is actually free?
kubectl describe nodes | grep -A6 "Allocated resources"
#   Resource   Requests      Limits
#   cpu        3400m (85%)   6000m
#   memory     9Gi (76%)     14Gi

kubectl get pod checkout-7d9f5c6b4-mp4rt -n production -o jsonpath='{.spec.containers[0].resources}'
# {"requests":{"cpu":"1500m","memory":"512Mi"},"limits":{"cpu":"2","memory":"1Gi"}}
```

A 1500m request cannot fit on a node with roughly 600m free. Measure real usage before
guessing at a smaller number:

```bash
kubectl top pods -n production -l app=checkout
# NAME                       CPU(cores)   MEMORY(bytes)
# checkout-7d9f5c6b4-2xlqp   180m         340Mi
```

```yaml
# Request what the app uses, limit where you want it throttled
resources:
  requests:
    cpu: 250m        # was 1500m
    memory: 384Mi
  limits:
    cpu: 1
    memory: 768Mi
```

After the rollout, verify end to end rather than trusting the pod list alone:

```bash
kubectl rollout status deployment/checkout -n production
# deployment "checkout" successfully rolled out

kubectl get endpoints checkout -n production
# NAME       ENDPOINTS                                         AGE
# checkout   10.1.4.31:8080,10.1.5.12:8080,10.1.6.7:8080       41m

kubectl run netcheck --rm -it --image=busybox -n production --restart=Never -- \
  wget -qO- http://checkout.production.svc.cluster.local:8080/health
# {"status":"ok","schema_cache":"ready"}
```

Three endpoints listed and a 200 from the Service DNS name: the incident is closed.

## Key concepts

**Events are the primary source.** The scheduler, kubelet, and controllers all write to the
Events section of `kubectl describe pod`. "Insufficient cpu", "untolerated taint",
"pull access denied", and "Liveness probe failed" are verbatim answers, not hints.

**Previous logs versus current logs.** In CrashLoopBackOff the current container is either
empty or a fresh attempt. `kubectl logs --previous` shows the run that actually failed.

**Exit codes are a lookup table.** 137 means OOMKilled (the cgroup limit was hit),
143 means SIGTERM (usually a probe or eviction), 1 is an application error, 126 means the
entrypoint is not executable, and 127 means it does not exist in the image.

**Requests schedule, limits throttle and kill.** The scheduler only ever looks at `requests`
when placing a pod, so an inflated request causes Pending on a nearly idle cluster.
`limits` are what the kernel enforces at runtime, so a low memory limit causes OOMKilled.

**Services match by label, not by name.** A Service with a selector that matches nothing
still exists, still resolves in DNS, and still returns connection timeouts. An empty
`kubectl get endpoints` output is the tell.

**Probes have three distinct jobs.** `startupProbe` protects slow boots, `livenessProbe`
restarts a wedged process, and `readinessProbe` gates traffic. Using liveness to do
startup's job restarts a healthy app forever.

**Ephemeral containers beat rebuilt images.** `kubectl debug --target=<container>` joins the
pod's namespaces, so a distroless image with no shell can still be inspected with
busybox or `nicolaka/netshoot` (which carries `dig`, `curl`, and `tcpdump`).

## Common pitfalls

**Reading the wrong logs in a crash loop**

```bash
# Bad: the current container has barely started, output is empty or misleading
kubectl logs checkout-7d9f5c6b4-2xlqp -n production

# Good: read the container that actually died
kubectl logs checkout-7d9f5c6b4-2xlqp -n production --previous
```

**Deleting the pod instead of diagnosing it**

```bash
# Bad: the ReplicaSet recreates it and it fails identically, root cause untouched
kubectl delete pod checkout-7d9f5c6b4-2xlqp -n production

# Good: capture evidence first, then change the spec that caused the failure
kubectl describe pod checkout-7d9f5c6b4-2xlqp -n production > /tmp/evidence.txt
kubectl logs checkout-7d9f5c6b4-2xlqp -n production --previous >> /tmp/evidence.txt
```

**A liveness probe with no startup allowance**

```yaml
# Bad: app needs 50s to warm its cache, probe starts failing at 0s
livenessProbe:
  httpGet: { path: /health, port: 8080 }
  periodSeconds: 5

# Good: a startupProbe grants a bounded warm-up window before liveness applies
startupProbe:
  httpGet: { path: /health, port: 8080 }
  periodSeconds: 5
  failureThreshold: 18
livenessProbe:
  httpGet: { path: /health, port: 8080 }
  periodSeconds: 5
```

**Raising the memory limit to silence an OOM**

```yaml
# Bad: doubles the limit every incident and hides a genuine leak
resources:
  limits:
    memory: 4Gi   # was 2Gi, was 1Gi, was 512Mi
```

```bash
# Good: raise it once to stop the bleeding, then capture the heap and find the leak
kubectl exec checkout-7d9f5c6b4-2xlqp -n production -- \
  jmap -dump:format=b,file=/tmp/heap.hprof 1
kubectl cp production/checkout-7d9f5c6b4-2xlqp:/tmp/heap.hprof ./heap.hprof
```

**Hardcoding a ClusterIP because DNS "seems broken"**

```yaml
# Bad: the IP changes the moment the Service is recreated
env:
  - name: CHECKOUT_URL
    value: "http://10.96.4.17:8080"

# Good: use the stable DNS name and fix DNS if it is genuinely failing
env:
  - name: CHECKOUT_URL
    value: "http://checkout.production.svc.cluster.local:8080"
```

```bash
# Verify cluster DNS rather than working around it
kubectl run dnscheck --rm -it --image=busybox --restart=Never -- \
  nslookup kubernetes.default.svc.cluster.local
kubectl logs -n kube-system -l k8s-app=kube-dns --tail 100
```

**Patching a live Deployment and losing the change**

```bash
# Bad: works until the next CI deploy silently reverts it
kubectl edit deployment checkout -n production

# Good: change the manifest in the repo, apply from there, confirm the rollout
kubectl apply -f k8s/production/checkout-deployment.yaml
kubectl rollout status deployment/checkout -n production
```

## See also

- [`../docker-troubleshooting/`](../docker-troubleshooting/) for image build failures,
  entrypoint problems, and container runtime issues that surface as ImagePullBackOff or
  exit code 126/127 inside Kubernetes.
- [`../ci-cd-debugging/`](../ci-cd-debugging/) for failures in the pipeline that builds and
  deploys these manifests, including rollouts that never reach the cluster.
