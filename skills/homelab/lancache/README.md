# Lancache

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Cache game downloads once, serve them to your entire LAN at 10 Gbps. Stop re-downloading 100GB games every LAN party.

## What it does

Intercepts Steam, Epic, Origin, Battle.net, and other game store downloads via DNS, caches them locally on first download, then serves cached copies to every subsequent client at LAN speed instead of re-downloading from the internet.

**First download**: 30 minutes (from CDN, cached)  
**Second download**: 3 minutes (from local SSD at 1-10 Gbps)

## When to use it

- **LAN parties**: 20+ people downloading the same 5 games
- **Homelabs**: multiple gaming PCs, frequent reinstalls
- **Limited bandwidth**: data caps or slow internet
- **Testing/dev**: repeatedly installing games on fresh VMs/dual boots

## When NOT to use it

- ❌ Single gaming PC (no benefit)
- ❌ Unlimited gigabit fiber (download already maxed)
- ❌ Can't control network DNS

## Architecture

Three Docker containers:
1. **lancache** - nginx with caching rules, stores game files
2. **lancache-dns** - dnsmasq, intercepts CDN hostnames (`lancache.steamcontent.com` → cache server IP)
3. **sniproxy** - HTTPS passthrough for auth/store pages (not cached)

Clients point DNS to the cache server. DNS interception redirects download traffic to the cache; everything else goes to the real internet.

## Quick setup

```bash
git clone https://github.com/lancachenet/docker-compose lancache
cd lancache
nano .env
```

**Minimum `.env`**:
```bash
LANCACHE_IP=192.168.1.10          # cache server's LAN IP
DNS_BIND_IP=192.168.1.10          # same IP
UPSTREAM_DNS=1.1.1.1              # real DNS (Cloudflare, Google, etc.)
CACHE_ROOT=/data/lancache         # SSD/NVMe mount (needs 500GB+)
CACHE_DISK_SIZE=500g              # max cache size
CACHE_MAX_AGE=3650d               # keep cached data 10 years
DISABLE_WINDOWSUPDATES=true       # prevent cache explosion
```

**Start**:
```bash
docker-compose up -d
docker-compose logs -f  # watch for errors
```

**Configure clients**:
- **Router method**: Set DHCP DNS to `192.168.1.10` (every client auto-uses it)
- **Manual method**: On each PC, set DNS to `192.168.1.10`

**Verify**:
```bash
nslookup lancache.steamcontent.com 192.168.1.10
# Should return 192.168.1.10, not a CDN IP
```

## Supported services

Out of the box:
- Steam, Epic Games, Origin (EA), Battle.net (Blizzard), Uplay (Ubisoft), GOG, Xbox Live, Windows Update

Full list: https://github.com/uklans/cache-domains

## Pre-fill

Download games **before** the LAN party so first clients don't wait.

**Install prefill tool**:
```bash
docker run -it --rm tpill90/steamcache-prefill:latest select-apps
```

**Prefill from list**:
```bash
# games.txt: one Steam AppID per line
# 730 = CS:GO, 570 = Dota 2, 1172470 = Apex Legends
docker run -it --rm \
  -v /data/lancache:/data/cache \
  -v $(pwd)/games.txt:/app/games.txt \
  tpill90/steamcache-prefill:latest prefill /app/games.txt
```

Find AppIDs: https://steamdb.info or `steamcache-prefill search <game name>`

## Troubleshooting

### Downloads still come from internet (no cache hit)

**Check DNS first**:
```bash
# On client PC:
nslookgo lancache.steamcontent.com
```
Should return `192.168.1.10`. If not, client DNS isn't pointing to lancache-dns.

**Check cache logs**:
```bash
docker-compose logs lancache | grep cache_status
```
- `cache_status:MISS` = downloading from CDN (first time)
- `cache_status:HIT` = served from cache (cached)

First download is always MISS. Second should be HIT.

### Cache fills up instantly

Windows Update can eat 200GB/week. Disable it:
```bash
# .env
DISABLE_WINDOWSUPDATES=true
```

Restart: `docker-compose down && docker-compose up -d`

### Pi-hole or AdGuard conflict (port 53 already in use)

**Solution 1: Pi-hole upstream to lancache-dns** (recommended)

1. Lancache-dns: `192.168.1.10:53`
2. Pi-hole: `192.168.1.2:53`
3. Pi-hole **Settings → DNS → Custom 1**: `192.168.1.10`
4. Clients use `192.168.1.2`
5. Pi-hole forwards CDN domains to lancache, blocks ads, resolves everything else

**Solution 2: Alternate port for lancache-dns**

