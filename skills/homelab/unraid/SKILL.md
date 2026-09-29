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

## Random shutdowns

### Diagnose a hard power-off before touching anything

- Read the previous boot's trip reason first: `dmesg | grep -i "reset reason"`. AMD boards report `internal CPU thermal limit was tripped` (code `0x00200a00`); other codes point at a power supply or VRM fault. A clean OS shutdown records a software reason instead, which redirects the hunt to plugins or a UPS.
- Separate a hard trip from a clean shutdown by uptime. A thermal trip cuts power seconds to minutes after boot under load. A clean shutdown leaves a syslog tail with service stop messages.
- Mirror syslog to flash (`Settings` -> `Syslog Server` -> mirror to flash) so the log survives a power cut. Without the mirror the evidence dies with the boot and the next diagnosis starts blind.
- Treat a thermal trip as a cooling-control fault, not a hardware failure, until the fan curve is proven correct. A CPU that trips within seconds of boot is usually an idle fan, not a dead chip.

### Fan control: one plugin per header

- Run exactly one fan-control plugin. `dynamix.system.autofan` and `fanctrlplus` both write the same PWM sysfs nodes, and the loser's writes are silently overwritten every interval.
- Check what autofan actually targets before trusting it. Its default binds a PWM header to a *disk* temperature sensor, which parks the CPU fan near idle whenever disks are cool. This is the classic cause of thermal trips on a loaded VM host.
- Disable the plugin you are not using in its persisted config, not just in the UI: set `service="0"` in `/boot/config/plugins/dynamix.system.autofan/service.cfg` and confirm it is gone from autostart.
- Restart the surviving fan loop after disabling the other plugin. Killing autofan also kills a manually started `fanctrlplus` process, and the PWM silently reverts to firmware default.
- Run a pump header at constant duty (60 to 80 percent), never temperature-modulated. Water flow must not oscillate with CPU load. Set `idle` equal to `pwm` and disable the temperature override so the loop writes one value forever.
- Confirm a header has a fan before tuning it. A PWM with no tach reading (0 RPM) is an unpopulated header, and any config pointed at it changes nothing.

### Pick the right temperature sensor

- Use k10temp `Tctl` for Ryzen CPU fan curves. It is the on-die value the CPU actually trips on. Find it by label, not by index: `grep . /sys/class/hwmon/hwmon*/temp*_label`.
- Ignore the Super-I/O `CPUTIN` and `SYSTIN` sensors for CPU control. They sit on the motherboard chip, lag the die by seconds, and read low.
- Read `Tccd1` and `Tccd2` to spot an uneven cooler. A large gap between the two core-complex dies means old paste or bad cooler seating, not a fan-curve problem.
- Resolve hwmon paths every session. hwmon numbering shifts between boots, so a hardcoded `hwmon3` in a saved config can silently point at a different chip after a reboot.

## Plugin cron: the user-field trap

Unraid's dillon crond takes NO user field: five time fields then the command (`/etc/cron.d/root` proves it). A Debian-style line (`* * * * * root /usr/bin/php ...`) makes crond run `root` as the command -- the job's log fills with `/bin/sh: line 1: root: command not found` every minute while the real job never runs. Found live in the unraid-vitals plugin (repo commit 65cf262): the collector was dead since install. Verify a fix by watching the job's output mtime cross a minute boundary, not the log. Check an existing `/etc/cron.d/*` file on the target before writing a cron line anywhere.

## CPU pinning for VM and Docker hosts

See `references/cpu-and-fan-tuning.md` and `references/selene-server.md` (live state of 192.168.1.254: fan fix, SMART sweep, plugin state, pending decisions) for the full procedure and verification commands.

- Map vCPU pins to physical cores before assigning. On a 2-way SMT chip, logical CPU `N` and `N+16` are hyperthread siblings of the same physical core. Two VMs both given core `15` share one core's execution units.
- Give every VM exclusive cores. Overlapping `vcpupin` sets are the usual cause of one core group running far hotter than the other under mixed load.
- Pin each vCPU to one thread of its core for light VMs, or both siblings for VMs that need more throughput. Do not hand two different VMs the same siblings.
- Set `isolcpus` to match the VMs that genuinely need isolation, and give those cores to that VM alone. Reserving a core in `isolcpus` and then pinning a VM to it defeats the isolation.
- Keep Docker off VM-owned cores. Set `<CPUset>` in the container templates *and* apply it live with `docker update`, since templates only take effect on container recreation.
- Shrink a VM's `vcpu` count and its `<topology>` together. Changing only the count fails with `CPU topology doesn't match the desired vcpu count`, because the declared cores-times-threads must equal the vCPU total.
- Persist VM changes with `virsh vcpupin --config` (plus `--live` to apply now). A live-only change is lost on the next VM start.
- Back up `/etc/libvirt/qemu/*.xml` and `/boot/syslinux/syslinux.cfg` to flash before editing pins. `/etc/libvirt` is a loopback image, so an edit there is not visible on the flash backup unless you copy it out first.

## References

- Official docs: https://docs.unraid.net
- Forums: https://forums.unraid.net
- Community Applications: search "CA" in Plugins
- SpaceInvader One (video tutorials): YouTube channel
- Reddit: /r/unraid
