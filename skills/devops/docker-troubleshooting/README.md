# Docker Troubleshooting

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Systematic Docker debugging for container failures, build errors, network issues, and volume problems.

## What It Does

This skill guides you through methodical Docker troubleshooting using a structured debugging loop:

1. Identify the symptom (what's broken)
2. Gather evidence (logs, inspect output, events)
3. Form a hypothesis (likely cause)
4. Test the hypothesis (minimal change)
5. Fix and verify (apply fix, confirm it works)

Covers the most common Docker failure modes: containers that won't start, build failures, network isolation, volume permissions, and Docker Compose issues.

## When to Use

Use this skill when:

- **Container won't start**: exits immediately, shows `Exited (1)` or `Restarting` status
- **Build fails**: `docker build` fails partway through with cryptic errors
- **Network broken**: containers can't reach each other or the internet
- **Volume issues**: permission denied errors when accessing mounted volumes
- **Compose failures**: services in docker-compose.yml fail to start or connect
- **App misbehaves**: container runs but app inside returns errors or fails health checks

## Quick Start: Debugging a CrashLoopBackOff

A container that keeps restarting is usually failing fast. Here's the fastest path to diagnosis:

```bash
# Step 1: Check the exit code and status
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Command}}' --no-trunc

# Step 2: Read the logs
docker logs mycontainer --tail 100

# Step 3: Check the last state for details
docker inspect mycontainer --format '{{json .State}}' | jq

# Common exit codes:
# 1 = application error
# 127 = command not found
# 137 = killed (OOM or SIGKILL)
# 139 = segfault
```

If logs are empty or unhelpful, override the entrypoint to get a shell:

```bash
# Get a shell inside the image
docker run --rm -it --entrypoint /bin/sh myimage

# Manually run the command to see the error
/app/server

# Check the environment and filesystem
env | sort
ls -la /app
```

Most CrashLoopBackOff issues are:
- Wrong CMD/ENTRYPOINT (command not found)
- Missing environment variable the app needs at startup
- Port already in use on the host
- Volume mount permission denied

## Key Concepts

### The Debugging Loop

Always follow this sequence:

1. **Symptom**: What does `docker ps -a` show? What's the exit code?
2. **Evidence**: Run `docker logs` and `docker inspect` before changing anything
3. **Hypothesis**: Based on the evidence, what's the likely cause?
4. **Test**: Make one minimal change and verify
5. **Verify**: Did it fix the problem? If not, revert and try again

### The Logs/Exec/Inspect Trinity

Three commands solve 90% of Docker issues:

```bash
# 1. Logs: what did the app say before it died?
docker logs <container> --tail 100

# 2. Exec: get a shell and poke around
docker exec -it <container> /bin/sh

# 3. Inspect: see everything Docker knows about the container
docker inspect <container> | jq
```

Use them in that order. Logs show symptoms, exec lets you test hypotheses, inspect reveals hidden config.

### Exit Codes Matter

Don't ignore exit codes. Each one has specific meaning:

- `0` = clean exit
- `1` = application error (check logs)
- `125` = docker daemon error
- `126` = command not executable (check permissions/shebang)
- `127` = command not found (check PATH, typos in CMD/ENTRYPOINT)
- `137` = killed by SIGKILL (usually OOM, check `docker stats`)
- `139` = segfault (app crashed)
- `143` = SIGTERM (container was stopped gracefully)

### Override Entrypoint to Explore

When a container won't stay up long enough to `docker exec` into it:

```bash
# Start the container with a shell instead of the app
docker run --rm -it --entrypoint /bin/sh <image>

# Now you can explore the filesystem and run commands manually
ls -la /app
env | grep DATABASE
/app/server  # run the real command to see the error
```

### Network Debugging

Containers on different networks can't reach each other. Always use custom networks for multi-container apps:

```bash
# Create a custom network
docker network create mynet

# Run containers on the same network
docker run --network mynet --name web nginx
docker run --network mynet --name app myapp

# Now "app" can reach "web" via DNS
docker exec app curl http://web:80
```

Use container names, not IP addresses. Docker's built-in DNS resolves names to IPs automatically.

### Volume Permissions

The most common volume issue: host directory owned by root, container runs as non-root user.

```bash
# Check what user the container runs as
docker exec <container> id

# Check ownership of the mount
docker exec <container> ls -la /app/data

# Fix ownership on the host
sudo chown -R 1000:1000 /host/path
```

Or use named volumes and let Docker manage permissions:

```bash
docker volume create mydata
docker run -v mydata:/app/data <image>
```

## Common Pitfalls

### Ignoring Exit Codes

Don't just see "container exited" and start guessing. Check the exit code first:

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}'
```

Exit code 137 means OOM (add memory), 127 means command not found (typo in Dockerfile).

### Build Cache Confusion

Docker caches layers. If you change a file but the build seems to skip it:

```bash
# Force rebuild without cache
docker build --no-cache -t myapp .
```

But don't disable cache by default. It's there for a reason (speed).

### Editing Running Containers

Files changed inside a running container vanish on restart. Always make changes in the Dockerfile, rebuild, and restart.

```bash
# Wrong:
docker exec mycontainer vi /app/config.json  # vanishes on restart