```bash
# .env
DNS_BIND_IP=192.168.1.10:5353
```

Then add to Pi-hole `/etc/dnsmasq.d/02-lancache.conf`:
```
server=/steamcontent.com/192.168.1.10#5353
server=/akamaihd.net/192.168.1.10#5353
```

Restart: `pihole restartdns`

### Slow first download

Lancache doesn't speed up the **first** download, only subsequent ones.

- Check upstream bandwidth (ISP, router QoS)
- Verify cache server isn't CPU/disk bottlenecked: `htop`, `iotop`
- Use prefill to cache games before clients arrive

### Cache doesn't persist after reboot

Check `CACHE_ROOT=/data/lancache` points to real storage (not `/tmp`).

Verify mount:
```bash
docker-compose exec lancache df -h /data/cache
```

Should show your SSD/NVMe, not tmpfs.

## Monitoring

### Hit rate
```bash
docker-compose exec lancache tail -f /data/logs/access.log | grep cache_status
```

Healthy cache after warmup: **80%+ HITs**.

### Cache size
```bash
du -sh /data/lancache
```

### Per-service breakdown
```bash
ls -lh /data/lancache/
# steam/, epicgames/, blizzard/, etc.
```

## Integration with Pi-hole/AdGuard Home

### Pi-hole upstream method (cleanest)

1. Lancache-dns: `192.168.1.10:53`
2. Pi-hole: `192.168.1.2:53`
3. Pi-hole **Custom DNS 1**: `192.168.1.10`
4. Clients use Pi-hole (`192.168.1.2`)
5. Pi-hole → lancache-dns for CDN domains, blocks ads, resolves everything else

### AdGuard Home upstream method

1. Lancache-dns: `192.168.1.10:53`
2. AdGuard Home: `192.168.1.2:53`
3. AdGuard **Upstream DNS**:
   ```
   [/steamcontent.com/]192.168.1.10
   [/akamaihd.net/]192.168.1.10
   [/epicgames.com/]192.168.1.10
   ```

Full domain list: https://github.com/uklans/cache-domains/tree/master/cache_domains

## Common pitfalls

| Pitfall | Fix |
|---------|-----|
| Clients bypass to 8.8.8.8 | Block outbound port 53 except from cache |
| Cache on HDD (slow) | Use SSD/NVMe (HDDs max ~100MB/s) |
| Windows Update enabled | `DISABLE_WINDOWSUPDATES=true` |
| Pi-hole + lancache-dns on port 53 | Upstream forwarding or alternate port |
| Prefilling games nobody plays | Survey attendees first |

## Key concepts

### DNS interception
Game clients resolve `lancache.steamcontent.com` → cache server IP instead of real CDN. Download traffic goes to cache; auth/store traffic goes direct.

### Cache hit vs miss
- **MISS**: first download, pulled from CDN, cached
- **HIT**: subsequent download, served from local disk at LAN speed

### HTTPS passthrough
Modern clients use HTTPS with certificate pinning, so Lancache **does not** MITM. HTTPS traffic (login, store) bypasses via sniproxy. Only HTTP bulk downloads (game depots) are cached.

### Prefill
Pre-download popular games to cache before LAN event. First client sees instant cache hit instead of waiting for CDN download.

## Tips for LAN parties

1. **Survey attendees** for their top 5 games, prefill those
2. **Allocate 1TB+ cache** if >50 people (AAA games are 100GB each)
3. **SSD/NVMe required** for cache storage (HDD too slow)
4. **Block outbound DNS** (port 53) except from cache server so clients can't bypass
5. **Monitor hit rate** during event; <50% = DNS not working correctly

## Example: 50-person LAN party

**Setup**:
- Cache server: Ubuntu, 8 cores, 32GB RAM, 2TB NVMe
- Network: 10 Gbps switch
- Games: Apex Legends (100GB), CS2 (30GB), Fortnite (90GB), Valorant (25GB), LoL (15GB)

**Prefill** (night before):
```bash
docker run -it --rm \
  -v /data/lancache:/data/cache \
  tpill90/steamcache-prefill:latest select-apps
# Select Apex, CS2, Fortnite → 220GB cached
```

**During event**:
- First client downloads Apex (30 min, cache MISS)
- Next 49 clients download Apex (3 min each, cache HIT)
- Hit rate: 98%
- Bandwidth saved: 4.9TB (49 × 100GB)

## References

- Official docs: https://lancache.net/docs/
- Docker Compose: https://github.com/lancachenet/docker-compose
- Prefill tool: https://github.com/tpill90/steam-lancache-prefill
- CDN domains: https://github.com/uklans/cache-domains
- Reddit: /r/lancache
