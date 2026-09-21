---
name: docker-troubleshooting
description: Use when a container won't start, build fails, or network/volume breaks. Systematic Docker debugging.
---

Diagnose Docker issues methodically: check the symptoms (container status, exit codes), read the evidence (logs, events, inspect), isolate the cause (image, network, volume, host), then fix and verify.

## The debugging loop

1. **Identify the symptom** - what's visibly broken?
2. **Gather evidence** - logs, inspect output, events
3. **Form a hypothesis** - likely cause based on evidence
4. **Test the hypothesis** - minimal change to confirm
5. **Fix and verify** - apply the fix, confirm it works

## Common issues and fixes

### Container won't start

**Symptom:** `docker ps -a` shows status `Exited (1)` or `Restarting`

```bash
# Step 1: Check exit code
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Command}}' --no-trunc

# Exit codes:
# 0 = clean exit
# 1 = application error
# 125 = docker daemon error
# 126 = command not executable
# 127 = command not found
# 137 = killed (OOM or SIGKILL)
# 139 = segfault
# 143 = SIGTERM

# Step 2: Read logs from the failed container
docker logs <container> --tail 100

# Step 3: Check the last state
docker inspect <container> --format '{{json .State}}' | jq

# Common causes:
# - Wrong CMD/ENTRYPOINT (command not found = exit 127)
# - Missing env var (app crashes on startup)
# - Port already in use
# - Volume mount permission denied
```

**Fix wrong ENTRYPOINT during debugging:**
```bash
# Override the entrypoint to get a shell
docker run --rm -it --entrypoint /bin/sh <image>

# Then manually run the app command to see the error
/app/server

# Or inspect the filesystem
ls -la /app
env | sort
```

### Image pull failures

**Symptom:** `docker pull` times out or returns 403/404

```bash
# Check the exact error
docker pull nginx:latest 2>&1

# Common causes:
# - Wrong image name or tag
# - Private registry needs login
# - Rate limit (Docker Hub anonymous: 100 pulls/6h)
# - Network/proxy issue

# Fix: login to private registry
docker login registry.example.com
# Or use a token
echo $TOKEN | docker login -u username --password-stdin

# Fix: bypass rate limit with auth
docker login  # even a free account gets 200 pulls/6h

# Check what images Docker thinks it has
docker images --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}'
```

### Volume permission errors

**Symptom:** Container starts but can't write to mounted volume

```bash
# Check the mount
docker inspect <container> --format '{{json .Mounts}}' | jq

# Common cause: host directory owned by root, container runs as non-root user

# Option 1: Fix ownership on host
sudo chown -R 1000:1000 /host/path

# Option 2: Run container as root (NOT recommended for production)
docker run --user root <image>

# Option 3: Use a named volume (Docker manages permissions)
docker volume create mydata
docker run -v mydata:/app/data <image>

# Debug: check what user the container runs as
docker exec <container> id
docker exec <container> ls -la /app/data
```

### Network issues

**Symptom:** Container can't reach other containers or the internet

```bash
# Step 1: Check what network the container is on
docker inspect <container> --format '{{json .NetworkSettings.Networks}}' | jq

# Step 2: List all networks
docker network ls

# Step 3: Check if other containers are on the same network
docker network inspect <network-name>

# Common causes:
# - Containers on different networks (bridge vs custom)
# - DNS resolution fails (use container name, not IP)
# - Port mapping wrong

# Fix: put containers on the same custom network
docker network create mynet
docker run --network mynet --name web nginx
docker run --network mynet --name app myapp
# Now "app" can reach "web" via http://web:80

# Debug from inside a container
docker exec <container> ping google.com
docker exec <container> nslookup other-container
docker exec <container> netstat -tlnp  # what ports is the app listening on?
```

### Build failures

**Symptom:** `docker build` fails partway through

```bash
# Read the full build output (no truncation)
docker build -t myapp . 2>&1 | tee build.log

# Common causes:
# - COPY fails (file doesn't exist in build context)
# - RUN command fails (apt-get, npm install, etc.)
# - Network timeout during package install
# - Out of disk space

# Debug: build with --progress=plain for full output
docker build --progress=plain -t myapp .

# Debug: inspect the layer where it failed
docker build -t myapp . || true
docker images --filter "dangling=true"  # find the partial image
docker run --rm -it <dangling-image-id> /bin/sh

# Fix disk space issues
docker system prune -a  # removes unused images, containers, networks
docker system df  # see what's using space
```

