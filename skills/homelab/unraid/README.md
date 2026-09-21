# Unraid

<!-- robot-banner -->
<div align="center">
<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjNxOGRzYWxnYnN5dGEzNjVldGVvMzF0c2l5bTV1Zm5wNWJ2dGlmbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPnAiaMCws8nOsE/giphy.gif" alt="AI skill robot" width="180" />
</div>

Mixed-size drive arrays with parity protection, Docker containers, and VMs for homelabs. Not traditional RAID: each disk keeps its own filesystem.

## What it does

NAS OS for homelabs. Build storage arrays from mismatched drive sizes (4TB + 8TB + 12TB), add parity protection, run Docker apps (Plex, Sonarr, game servers), spin up VMs with GPU passthrough, all from one web UI.

**Key difference from RAID**: drives aren't striped. Each disk has its own filesystem. Parity protects against single disk failure without rebuilding the entire array.

## When to use it

- **Homelab NAS** with mixed-size drives you already own
- **Docker host** for media servers, home automation, downloaders
- **VM host** with GPU passthrough (gaming VM, encoding)
- **Parity protection** without RAID's same-size requirement
- Prefer **ease of use** over maximum performance

## When NOT to use it

- ❌ Need RAID5/6 performance (Unraid parity slower than RAID)
- ❌ Enterprise/production data (use TrueNAS/ZFS)
- ❌ All disks same size (RAID-Z performs better)
- ❌ Can't tolerate 6-hour parity rebuild after adding disk

## Architecture

### Array
Data disks (any size, any filesystem) + 1-2 parity disks (must be ≥ largest data disk). Parity rebuilds any one failed disk.

### Cache
SSD/NVMe pool for fast writes. Files land on cache first, **mover** transfers to array overnight. Docker appdata lives here permanently (fast access).

### Shares
Virtual directories (`/mnt/user/Media`) spanning multiple disks. Unraid decides which disk stores each file based on free space.

### Docker
KVM containers for apps. Stored on cache for speed. Community Applications plugin = app store with 1000+ pre-configured templates.

### VMs
KVM-based VMs (Windows, Linux) with GPU passthrough for gaming or encoding.

## Quick setup

1. **Flash USB** with Unraid creator (1GB+ stick)
2. **Boot from USB**, access web UI at `http://tower` or `http://<IP>`
3. **Assign disks**: Main → Array Operation
   - Parity: largest disk
   - Disk 1, 2, 3: data disks
   - Cache: SSD/NVMe
4. **Start array** (formats disks on first run, builds parity 6-12 hours)
5. **Enable Docker**: Apps → Docker
6. **Install apps**: Community Applications plugin → search for Plex, Sonarr, etc.

**30-day free trial**, then license required ($59-129 based on disk count).

## Common issues

### Corrupted docker.img

**Symptoms**: Containers won't start, Docker page blank, "file not found"

**Fix**:
```bash
1. Stop array
2. Settings → Docker → Disable Docker
3. Rename /mnt/user/system/docker/docker.img to .old
4. Enable Docker (rebuilds image)
5. Reinstall containers from Community Applications
   (appdata survives, configs intact)
```

### Parity check errors

Monthly auto-check emails "X errors found".

**Steps**:
1. Main → Check (re-run to confirm errors persistent)
2. Main → <disk> → SMART Report
3. Check Reallocated Sectors, Pending Sectors
4. Replace disk if >100 reallocated or "FAILING_NOW"

### Array won't start: "disk invalid or missing"

Disk signature changed (wrong disk, cable swap, USB re-enumeration).

**Fix**: Tools → New Config
1. Preserve current assignments: All
2. Reassign disks (match by serial number, not position)
3. Start array

**Warning**: wrong assignment = data loss.

### Shares not visible on network

1. Settings → SMB → Enable
2. Shares → <name> → Export: Yes
3. Windows: `\\tower\Media`
4. Mac: `smb://tower/Media`

### VMs won't start

**GPU passthrough**:
1. Tools → System Devices (check GPU in isolated IOMMU group)
2. Settings → VM Manager → bind GPU to VFIO
3. Some GPUs need dumped VBIOS ROM file

**General**:
1. Windows VMs need VirtIO drivers (virtio-win ISO)
2. VMs → <name> → Edit XML (check for malformed config)
3. VMs → Logs for libvirt errors

## Monitoring