# Right:
# Edit config.json on host, rebuild image, restart container
```

### Using `docker attach` Instead of `docker exec`

`docker attach` hijacks the container's stdout. You can't run commands. Use `docker exec` instead:

```bash
# Wrong:
docker attach mycontainer  # just shows logs, can't run commands

# Right:
docker exec -it mycontainer /bin/sh  # gives you a shell
```

### Localhost Confusion

Inside a container, `localhost` means the container itself, not the host.

To reach the host from a container:
- Mac/Windows: use `host.docker.internal`
- Linux: use the host's actual IP (172.17.0.1 on default bridge) or run with `--network host`

```bash
# Wrong (inside container):
curl http://localhost:5432  # tries to reach container's own port 5432

# Right:
curl http://host.docker.internal:5432  # reaches host's port 5432
```

### Running `docker system prune -a` in Production

This deletes ALL unused images, containers, networks, and build cache. On a production server, it can break things.

```bash
# Safe: remove only stopped containers and dangling images
docker system prune

# Dangerous on prod:
docker system prune -a  # deletes even tagged images not currently running
```

### Assuming `depends_on` Waits for Readiness

Docker Compose `depends_on` only waits for the container to start, not for the app inside to be ready.

```yaml
# This does NOT guarantee postgres is ready to accept connections
services:
  web:
    depends_on:
      - db
```

Your app needs retry logic or a wait script:

```bash
# In your entrypoint:
until pg_isready -h db; do
  echo "Waiting for postgres..."
  sleep 1
done
```

## Common Scenarios and Fixes

### Container Exits Immediately

```bash
docker logs <container> --tail 100
docker inspect <container> --format '{{.State.ExitCode}}'
```

Most common causes:
- Command not found (exit 127): typo in CMD/ENTRYPOINT
- Application error (exit 1): missing env var, bad config
- OOM killed (exit 137): add `--memory 2g`

### Build Fails with "COPY failed"

```bash
# Check what's in your build context
docker build --progress=plain -t myapp . 2>&1 | tee build.log
```

File doesn't exist in the context. Check your `.dockerignore` and make sure the file is in the same directory or below.

### Network Timeout During Build

```bash
# Retry with longer timeout
docker build --network host -t myapp .
```

Or add retries to your RUN commands:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends curl || \
    (sleep 5 && apt-get update && apt-get install -y --no-install-recommends curl)
```

### Volume Mounts Permission Denied

```bash
# Check ownership
docker exec <container> ls -la /app/data

# Fix ownership on host
sudo chown -R $(id -u):$(id -g) /host/path
```

### Containers Can't Reach Each Other

```bash
# Check networks
docker network inspect bridge
docker network inspect <custom-network>

# Put them on the same network
docker network create mynet
docker network connect mynet <container1>
docker network connect mynet <container2>
```

## Debugging Tools

### Get Full Build Output

```bash
docker build --progress=plain -t myapp . 2>&1 | tee build.log
```

### Inspect a Failed Build Layer

```bash
docker build -t myapp . || true
docker images --filter "dangling=true"
docker run --rm -it <dangling-image-id> /bin/sh
```

### Debug Networking from Inside a Container

```bash
# Install tools in a running container
docker exec -it <container> sh
apk add curl  # Alpine
apt-get update && apt-get install -y curl  # Debian/Ubuntu

# Or use a debug sidecar
docker run --rm -it --network container:<app-container> nicolaka/netshoot
```

### Check Resource Usage

```bash
docker stats <container>
docker system df
```

### See What Changed in a Running Container

```bash
docker diff <container>
# A = added, C = changed, D = deleted
```

## See Also

- [Docker CLI reference](https://docs.docker.com/engine/reference/commandline/cli/)
- [Docker Compose troubleshooting](https://docs.docker.com/compose/faq/)
- [Dockerfile best practices](https://docs.docker.com/develop/dev-best-practices/)
- `docker-compose.yml` reference for service dependencies and health checks
- Container logging drivers and centralized logging for production debugging
