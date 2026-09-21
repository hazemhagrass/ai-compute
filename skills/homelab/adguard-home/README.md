# AdGuard Home

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Network-wide DNS filtering: one resolver blocks ads, trackers, and malware domains for every device on the network, including the ones with no ad blocker of their own.

## What it does

AdGuard Home is a DNS server with a filter engine in front of it. Every device asks it to resolve names. It checks each name against blocklists and your custom rules, answers `0.0.0.0` or NXDOMAIN for anything blocked, and forwards the rest to an upstream resolver over encrypted transport.

Because filtering happens at the DNS layer, it covers things a browser extension cannot touch:

- Smart TVs and streaming sticks phoning home
- Mobile apps with embedded ad SDKs
- IoT devices doing telemetry
- Guest phones on the wifi

And because it filters by *name*, it cannot touch:

- Ads served from the same domain as the content (YouTube pre-rolls)
- Anything that connects straight to a hardcoded IP
- Traffic from a device using its own encrypted DNS

It also gives you a query log (what every device asked for), per-client policies, and local DNS rewrites for internal hostnames.

## When to use this

- **Whole-network ad blocking**: one deployment covers phones, TVs, consoles, and guests
- **Malware and phishing domain blocking**: a cheap extra layer that costs one DNS lookup
- **Parental controls**: per-device blocked services with a schedule
- **Internal DNS**: `nas.home.arpa` instead of remembering `192.168.1.20`
- **Split-horizon DNS**: point `cloud.example.com` at the LAN IP so local clients skip the router hairpin
- **Visibility**: the query log shows exactly what that new smart plug talks to

**Not a fit when**: you have no control over router DHCP, you need per-URL filtering rather than per-domain, or you cannot tolerate DNS being a single point of failure without building a second instance.

## Quick start

A complete worked example: deploy it, free port 53, point the network at it, and prove blocking works.

### 1. Free port 53 on the host

Most Linux hosts run `systemd-resolved`, which binds UDP 53 on `127.0.0.53`. AdGuard Home will crash-loop with `bind: address already in use` until you move it.

```bash
sudo ss -lnup 'sport = :53'
# Usually: users:(("systemd-resolve",pid=812,fd=12))
```

Disable only the stub listener, keep the service alive so the host can still resolve:

```bash
sudo mkdir -p /etc/systemd/resolved.conf.d
sudo tee /etc/systemd/resolved.conf.d/adguardhome.conf >/dev/null <<'EOF'
[Resolve]
DNSStubListener=no
EOF

sudo rm -f /etc/resolv.conf
sudo ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf
sudo systemctl restart systemd-resolved

sudo ss -lnup 'sport = :53'   # expect no output
```

### 2. Deploy the container

```bash
mkdir -p /opt/adguardhome && cd /opt/adguardhome
```

`docker-compose.yml`:

```yaml
services:
  adguardhome:
    image: adguard/adguardhome:latest
    container_name: adguardhome
    network_mode: host
    restart: unless-stopped
    volumes:
      - ./work:/opt/adguardhome/work
      - ./conf:/opt/adguardhome/conf
    cap_add:
      - NET_BIND_SERVICE
```

```bash
docker compose up -d
docker compose logs -f adguardhome
```

Host network mode matters: in bridge mode every query looks like it came from the Docker gateway, and per-client rules stop working.

### 3. Run the setup wizard

Open `http://192.168.1.5:3000`, set the admin listen port to 80 (or 8080 if something else owns 80), set the DNS listen port to 53, and create the admin account. The wizard writes `conf/AdGuardHome.yaml` and the 3000 listener goes away.

### 4. Set upstreams with a bootstrap

In Settings > DNS settings, or directly in `conf/AdGuardHome.yaml`:

```yaml
dns:
  upstream_dns:
    - https://dns.quad9.net/dns-query
    - tls://one.one.one.one
  bootstrap_dns:
    - 9.9.9.10
    - 149.112.112.10
  cache_size: 4194304
  cache_optimistic: true
```

Bootstrap DNS is not optional here. Resolving `dns.quad9.net` requires DNS, and AdGuard Home cannot ask itself, so without a plain-IP bootstrap the whole thing deadlocks at startup.

### 5. Point the network at it via DHCP

On the router, set the DHCP-advertised DNS server to `192.168.1.5` and leave the secondary field **empty**. Give the AdGuard Home host a static lease first, because the whole network now depends on that address.

Force clients to pick up the new lease:

```bash
# Linux client
sudo dhclient -r && sudo dhclient
# macOS
sudo ipconfig set en0 DHCP
# Windows
ipconfig /release && ipconfig /renew
```

Router DHCP is the only method that covers everything. Per-device configuration covers the devices you remember to configure; the TV, the printer, and your guest's phone will use whatever the router hands them.

### 6. Verify that blocking actually works

```bash
# from a client, not from the AdGuard host itself
dig @192.168.1.5 example.com +short
# 93.184.216.34  -> resolution works

dig @192.168.1.5 doubleclick.net +short
# 0.0.0.0        -> filtering works

nslookup analytics.google.com
# Server: 192.168.1.5  -> the client is really using it
```