**Main → Array**:
- Disk temps (HDDs: <45°C good, >50°C bad)
- Parity status (valid/invalid)
- SMART status (green bars)

**Recommended plugins**:
- **Fix Common Problems** (auto-detects issues)
- **Dynamix System Stats** (temp/CPU/RAM graphs)
- **Unassigned Devices** (mount external drives)

## Backup strategy

**Must back up**:
1. **USB flash** (boot device): Tools → Flash Backup → ZIP
2. **Appdata** (`/mnt/user/appdata`): Docker configs
3. **User data**: shares like Documents, Backups

**Don't back up**:
- Array itself (too big, parity-protected)
- System share (Docker image, logs)

**Automate appdata backup**:
- Plugin: **CA Backup / Restore Appdata**
- Or: `tar -czf /mnt/user/Backups/appdata-$(date +%F).tar.gz /mnt/user/appdata`

## Upgrading

**Tools → Update OS**:
1. Preserve current assignments ✓
2. Download update
3. Reboot (array auto-starts)

**Before major version jump** (6.x → 7.x):
- Backup USB flash
- Backup appdata
- Read release notes

## Key concepts

### Parity
XOR of all data disks. If one disk fails, parity + remaining disks reconstruct it. **Rebuilding takes 6-12 hours per 8TB**. Cannot survive 2 simultaneous disk failures (unless dual parity).

### Mover
Cron job (default 3am) moving files from cache to array based on share settings:
- **Cache: prefer** → write to cache, move to array overnight
- **Cache: only** → stays on cache permanently (appdata, VMs)
- **Cache: no** → write directly to array (slow)

### User shares vs disk shares
- **User shares** (`/mnt/user/Media`): span multiple disks, auto-balanced
- **Disk shares** (`/mnt/disk1/Media`): single physical disk

Always use user shares unless debugging.

### Dual parity
Two parity disks = survive two simultaneous failures. Costs two of your largest disks. Recommended for 10+ disk arrays.

## Common pitfalls

| Pitfall | Fix |
|---------|-----|
| Parity smaller than data disks | Parity must be ≥ largest data disk |
| Appdata on array (slow containers) | Shares → appdata → Cache: only |
| Single SSD cache, corrupted docker.img | Use dual-SSD mirrored cache pool |
| Never running parity checks | Settings → Scheduler → monthly check |
| USB stick dies, no backup | Tools → Flash Backup (monthly) |
| Docker writing to array | Fix container paths or share settings |

## Integration with other homelab tools

### Pi-hole / AdGuard Home
Run as Docker container:
1. Community Applications → search "pihole" or "adguard"
2. Install (host network mode)
3. Router DHCP → use Unraid IP as DNS

### Lancache
Can run on same Unraid box (needs 16GB+ RAM, separate network interface recommended) or dedicated cache server.

### Reverse proxy (Nginx Proxy Manager, Traefik)
Docker containers exposing services via subdomains:
```
plex.home.lan → Plex container
sonarr.home.lan → Sonarr container
```

## Tips

1. **Cache sizing**: 250GB minimum (500GB+ if running 10+ Docker apps)
2. **Parity drives**: buy largest you can afford (sets array ceiling)
3. **Temperature**: keep HDDs <45°C (add fans if needed)
4. **Test restores**: annually, mark a disk "failed" and verify parity rebuild works
5. **Community**: Reddit /r/unraid, SpaceInvader One YouTube tutorials, Unraid forums

## Example: typical homelab setup

**Hardware**:
- Unraid on 16GB USB stick
- CPU: Intel i5 (QuickSync for Plex transcoding)
- RAM: 32GB
- Cache: 2× 500GB NVMe (mirrored)
- Array: 4TB + 8TB + 12TB data, 12TB parity

**Apps** (Docker):
- Plex (media server)
- Sonarr, Radarr (*arr stack)
- qBittorrent
- Pi-hole (network ad blocking)
- Nginx Proxy Manager (reverse proxy)

**Shares**:
- Media (cache: prefer, movies/TV shows)
- Backups (cache: no, direct to array)
- Appdata (cache: only, Docker configs on SSD)

**Result**: 24TB usable (4+8+12), one-disk parity protection, fast Docker apps, media streaming, automated downloads.

## References

- Docs: https://docs.unraid.net
- Forums: https://forums.unraid.net
- Reddit: /r/unraid
- Video tutorials: SpaceInvader One (YouTube)
- App store: Community Applications plugin
