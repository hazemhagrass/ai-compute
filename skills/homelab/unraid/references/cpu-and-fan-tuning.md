# CPU pinning and fan tuning on an Unraid VM host

Procedure for a mixed VM + Docker host where cores are over-subscribed and the
CPU thermally trips. Work through it in order: diagnose, cool, then pin.

## 1. Read the trip reason

```bash
dmesg | grep -i "reset reason"
```

The kernel logs the *previous* boot's trip reason on every boot. A thermal trip
reads `internal CPU thermal limit was tripped` with code `0x00200a00`. Any other
code points elsewhere (power supply, VRM, manual reset) and this procedure does
not apply.

Corroborate with uptime. A thermal trip kills power seconds to minutes after
load starts. A clean shutdown leaves service-stop lines in syslog.

Before anything else, mirror syslog to flash so the evidence survives the next
cut:

- Unraid UI: `Settings` -> `Syslog Server` -> mirror to flash.
- Confirm the file appears under `/boot/logs/`.

## 2. Enumerate the cooling hardware

Find the Super-I/O chip and its hwmon path, and the CPU's own sensor:

```bash
# Super-I/O fans and PWM (nct6775 family on most X570/B550 boards)
ls /sys/devices/platform/nct6775.*/hwmon/*/
grep . /sys/class/hwmon/hwmon*/temp*_label   # find Tctl by label
grep . /sys/class/hwmon/hwmon*/fan*_label 2>/dev/null

# Snapshot every PWM, its mode, and its tach
H=/sys/devices/platform/nct6775.2592/hwmon/hwmon4
for n in 1 2 3 4 5 6 7; do
  echo "pwm$n=$(cat $H/pwm$n 2>/dev/null) mode=$(cat $H/pwm${n}_enable 2>/dev/null) fan$n=$(cat $H/fan${n}_input 2>/dev/null)RPM"
done
```

Resolve paths fresh every session: hwmon numbering moves between boots, so a
saved config naming `hwmon3` can point at a different chip after a reboot.

Reading the labels:

- `Tctl` (k10temp, `hwmon3`): the on-die CPU value. Use this for CPU fan curves.
- `Tccd1` / `Tccd2` (k10temp): the two core-complex dies. A large gap between
  them means uneven paste or cooler seating, not a fan problem.
- `CPUTIN` / `SYSTIN` (nct6775, `hwmon4`): motherboard chip sensors. Lag the die
  and read low. Do not use for CPU control.
- A `pwm` set high with `fan` reading 0 means an unpopulated header. Any config
  aimed at it changes nothing.

## 3. Resolve the fan-control conflict

Two plugins writing the same PWM node is the usual root cause. Pick one.

```bash
# What is running
ps -eo pid,args | grep -E "[f]anctrlplus|[a]utofan"

# Which startup entries exist
ls /boot/config/plugins/dynamix.system.autofan/
cat /boot/config/plugins/dynamix.system.autofan/service.cfg
ls /boot/config/plugins/fanctrlplus/
```

Disable the loser in its persisted config, not just the UI:

```bash
# autofan: write service="0" to its config, then confirm it is not running
grep -H . /boot/config/plugins/dynamix.system.autofan/*.cfg
```

Check what autofan was targeting. `dynamix.system.autofan` binds a PWM header to
a *disk* temperature sensor by default, so when disks are cool it parks the CPU
fan near idle regardless of CPU load. That is the classic thermal-trip setup on
a loaded VM host.

After disabling one plugin, restart the survivor: killing autofan also kills a
manually started `fanctrlplus` loop, and the PWM falls back to firmware default.

## 4. Configure the survivor

Per-header config lives at
`/boot/config/plugins/fanctrlplus/fanctrlplus_PWM<N>.cfg`.

CPU fan header:

```
service="1"
controller="/sys/devices/platform/nct6775.2592/hwmon/hwmon4/pwm1"
pwm="102"
max="255"
idle="102"
low="40"
high="60"
cpu_enable="1"
cpu_sensor="/sys/class/hwmon/hwmon3/temp1_input"
cpu_min_temp="40"
cpu_max_temp="70"
```

Pump header (constant duty, never temperature-modulated):

```
service="1"
pwm="204"          # 80 percent of 255
max="255"
idle="204"         # equal to pwm so the loop writes one value forever
cpu_enable="0"     # temperature override off: water flow must not oscillate
cpu_sensor=""
```

Verify the loop actually applied it, then watch for a minute:

```bash
H=/sys/devices/platform/nct6775.2592/hwmon/hwmon4
cat $H/pwm2 $H/fan2_input
```

Restart a single loop after editing its config:

