---
name: unraid
description: Use when managing Unraid servers. Setup arrays, Docker, VMs, shares, troubleshoot parity/corruption.
---

Setup, configure, and troubleshoot Unraid servers for homelab NAS + Docker + VM workflows. Covers array/parity, Docker container management, user shares, cache pools, and common issues.

## What Unraid does

Unraid is a NAS OS optimized for homelabs: mixed-size drive arrays with parity protection, Docker containers, VMs, and user shares that span multiple disks. Not traditional RAID: each disk has its own filesystem, parity protects against single-disk failure.

## Architecture

**Array**: data disks (any size, any filesystem) + 1-2 parity disks (must be largest or equal to largest data disk). Parity lets you rebuild any one failed disk.

**Cache**: SSD/NVMe pool for fast writes. Files land on cache first, then **mover** transfers them to the array overnight.

**Shares**: virtual directories (`/mnt/user/Media`) that span multiple disks. Unraid handles which disk stores each file.

**Docker**: runs containers for apps (Plex, *arr stack, game servers, etc.). Containers stored on cache for speed.

**VMs**: KVM-based VMs (Windows, Linux) with GPU passthrough support.

## Initial setup

1. **Flash USB creator**: Download from unraid.net, flash to 1GB+ USB stick
2. **Boot from USB**: BIOS must boot USB first
3. **Web UI**: `http://tower` or `http://<server-IP>` from any browser on LAN
4. **Trial**: 30 days free, then requires license ($59-129 depending on disk count)

## Array setup

**Main → Array Operation**:
1. **Assign disks**:
   - Parity: largest disk (leave empty on first run)
   - Disk 1, 2, 3: data disks (any size)
   - Cache: SSD/NVMe (optional but recommended)
2. **Start array**: first time formats disks (destructive!)
3. **Build parity**: takes hours (8TB disk = 6-12 hours). Server usable during build but writes are slow.

**Adding a disk**:
1. Stop array
2. Assign new disk to an empty slot
3. Start array
4. Format new disk (Settings → disks → format)
5. Parity auto-updates (takes time proportional to disk size)

## Docker setup

**Apps → Docker**: enable Docker

**Container installation**:
1. **Community Applications plugin** (search "CA" in plugins): app store for Docker templates
2. Install apps from CA: Plex, Sonarr, Radarr, qBittorrent, etc.
3. Each container gets a template with pre-filled paths/ports

**Common container paths**:
```
Host path: /mnt/user/appdata/plex  →  Container: /config
Host path: /mnt/user/Media         →  Container: /media
```

Appdata always goes on cache (fast SSD), media goes on array (big HDDs).

## User shares

**Shares → Add Share**:
- **Name**: `Media`, `Backups`, `ISOs`
- **Primary storage**: cache (write to cache first)
- **Secondary storage**: array (move to array overnight)
- **Mover schedule**: default midnight

**Access shares** (from Windows/Mac):
```
\\tower\Media
smb://tower/Media
```

Enable SMB in Settings → SMB if not already on.

## Cache pool

Cache is typically 1-2 SSDs in a pool (mirrored or RAID1 for redundancy).

**Settings → Disk Settings → Cache**:
- Single SSD: no redundancy (corrupted cache = lost appdata, rebuild containers)
- Dual SSD (preferred): mirrored, one SSD can fail

**Mover**:
Runs nightly (default 3am), moves files from cache to array based on share settings. Manual run: **Main → Move Now**.

## Common issues

### Corrupted `docker.img`

Symptoms: containers won't start, "file not found" errors, Docker page blank.

**Fix**:
1. Stop array
2. Settings → Docker → Disable Docker
3. Rename `/mnt/user/system/docker/docker.img` to `.old`
4. Enable Docker (rebuilds `docker.img`)
5. Reinstall containers from Community Applications (appdata still exists, so configs survive)

### Parity check errors

Unraid auto-runs parity checks monthly. Errors mean disk or parity is corrupted.

**Settings → Notifications**: check email for "parity check completed: X errors"

**If errors found**:
1. **Main → Check**: re-run parity check (confirm errors are consistent)
2. If errors persist same location: disk failing
3. **SMART report** (Main → disk name → SMART): check Reallocated Sectors, Pending Sectors
4. Replace disk if SMART shows >100 reallocated sectors or "FAILING_NOW"

### Array won't start: "disk invalid or missing"

Disk signature changed (wrong disk, cable swap, USB re-enumeration).

**Tools → New Config**:
1. Stop array
2. Tools → New Config
3. Check "Preserve current assignments: All"
4. Reassign disks (double-check serial numbers)
5. Start array

