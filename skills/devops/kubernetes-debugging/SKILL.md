---
name: kubernetes-debugging
description: Use when a pod won't start, stays pending, or crashes. Systematic kubectl debugging.
---

Debug Kubernetes by reading the pod's status and events first, then drilling into logs, resource constraints, networking, and configuration. Work from symptoms to root cause.

## The diagnostic path

1. **Check pod status** - Pending? CrashLoopBackOff? ImagePullBackOff?
2. **Read events** - `kubectl describe pod` shows what Kubernetes tried
3. **Check logs** - current and previous containers
4. **Verify resources** - CPU/memory requests vs node capacity
5. **Test networking** - can pods reach each other? DNS working?
6. **Inspect config** - env vars, secrets, mounts

## Common pod issues

### CrashLoopBackOff

**Symptom:** Pod starts, exits, Kubernetes restarts it with exponentially increasing backoff

```bash
# Step 1: Check current status
kubectl get pod myapp-abc123 -n production
# NAME           READY   STATUS             RESTARTS   AGE
# myapp-abc123   0/1     CrashLoopBackOff   8          12m

# Step 2: Read events (often tells you everything)
kubectl describe pod myapp-abc123 -n production
# Look for Events at the bottom:
#   Warning  BackOff  2m  kubelet  Back-off restarting failed container

# Step 3: Get logs from the PREVIOUS crash (more useful than current)
kubectl logs myapp-abc123 -n production --previous

# Step 4: Check the exit code
kubectl describe pod myapp-abc123 -n production | grep -A5 "Last State"
# Last State: Terminated
#   Reason: Error
#   Exit Code: 137  <- OOMKilled (out of memory)
#   Exit Code: 1    <- Application error
#   Exit Code: 2    <- Misuse of shell builtin
#   Exit Code: 126  <- Command not executable
#   Exit Code: 127  <- Command not found
```