```bash
pkill -f "fanctrlplus_loop.sh.*PWM2.cfg"
setsid /usr/local/emhttp/plugins/fanctrlplus/scripts/fanctrlplus_loop.sh \
  /boot/config/plugins/fanctrlplus/fanctrlplus_PWM2.cfg </dev/null >/dev/null 2>&1 &
```

## 5. Map cores before pinning

Logical CPU `N` and `N+16` are hyperthread siblings on a 2-way SMT chip. Pinning
two VMs to core `15` gives them both `15` and `31`, one physical core.

```bash
# Physical core grouping
lscpu -e | awk 'NR==1 || $0 ~ /^[0-9]/'
cat /sys/devices/system/cpu/cpu0/topology/thread_siblings_list   # e.g. 0,16

# Isolation currently reserved
cat /sys/devices/system/cpu/isolated

# Every VM's vCPU pins
for vm in $(virsh list --name | sed '/^$/d'); do
  echo "--- $vm"
  virsh dumpxml --inactive "$vm" | grep -E "<vcpu|vcpupin|<topology"
done

# Every container's cpuset
docker ps --format '{{.Names}}' | while read c; do
  printf "%-28s %s\n" "$c" "$(docker inspect -f '{{.HostConfig.CpusetCpus}}' "$c")"
done
```

Build an ownership table, one physical core per line, and look for overlaps. Any
core carrying two VMs is a fix target. Any container sharing cores with a VM is
a fix target.

## 6. Apply the pins

Back up first. `/etc/libvirt` is a loopback image, so nothing there is on the
flash backup unless you copy it out.

```bash
B=/boot/config/vmxml-backup-$(date +%Y%m%d-%H%M); mkdir -p "$B"
cp -a /etc/libvirt/qemu/*.xml "$B/"
cp -a /boot/syslinux/syslinux.cfg "$B/"
```

Move a vCPU, live and persisted:

```bash
virsh vcpupin --config --live "VMNAME" <vcpu-index> <host-cpu>
```

Shrink a VM's vCPU count: change the count **and** the topology together, or
libvirt refuses with `CPU topology doesn't match the desired vcpu count` (the
declared cores-times-threads must equal the total).

```bash
virsh dumpxml --inactive "VMNAME" > /tmp/vm.xml
# set <vcpu ...>N</vcpu> and <topology cores='X' threads='Y'/> so X*Y == N,
# and delete any vcpupin lines for vcpu indices >= N
virsh define /tmp/vm.xml
```

Re-point containers, in the template and live:

- Template: `<CPUset>` in `/boot/config/plugins/dockerMan/templates-user/my-<name>.xml`.
- Live: `docker update --cpuset-cpus="0,16" <container>`.

Templates only take effect on container recreation, so do both or the change
reappears on the next update.

Widen isolation to the VM that needs it, then pin that VM inside it:

```
# /boot/syslinux/syslinux.cfg, on every Unraid OS append line
append isolcpus=4,5,6,7,20,21,22,23 initrd=/bzroot
```

Reserving cores with `isolcpus` and then pinning a VM to those same cores
defeats the isolation; give the reserved cores to that VM alone.

## 7. Verify

Fan health at a glance (verified live on Selene 2026-09-29: PWM1 on k10temp
Tctl curve, Tctl ~73-78 C under load, fan1 ~3366 RPM; PWM2 fixed 204,
fan2 ~1900 RPM; three fanctrlplus loops running, autofan in service=0):

```bash
sensors 2>/dev/null | grep -E 'MB Temp|Tccd|Array Fan'   # plateau + fans
cat /sys/devices/platform/nct6775.*/hwmon/hwmon*/pwm1    # duty under load
tail /var/log/fanctrlplus_array_watch.log                # array state events only
```

```bash
# Final VM state
for vm in $(virsh list --name | sed '/^$/d'); do
  printf "%-18s vcpu=%-3s %s\n" "$vm" \
    "$(virsh dumpxml --inactive "$vm" | grep -oP '<vcpu[^>]*>\K\d+' | head -1)" \
    "$(virsh dumpxml --inactive "$vm" | grep -oP "cpuset='\K[^']+" | paste -sd, -)"
done

# Temps and fans
H=/sys/devices/platform/nct6775.2592/hwmon/hwmon4
for f in /sys/class/hwmon/hwmon3/temp*_label; do
  printf "%s=%sC " "$(cat $f)" "$(( $(cat ${f/_label/_input})/1000 ))"
done; echo
cat $H/fan1_input $H/fan2_input
```

Signs the fix worked:

- Uptime grows past the interval that used to trip the CPU.
- `Tccd1` and `Tccd2` come within a few degrees of each other (they diverged when
  one core group was over-subscribed).
- `Tctl` holds a stable plateau under load instead of climbing to the trip point.
