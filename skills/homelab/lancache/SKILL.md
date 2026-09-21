---
name: lancache
description: Use when setting up game caching for LANs or homelabs. Cache Steam/Epic/Origin downloads once, serve many.
---

Setup and troubleshoot Lancache, a caching proxy that intercepts game download traffic and serves cached copies locally, avoiding re-downloading multi-GB games across LAN parties or multiple machines.

## What Lancache does

Sits between game clients (Steam, Epic, Origin, Battle.net, etc.) and their CDNs. DNS interception redirects download requests to the cache server. First download pulls from the internet and caches; subsequent downloads serve from local disk at LAN speed (1-10 Gbps).

## Architecture

**Three components**:
1. **lancache** (monolithic) or **lancache-bundle** (nginx + caching logic)
2. **lancache-dns** (dnsmasq, intercepts CDN hostnames)
3. **sniproxy** (optional, for HTTPS passthrough when needed)

Typical setup: one cache server (Ubuntu/Debian, 500GB+ SSD/NVMe for cache storage), clients point DNS to the cache server.

## Quick setup (Docker Compose)

```bash
git clone https://github.com/lancachenet/docker-compose lancache
cd lancache
nano .env
```

Key `.env` settings:
```
LANCACHE_IP=192.168.1.10          # cache server's LAN IP
DNS_BIND_IP=192.168.1.10          # same IP (lancache-dns listens here)
UPSTREAM_DNS=1.1.1.1              # real DNS for non-cached domains
CACHE_ROOT=/data/lancache         # where cached data lives (needs space!)
CACHE_DISK_SIZE=500g              # max cache size
CACHE_MAX_AGE=3650d               # keep cached data 10 years (game files don't change)
```

Start:
```bash
docker-compose up -d
docker-compose logs -f
```

## Client configuration

**Option 1: Router DHCP** (cleanest)
Set DHCP DNS server to `192.168.1.10` (lancache server). All clients automatically use it.

**Option 2: Manual DNS per client**
On each gaming PC, set DNS to `192.168.1.10`. Works when you can't control the router.

**Verify interception**:
```bash
nslookup steamcache.lancache.net 192.168.1.10
# Should return LANCACHE_IP, not the real CDN
```

## Supported services

Out of the box:
- Steam
- Epic Games Store
- Origin (EA)
- Battle.net (Blizzard)
- Uplay (Ubisoft)
- GOG
- Windows Update (careful: huge cache growth)

Each has DNS rules in `lancache-dns`. Check `/etc/lancache/` inside the dns container for the full list.

## Pre-fill (optional)

Download popular games to the cache before the LAN party so the first client doesn't wait.

Use **steamcache-prefill**:
```bash
docker run -it --rm \
  -v /data/lancache:/data/cache:ro \
  tpill90/steamcache-prefill:latest \
  select-apps
```

Prefill from a list:
```bash
# prefill.txt: one Steam AppID per line (e.g., 730 for CS:GO)
docker run -it --rm \
  -v /data/lancache:/data/cache \
  -v $(pwd)/prefill.txt:/app/prefill.txt \
  tpill90/steamcache-prefill:latest \
  prefill /app/prefill.txt
```

**Find AppIDs**: https://steamdb.info or `steamcache-prefill search <game name>`.

## Troubleshooting

### Cache not serving (client downloads from internet)

**Check DNS**:
```bash
# On client:
nslookup lancache.steamcontent.com
# Should resolve to LANCACHE_IP, not a CDN IP
```

If it resolves to the real CDN, DNS isn't pointing to lancache-dns.

**Check logs**:
```bash
docker-compose logs lancache | grep "cache_status:HIT"
# HIT = served from cache, MISS = downloading from CDN
```

First download is always MISS. Second should be HIT.

### Cache fills up too fast

Windows Update caching can eat 200GB+ in a week. Disable it in `.env`:
```
DISABLE_WINDOWSUPDATES=true
```

Restart:
```bash
docker-compose down && docker-compose up -d
```

### Pi-hole or AdGuard conflicts

Lancache-dns and Pi-hole both want port 53. **Two solutions**:

**1. Pi-hole upstream to lancache-dns** (recommended):
- Lancache-dns listens on `192.168.1.10:53`
- Pi-hole listens on `192.168.1.2:53`
- Set Pi-hole's **Custom DNS 1** to `192.168.1.10`
- Clients use Pi-hole (`192.168.1.2`), Pi-hole forwards to lancache-dns for CDN interception

**2. Lancache-dns on alternate port**:
```
# .env
DNS_BIND_IP=192.168.1.10:5353
```

Then configure Pi-hole conditional forwarding:
```
# /etc/dnsmasq.d/02-lancache.conf
server=/steamcontent.com/192.168.1.10#5353
server=/akamaihd.net/192.168.1.10#5353
# ... repeat for each CDN domain
```

Restart dnsmasq: `pihole restartdns`.

### Slow first download (MISS path)

Lancache doesn't speed up the **first** download, only subsequent ones. If the first download is slow:
- Check upstream bandwidth (ISP cap, router QoS)
- Verify cache server isn't CPU/disk bottlenecked (`htop`, `iotop`)
- Use prefill to cache before clients arrive

### Cache not persisting across reboots

Check `CACHE_ROOT` in `.env` points to persistent storage (not `/tmp`). Verify the volume mount:
```bash
docker-compose exec lancache df -h /data/cache
```

Should show your SSD/NVMe mount, not tmpfs.

### HTTPS / SSL interception issues

Modern game clients use HTTPS pinning, so Lancache **does not** MITM HTTPS. Instead:
- DNS interception works because CDNs use HTTP for bulk downloads (blobs, depot chunks)
- HTTPS traffic (auth, store pages) bypasses the cache via sniproxy

If a client refuses to download:
1. Check sniproxy is running: `docker-compose ps sniproxy`
2. Verify HTTPS traffic bypasses: `tcpdump -i any port 443 | grep <client-IP>`

## Monitoring

### Cache hit rate
```bash
docker-compose exec lancache tail -f /data/logs/access.log | grep cache_status
```

HIT = served from cache, MISS = downloaded from CDN. Healthy cache after warmup: 80%+ HITs.

### Cache size
```bash
du -sh /data/lancache
```

### Per-service breakdown
Cache organized by upstream:
```bash
ls -lh /data/lancache/
# steam/, epicgames/, blizzard/, etc.
```

## When to use

- Setting up a LAN party (20+ people downloading the same games)
- Homelab with multiple gaming PCs
- Limited internet bandwidth or data caps
- Repeated game installs/reinstalls (testing, fresh OS installs)

## When NOT to use

- Single gaming PC (no benefit from caching)
- Unlimited gigabit fiber (download speed already maxes out)
- No control over network DNS (can't intercept)

## Anti-patterns

| Anti-pattern | Fix |
|--------------|-----|
| Clients bypass DNS to 8.8.8.8 | Block outbound port 53 except from cache server |
| Cache on slow HDD | Use SSD/NVMe; HDDs bottleneck at ~100MB/s |
| Windows Update enabled, cache fills instantly | Set `DISABLE_WINDOWSUPDATES=true` |
| Running Pi-hole and lancache-dns on same port | Use upstream forwarding or alternate port |
| Prefilling games nobody plays | Survey attendees for their top 5 games first |

## Integration with Pi-hole/AdGuard Home

**Pi-hole upstream method** (cleanest):
1. Lancache-dns on `192.168.1.10:53`
2. Pi-hole on `192.168.1.2:53`
3. Pi-hole **Settings → DNS → Custom 1**: `192.168.1.10`
4. Clients use `192.168.1.2` for DNS
5. Pi-hole forwards CDN domains to lancache-dns, blocks ads, resolves everything else

**AdGuard Home upstream method**:
1. Lancache-dns on `192.168.1.10:53`
2. AdGuard Home on `192.168.1.2:53`
3. AdGuard **Settings → DNS Settings → Upstream DNS**: add `[/steamcontent.com/]192.168.1.10`
4. Repeat for each CDN domain: `akamaihd.net`, `epicgames.com`, etc.

Full domain list: https://github.com/uklans/cache-domains/tree/master/cache_domains

## References

- Official docs: https://lancache.net/docs/
- Docker Compose: https://github.com/lancachenet/docker-compose
- Prefill tool: https://github.com/tpill90/steam-lancache-prefill
- CDN domain list: https://github.com/uklans/cache-domains