### Container runs but app inside is broken

**Symptom:** Container status is `Up` but health check fails or app returns errors

```bash
# Step 1: Check if the process is running
docker exec <container> ps aux

# Step 2: Check what the app is logging
docker logs <container> --tail 100 --follow

# Step 3: Get a shell and poke around
docker exec -it <container> /bin/sh
# Then inside:
curl localhost:8080/health
env | grep DATABASE
ls -la /app/config

# Step 4: Check resource limits
docker stats <container>  # is it hitting CPU/memory limits?

# Common causes:
# - App is listening on 127.0.0.1 instead of 0.0.0.0
# - Wrong environment variable
# - Database connection string points to localhost (should be host.docker.internal on Mac/Win or the host's IP on Linux)
# - Health check hitting wrong port or path
```

## Docker Compose issues

### Service fails to start in compose

```bash
# See which services are up
docker-compose ps

# Read logs from all services
docker-compose logs

# Read logs from one service
docker-compose logs web --tail 100

# Check the resolved config (after variable substitution)
docker-compose config

# Common causes:
# - Depends_on doesn't wait for the dependency to be READY, only STARTED
# - Environment variable not set (use .env file or export before docker-compose up)
# - Port conflict (another service using 8080)

# Fix: restart one service
docker-compose restart web

# Fix: rebuild after changing Dockerfile
docker-compose up --build
```

## Debugging techniques

### 1. Override the entrypoint to explore

```bash
docker run --rm -it --entrypoint /bin/sh <image>
# Now you're inside the container's filesystem
# Check what files exist, what env vars are set, what the command would be
```

### 2. Use `docker exec` to inspect a running container

```bash
docker exec -it <container> /bin/sh
# Or if sh isn't available:
docker exec -it <container> /bin/bash
# Or for minimal images:
docker exec -it <container> cat /etc/os-release
```

### 3. Check what changed in a running container

```bash
docker diff <container>
# A = added, C = changed, D = deleted
```

### 4. Inspect everything about a container

```bash
docker inspect <container> | jq
# Drill into specific fields:
docker inspect <container> --format '{{.State.ExitCode}}'
docker inspect <container> --format '{{range .Config.Env}}{{println .}}{{end}}'
```

### 5. Compare image layers

```bash
docker history <image>
# See what commands created each layer and how big they are
```

### 6. Run a debug container alongside your app

```bash
# For minimal images without curl/dig/tcpdump:
docker run --rm -it --network container:<app-container> nicolaka/netshoot
# Now you share the app's network namespace and have full tools
```

## Rules

1. **Read the logs first.** Most issues are in the logs. `docker logs --tail 100 <container>` before anything else.

2. **Check exit codes.** Each code has a meaning. 137 = killed (usually OOM), 127 = command not found, 1 = app error.

3. **Inspect is your X-ray.** `docker inspect` reveals everything: env vars, mounts, network config, exit codes, health checks.

4. **Minimal reproduction.** Strip your Dockerfile/compose down to the simplest case that still fails.

5. **One change at a time.** Change one thing, rebuild/restart, check. Don't stack 5 fixes and guess which worked.

6. **Override entrypoint to explore.** When the container won't stay up, override the entrypoint with a shell and run commands manually.

7. **Network = use container names, not IPs.** Docker DNS resolves container names. `curl http://web:80`, not `curl http://172.17.0.3:80`.

## Anti-patterns

- ❌ Editing files inside a running container and expecting them to persist (they vanish on restart)
- ❌ Using `docker attach` when you want `docker exec` (attach hijacks stdout, exec gives you a new shell)
- ❌ Debugging in production by restarting containers repeatedly (check logs first)
- ❌ Assuming localhost inside a container means the host (use host.docker.internal on Mac/Win, or the host's actual IP)
- ❌ Running `docker system prune -a` on a production server (deletes ALL unused images/volumes)

## When to use this skill

Use this skill when:
- A container exits immediately after starting
- `docker build` fails
- Containers can't reach each other
- Volume mounts fail with permission errors
- Compose services fail to start
- App inside container behaves differently than on host

Skip this skill when:
- Debugging application logic (not Docker-specific)
- Writing Dockerfiles from scratch (use a reference guide)
- Optimizing image size (different concern)
