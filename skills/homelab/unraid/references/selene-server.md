# Selene server (Unraid, 192.168.1.254)

Access: `ssh -i ~/.ssh/id_rsa root@192.168.1.254`.

## Fan/thermal fix (resolved 2026-09-22, verified 2026-09-29)

- Random shutdowns root-caused to CPU thermal trip (AMD reset reason `0x00200a00` via dmesg).
- Root cause: dynamix.system.autofan had PWM1 (CPU header) bound to a disk-temp sensor -> fan parked at 169 RPM -> thermal trip under load.
- Fix: autofan disabled (`service="0"`), fanctrlplus owns all 3 PWMs. PWM1 curve = k10temp Tctl (`/sys/class/hwmon/hwmon3/temp1_input` — hwmon indices shift per boot, find by label) 40-70C -> duty 40-100%. Verified live 2026-09-29: Tctl ~73-78C under load, fan1 ~3366 RPM. PWM2 fixed 204 (fan2 ~1900 RPM) — pump-header confirm still pending. PWM3 pinned 255.
- Verify: `sensors | grep -E 'MB Temp|Tccd|Array Fan'`; array-watch log only records array state changes.

## Disks (SMART sweep 2026-09-29: clean)

All 12 data disks sdb..sdn report Reallocated=0 and Current_Pending=0.
`sdk` = PNY CS900 120GB (boot/cache SSD) clean. `sda` is a USB bridge
device with no SMART. No RMA case holds; re-derive from the next parity
check's error counts before ordering anything. Read attributes with
`smartctl -A /dev/sdX | awk '$2=="Reallocated_Sector_Ct"{print $10}'`.

## unraid-vitals plugin

Settings live in the plugin UI now (ajax action=settings / save_settings,
CSRF via webGui token); legacy VitalsSettings.page deleted. Collector cron
was dead since install until 2026-09-29: Unraid's dillon crond has NO user
field in cron.d lines — a Debian-style `root` field makes cron run `root`
as a command (`/bin/sh: root: command not found` every minute). Fixed repo
commit 65cf262 + hot-patched /etc/cron.d on Selene; ring verified advancing
~1/min. Repo: BeinnoLLC/unraid-vitals, installed from /boot/plugins.

## Pending (needs user)

1. Pump header confirm: pwm2 fixed 80% OK? (tach ~1900 RPM now)
2. VM CPU pinning map approval (Windows gaming VM 4 physical cores 0-3+16-19, utility VM 4-5+20-21, Docker unpinned).
3. Daily health-scan schedule choice.

## Pending (machine-side)

- Wait for next monthly parity check; compare error counts to SMART.
- Rotate the flash backup (`/boot` copy) after any plugin config change.