**Common causes:**
- Application crashes on startup (wrong config, missing env var, can't connect to DB)
- OOMKilled (exit code 137) - memory limit too low
- Liveness probe kills the container before it finishes starting
- Wrong command or entrypoint

**Fix for slow-starting apps:**
```yaml
# Add a startupProbe (Kubernetes waits longer before liveness kicks in)
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
startupProbe:  # Waits up to 60s for first success
  httpGet:
    path: /health
    port: 8080
  failureThreshold: 12  # 12 * 5s = 60s max startup time
  periodSeconds: 5
```

**Debug with an ephemeral container:**
```bash
# Attach a debug container (shares the pod's network/filesystem)
kubectl debug -it myapp-abc123 --image=busybox --target=myapp -n production

# Inside the debug container:
cat /app/config.yaml  # Check if config is mounted correctly
env | sort  # Check env vars
wget -qO- http://localhost:8080/health  # Test the app endpoint
```

### Pending (won't schedule)

**Symptom:** Pod stuck in Pending, never starts

```bash
# Check why it's pending
kubectl describe pod myapp-abc123 -n production

# Common reasons in Events:
# "0/5 nodes are available: 2 Insufficient cpu, 3 had taints that the pod didn't tolerate"
# "pod has unbound immediate PersistentVolumeClaims"
# "0/5 nodes are available: 5 node(s) didn't match Pod's node affinity/selector"
```

**Fix: insufficient resources**
```bash
# Check node capacity
kubectl describe nodes | grep -A5 "Allocated resources"

# Lower the pod's resource requests
spec:
  containers:
  - name: myapp
    resources:
      requests:
        cpu: 100m      # was 1000m
        memory: 128Mi  # was 1Gi
```

**Fix: unbound PVC**
```bash
# Check PVCs
kubectl get pvc -n production
# NAME        STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS
# myapp-data  Pending   -        -          -              standard

# Either create a PV manually or fix the StorageClass
kubectl get storageclass
```

### ImagePullBackOff

**Symptom:** Kubernetes can't pull the container image

```bash
kubectl describe pod myapp-abc123 -n production | grep -A10 Events
# Events:
#   Warning  Failed  2m  kubelet  Failed to pull image "myregistry.com/myapp:v1.2.3": rpc error: code = Unknown desc = Error response from daemon: pull access denied
```

**Common causes:**
- Image name/tag wrong or doesn't exist
- Private registry requires authentication (missing imagePullSecrets)
- Registry is down or unreachable
- Docker Hub rate limit (100 pulls/6h for anonymous)

**Fix: add image pull secret**
```bash
# Create secret for private registry
kubectl create secret docker-registry regcred \
  --docker-server=myregistry.com \
  --docker-username=myuser \
  --docker-password=mypassword \
  --docker-email=my@email.com \
  -n production

# Reference in pod spec
spec:
  imagePullSecrets:
  - name: regcred
  containers:
  - name: myapp
    image: myregistry.com/myapp:v1.2.3
```

### OOMKilled (out of memory)

**Symptom:** Pod exits with code 137

```bash
# Confirm it's OOMKilled
kubectl describe pod myapp-abc123 -n production | grep -A5 "Last State"
# Last State: Terminated
#   Reason: OOMKilled
#   Exit Code: 137

# Check memory limit
kubectl get pod myapp-abc123 -n production -o yaml | grep -A5 resources
# resources:
#   limits:
#     memory: 128Mi  <- too low
```

**Fix: raise memory limit**
```yaml
resources:
  requests:
    memory: 256Mi
  limits:
    memory: 512Mi  # was 128Mi
```

**Better: profile the app to find the leak**
```bash
# For Java apps, get a heap dump before pod restarts
kubectl exec myapp-abc123 -n production -- jmap -dump:format=b,file=/tmp/heap.hprof 1
kubectl cp production/myapp-abc123:/tmp/heap.hprof ./heap.hprof
```

## Networking issues

### Service not reachable

**Symptom:** `curl http://myservice.production.svc.cluster.local` times out

```bash
# Step 1: Check if service has endpoints
kubectl get endpoints myservice -n production
# NAME        ENDPOINTS          AGE
# myservice   10.1.2.3:8080,...  5m

# If ENDPOINTS is empty, the service selector doesn't match any pods
kubectl get svc myservice -n production -o yaml | grep -A5 selector
kubectl get pods -n production --show-labels

# Fix: update selector or pod labels to match

# Step 2: Test DNS from inside a pod
kubectl run debug --rm -it --image=busybox -n production -- /bin/sh
# Inside:
nslookup myservice.production.svc.cluster.local
# Should return the service's ClusterIP

# Step 3: Test connectivity
wget -qO- http://myservice.production.svc.cluster.local:8080/health
```

**Common causes:**
- Service selector doesn't match pod labels
- Pod isn't listening on the port the service targets
- NetworkPolicy blocking traffic
- Pod crashed before becoming ready

### DNS resolution fails

```bash
# Test cluster DNS
kubectl run debug --rm -it --image=busybox -- nslookup kubernetes.default.svc.cluster.local

# If DNS fails, check CoreDNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns

# View CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns --tail 100
```

## Resource and node issues

### Pod evicted

**Symptom:** Pod status shows `Evicted`

```bash
kubectl get pods -A | grep Evicted

# Check why
kubectl describe pod myapp-abc123 -n production | grep -i evicted
# Reason: NodeLowOnMemory or NodeLowOnDisk
```

**Fix: free up node resources or add more nodes**

### Node not ready

```bash
# Check node status
kubectl get nodes
# NAME       STATUS     ROLES    AGE   VERSION
# worker-1   NotReady   <none>   5d    v1.25.0

# Describe the node
kubectl describe node worker-1 | grep -A10 Conditions
# Conditions:
#   Type             Status  Reason
#   ----             ------  ------
#   MemoryPressure   True    NodeHasSufficientMemory
#   DiskPressure     True    NodeHasNoDiskPressure

# SSH to the node and check:
# - disk space: df -h
# - kubelet logs: journalctl -u kubelet --since "1 hour ago"
```

## Advanced debugging

### Attach ephemeral debug container

```bash
# For minimal images without shell/curl/etc
kubectl debug -it myapp-abc123 --image=nicolaka/netshoot --target=myapp -n production
# Now you have tcpdump, curl, dig, etc. in the pod's network namespace
```

### Inspect live pod filesystem

```bash
kubectl exec -it myapp-abc123 -n production -- /bin/sh
# Or if no shell:
kubectl exec myapp-abc123 -n production -- ls -la /app
kubectl exec myapp-abc123 -n production -- cat /app/config.yaml
```

### Get resource usage

```bash
# Real-time CPU/memory
kubectl top pods -n production
kubectl top nodes

# Find top consumers
kubectl top pods -A --sort-by=memory | head -20
```

### Capture traffic with tcpdump

```bash
kubectl debug -it myapp-abc123 --image=nicolaka/netshoot --target=myapp -n production
# Inside:
tcpdump -i any -nn -s 0 -w /tmp/cap.pcap port 5432
# Copy out:
kubectl cp production/myapp-abc123:/tmp/cap.pcap ./cap.pcap -c debugger-xyz
# Open in Wireshark
```

## Debugging checklist

When a pod fails:

1. `kubectl get pod <name> -n <namespace>` - what's the status?
2. `kubectl describe pod <name> -n <namespace>` - read the Events
3. `kubectl logs <name> -n <namespace> --previous` - logs from last crash
4. Check exit code (describe output, "Last State")
5. Check resource limits (describe output, "Limits")
6. Check service endpoints if networking issue (`kubectl get endpoints`)
7. Test DNS and connectivity from inside a debug pod
8. Check node health (`kubectl get nodes`, `kubectl describe node`)

## Rules

1. **Events first.** `kubectl describe pod` Events section is where Kubernetes tells you what went wrong. Read it before anything else.

2. **Previous logs, not current.** For CrashLoopBackOff, use `--previous` to get logs from the container that crashed.

3. **Exit codes matter.** 137 = OOMKilled, 1 = app error, 127 = command not found. Don't ignore them.

4. **Service selectors must match pod labels exactly.** One typo and the service has zero endpoints.

5. **DNS names, not IPs.** Use `http://myservice.production.svc.cluster.local`, not `http://10.96.1.2`. IPs change.

6. **Probes kill slow-starting apps.** If your app takes 60s to start, set `initialDelaySeconds` or use a `startupProbe`.

7. **Resource requests determine scheduling.** If a pod is Pending, check if any node has enough CPU/memory to satisfy its requests.

## Anti-patterns

- ❌ Deleting and recreating pods to "fix" them (doesn't address root cause)
- ❌ Editing live deployments with `kubectl edit` and forgetting to commit to git
- ❌ Setting liveness probe with no `initialDelaySeconds` (kills the app before it starts)
- ❌ Using `latest` tag in production (pull policy issues, hard to debug "which version is this?")
- ❌ Running `kubectl logs` without `--previous` for a CrashLoopBackOff pod

## When to use this skill

Use this skill when:
- A pod is Pending, CrashLoopBackOff, ImagePullBackOff, or Evicted
- Pods can't reach each other or external services
- DNS resolution fails inside pods
- Nodes are NotReady or under pressure
- You need to inspect a running pod's filesystem or network traffic

Skip this skill when:
- The issue is application logic (not Kubernetes-specific)
- Writing manifests from scratch (different skill)
- Cluster setup or CNI plugin issues (platform-level)