Then check the query log in the web UI. Every active device should be listed with non-zero queries. A device on the network with **zero** queries is not quiet; it is bypassing you with its own DNS.

## Key concepts

### DNS filtering versus content filtering

AdGuard Home decides yes or no on a *hostname*. It never sees URLs, page content, or which specific request inside a page is an ad. That is why first-party ads survive and why you still want a browser blocker on top.

### Upstream, bootstrap, and fallback

- **Upstream**: where normal queries go (`https://dns.quad9.net/dns-query`)
- **Bootstrap**: plain-IP resolvers used once, only to resolve the upstream's own hostname
- **Fallback**: used when every upstream fails, so a provider outage does not take the house offline

### Encrypted transports

- **DoT** (DNS-over-TLS, TCP 853): clean to block at a firewall, easy to spot
- **DoH** (DNS-over-HTTPS, TCP 443): indistinguishable from web traffic, which is exactly why devices use it to escape you
- **DoQ** (DNS-over-QUIC, UDP 784/8853): lowest latency, newest support

### Client identification

- **By IP**: breaks on the next DHCP lease change
- **By MAC**: stable on the LAN, useless off it
- **By ClientID**: a tag inside the DoH/DoT URL, works anywhere including cellular

### Blocked services

Curated per-service rule bundles (TikTok, YouTube, Discord) with optional schedules, applied per client. Use these instead of pushing category lists into the global filter.

### DNS rewrites

Map a name to an IP for LAN clients only. Solves internal hostnames and split-horizon access to a service whose public DNS points at your WAN IP.

## Common pitfalls

**Two DNS servers in DHCP for "redundancy"**

```
❌ DHCP DNS: 192.168.1.5, 1.1.1.1
✅ DHCP DNS: 192.168.1.5
```
Clients pick either server freely, so roughly half your queries skip filtering at random.

**Bridge networking for a LAN-facing resolver**

```
❌ ports: ["53:53/udp"]  with default bridge
✅ network_mode: host
```
Bridged containers see the Docker gateway as the source of every query, which kills per-client rules and the query log.

**Encrypted upstream with no bootstrap**

```
❌ upstream_dns: [tls://dns.quad9.net]   # bootstrap_dns empty
✅ bootstrap_dns: [9.9.9.10, 149.112.112.10]
```
Resolving the upstream's hostname needs DNS, and it cannot ask itself, so startup deadlocks.

**Stacking every blocklist you can find**

```
❌ 15 lists, 1.8M rules
✅ AdGuard DNS filter + one hosts list, ~250k rules
```
Extra lists add memory and latency, multiply false positives, and turn "which rule broke checkout" into an evening of bisecting.

**Identifying clients by IP address**

```
❌ ids: [192.168.1.42]
✅ ids: [aa:bb:cc:dd:ee:ff]   # or a ClientID
```
The entry silently detaches on the next DHCP lease and the device falls back to global settings with no error.

**Allow rule without `$important`**

```
❌ @@||analytics.example.com^
✅ @@||analytics.example.com^$important
```
A later blocklist entry can still win, so the site breaks again after the next filter update.

**Disabling a whole blocklist to fix one site**

```
❌ turn off AdGuard DNS filter
✅ @@||cdn.brokensite.com^$important
```
One targeted unblock keeps the other 200,000 rules working.

**Wildcard rewrite without the apex**

```
❌ *.apps.home.arpa -> 192.168.1.30
✅ *.apps.home.arpa and apps.home.arpa
```
Wildcards do not answer the bare domain, so the root hostname fails while subdomains work.

**Only one instance, no plan for its death**

```
❌ single container on the NAS that also does everything else
✅ second instance on a Pi, config rsynced, both in DHCP
```
DNS failure reads as "the internet is down" to every person in the building.

**Ignoring DoH-capable clients**

```
❌ assume DHCP settles it
✅ block outbound 53/853 except to the resolver, plus ||use-application-dns.net^
```
Firefox, Chrome, Android Private DNS, and most streaming sticks will route around you and never appear in the log.

**Restoring config with the container running**

```
❌ cp backup.yaml conf/AdGuardHome.yaml   # while running
✅ docker compose stop, copy, docker compose start
```
AdGuard Home rewrites the file on shutdown and overwrites your restore.

**Keeping 90 days of query log on a shared network**

```
❌ querylog interval: 2160h
✅ querylog interval: 168h   (or anonymize_client_ip: true)
```
A full record of every site everyone in the house visited is a liability, not a feature.

## See also

- [lancache](../lancache/) for caching game downloads on the same LAN; put AdGuard Home in front and forward CDN domains to lancache-dns with `[/steamcontent.com/]192.168.1.10`
- [unraid](../unraid/) for running the container on an Unraid box with persistent appdata shares

## References

- Official docs: https://adguard.com/kb/adguard-home/overview/
- Docker image: https://hub.docker.com/r/adguard/adguardhome
- DNS filtering syntax: https://adguard.com/kb/general/dns-filtering-syntax/
- Hostlists registry: https://github.com/AdguardTeam/HostlistsRegistry
- Configuration reference: https://github.com/AdguardTeam/AdGuardHome/wiki/Configuration
- Known DNS providers: https://adguard-dns.io/kb/general/dns-providers/