**Warning**: wrong assignment = data loss. Match by serial number (Main → disk → expand details).

### Shares not visible on network

1. **Enable SMB**: Settings → SMB → Enable
2. **Check share export**: Shares → <share name> → Export: Yes
3. **Firewall**: Settings → Network Settings → Enable SMB v2 minimum
4. Windows: `\\tower\<share>`, Mac: `smb://tower/<share>`

### VMs won't start or crash

**GPU passthrough issues**:
1. **IOMMU grouping**: Tools → System Devices → check GPU in isolated group
2. **VFIO binding**: Settings → VM Manager → bind GPU to VFIO before starting VM
3. **ROM**: some GPUs need a dumped VBIOS file

**General VM troubleshooting**:
1. **VirtIO drivers**: Windows VMs need VirtIO drivers (download ISO from virtio-win)
2. **XML errors**: VMs → <vm> → Edit XML, check for malformed config
3. **Logs**: VMs → <vm> → Logs for libvirt errors

## Monitoring

**Main → Array Details**:
- Disk temperatures (HDDs: <45°C good, >50°C bad)
- Parity status (valid/invalid)
- SMART status (green = ok)

**Plugins**:
- **Fix Common Problems**: auto-detects misconfigurations
- **Dynamix System Stats**: graphs temps, CPU, RAM over time
- **Unassigned Devices**: mount external drives outside array

## Backup strategy

**What to back up**:
1. **USB flash** (boot device): Tools → Flash → Backup (ZIP file)
2. **Appdata** (`/mnt/user/appdata`): Docker container configs
3. **User data**: shares like Media, Backups

**Do NOT back up**:
- Array itself (too big, already parity-protected)
- System share (Docker image, logs, ephemeral)

**Backup appdata**:
- Plugin: **CA Backup / Restore Appdata** (scheduled tar.gz to another share)
- Or manual: `tar -czf /mnt/user/Backups/appdata.tar.gz /mnt/user/appdata`

## Upgrading Unraid

**Tools → Update OS**:
1. Check "Preserve current assignments" (keeps disk config)
2. Download update
3. Reboot
4. Array auto-starts after reboot

**Before major version upgrades** (6.x → 7.x):
1. Backup USB flash
2. Backup appdata
3. Read release notes for breaking changes

## When to use

- Building a homelab NAS with mixed-size drives
- Running Docker containers (media servers, home automation, game servers)
- GPU passthrough VMs for gaming/encoding
- Parity-protected storage without RAID's same-size requirement

## When NOT to use

- ❌ Need RAID5/6 performance (Unraid parity is slower than RAID)
- ❌ Enterprise/production critical data (use TrueNAS, ZFS, or real RAID)
- ❌ All disks same size (RAID-Z gives better performance)
- ❌ Can't tolerate 6-hour parity rebuild after adding disk

## Anti-patterns

| Anti-pattern | Fix |
|--------------|-----|
| Parity smaller than data disks | Parity must be ≥ largest data disk |
| Appdata on array (slow) | Put appdata on cache (SSD) |
| No cache redundancy, corrupted docker.img | Use dual-SSD cache pool (mirrored) |
| Docker containers writing to array | Fix container paths to use `/mnt/user/cache/...` or shares set to "cache-prefer" |
| Never running parity checks | Enable monthly scheduled checks (Settings → Scheduler) |
| USB stick dies, no backup | Backup USB flash monthly (Tools → Flash Backup) |

## Key commands (via SSH or console)

```bash
# Array status
/usr/local/sbin/emhttp &  # web UI backend (shouldn't need manual start)

# Force mover now
/usr/local/sbin/mover start

# Parity check (manual)
mdcmd check CORRECT  # start parity check with auto-correct

# Disk SMART info
smartctl -a /dev/sda

# Stop array (clean shutdown before maintenance)
mdcmd stop

# Start array
mdcmd start
```

## Integration with Lancache/Pi-hole/AdGuard

Unraid can run **Pi-hole** or **AdGuard Home** as Docker containers:

1. **Community Applications** → search "pihole" or "adguard"
2. Install template
3. Set host network mode (container uses server IP)
4. Configure router DHCP to use Unraid IP as DNS

Can also run **Lancache** on Unraid (separate cache server or same box if enough RAM/CPU).

## References

- Official docs: https://docs.unraid.net
- Forums: https://forums.unraid.net
- Community Applications: search "CA" in Plugins
- SpaceInvader One (video tutorials): YouTube channel
- Reddit: /r/unraid
