---
name: adguard-home
description: Use when setting up network-wide DNS filtering or ad blocking. Deploy AdGuard Home, point clients at it, stop bypass.
---

Deploy and operate AdGuard Home as the DNS resolver for an entire network: Docker deployment, freeing port 53 from the host resolver, pointing clients at it via DHCP, encrypted upstreams, blocklist tuning, per-client rules, local rewrites, and the two ways it silently fails.

## What AdGuard Home actually is

A recursive-ish DNS forwarder with a filter engine in front of it. Every client on the network asks it to resolve names; it checks the name against blocklists and custom rules, returns `0.0.0.0` / NXDOMAIN for blocked names, and forwards everything else to an upstream resolver. It blocks by *name*, not by content, so anything that reaches an IP without a DNS lookup is invisible to it.

## Deployment rules

- **Run it in host network mode, not bridge, when it serves the LAN.** Bridged containers see every query as coming from the Docker gateway IP, which destroys per-client rules and the query log. Host mode preserves real client source IPs.
- **Publish only the ports you actually use.** Port 53 TCP+UDP is mandatory. 3000 is the first-run setup wizard, 80/443 only if you terminate DoH yourself, 853 for DoT, 784/8853 UDP for DoQ. Leaving 80 open on a homelab box fights every other reverse proxy you own.
- **Bind-mount both `/opt/adguardhome/work` and `/opt/adguardhome/conf`.** The config file lives in `conf`; the query log, stats database, and downloaded blocklists live in `work`. Mount only one and you lose half your state on container recreate.

```yaml
# docker-compose.yml
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

If host mode is impossible (a shared Docker host), publish `53:53/tcp`, `53:53/udp`, `3000:3000/tcp` (wizard), `8080:80/tcp` (admin UI), `853:853/tcp` (DoT) and accept that client identification degrades to the gateway IP.

```bash
docker compose up -d
docker compose logs -f adguardhome
# then open http://<host-ip>:3000 once to run the wizard
```

## Free port 53 before you start the container

- **Check what holds port 53 first; do not guess.** On most modern Linux distros it is `systemd-resolved`, which binds `127.0.0.53:53`. The container will start and then crash-loop with `listen udp :53: bind: address already in use`. Check with `sudo ss -lnup 'sport = :53'`.
- **Disable only the stub listener, not all of systemd-resolved.** Killing the whole service leaves the host with no resolver and breaks package updates. Turn off the stub and repoint `/etc/resolv.conf`:

```bash
sudo mkdir -p /etc/systemd/resolved.conf.d
sudo tee /etc/systemd/resolved.conf.d/adguardhome.conf >/dev/null <<'EOF'
[Resolve]
DNSStubListener=no
DNS=127.0.0.1
EOF

sudo rm -f /etc/resolv.conf
sudo ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf
sudo systemctl restart systemd-resolved
sudo ss -lnup 'sport = :53'   # should now be empty
```

- **Point the host at AdGuard Home only after the container is healthy.** If you set `DNS=127.0.0.1` while nothing listens there, the host loses name resolution and you cannot pull the image to fix it.
- **On a Raspberry Pi OS or Debian box running dnsmasq instead, stop dnsmasq** (`sudo systemctl disable --now dnsmasq`), because two processes cannot share UDP 53 on the same address.

## Pointing clients at it

- **Set DNS in the router's DHCP scope, never device by device, if you want real coverage.** Per-device configuration covers the devices you remember; a smart TV, a guest phone, and a printer will each quietly use whatever the router hands them. DHCP is the only setting that catches everything that joins the network, including devices you do not own.
- **Set the DHCP-advertised DNS to the AdGuard Home host IP and nothing else.** Listing `192.168.1.5, 1.1.1.1` as two DNS servers does not mean "failover"; clients pick either one freely, so roughly half your queries skip filtering at random.
- **Give the AdGuard Home host a static IP or a DHCP reservation.** The whole network's name resolution depends on that address; letting it move on lease renewal takes the network down.
- **If the router will not let you change DHCP DNS, run AdGuard Home's own DHCP server** (Settings > DHCP settings) and disable DHCP on the router. Never run two DHCP servers on one broadcast domain; clients get random leases from whichever answers first.

Verify from a client:

```bash
# should report the AdGuard Home host as the server
dig @192.168.1.5 example.com +short
nslookup doubleclick.net 192.168.1.5    # expect 0.0.0.0 or NXDOMAIN
```

## Upstream DNS and encryption

- **Use exactly one upstream family and set it explicitly.** Mixed upstreams with "parallel requests" enabled leak every query to every provider at once, which is the opposite of the privacy you installed this for.
- **Prefer DoT, DoH, or DoQ upstreams so your ISP cannot read or rewrite queries.** Plain UDP 53 to `1.1.1.1` is still cleartext on the wire.
- **Always set bootstrap DNS when using an encrypted upstream by hostname.** `tls://dns.quad9.net` requires resolving `dns.quad9.net` first, and AdGuard Home cannot use itself to do that. Without bootstrap you get a chicken-and-egg failure and zero resolution.

In `AdGuardHome.yaml`:

```yaml
dns:
  bind_hosts:
    - 0.0.0.0
  port: 53
  upstream_dns:
    - https://dns.quad9.net/dns-query
    - tls://one.one.one.one
  bootstrap_dns:
    - 9.9.9.10
    - 149.112.112.10
  fallback_dns:
    - tls://dns.google
  upstream_mode: load_balance
  cache_size: 4194304
  cache_ttl_min: 60
  cache_ttl_max: 86400
  cache_optimistic: true
```

- **Turn on optimistic caching on a home network.** It serves a stale answer instantly and refreshes in the background, which hides upstream latency spikes that otherwise feel like "the internet is slow".
- **Route domains to specific upstreams with bracket syntax** when something must not go to the public resolver: `[/lan/]192.168.1.1`, `[/steamcontent.com/]192.168.1.10`, `[//]https://dns.quad9.net/dns-query`.

## Blocklists

- **Start with AdGuard DNS filter plus one hosts-style list, and stop.** AdGuard DNS filter alone covers the large majority of ad and tracker domains. The marginal blocking from list five onward is tiny.
- **Do not stack fifteen lists.** Cost is real: memory grows with total rule count, every list is re-downloaded on the update interval, overlapping lists multiply false positives, and when something breaks you now have fifteen candidates to bisect. A broken checkout page traced through 1.5 million rules is an evening lost.
- **Never mix a "porn/social/gambling" category list into the global filter** if anyone else uses the network. Apply those as per-client blocked services instead so one profile does not become everyone's policy.

```yaml
filters:
  - enabled: true
    url: https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt
    name: AdGuard DNS filter
    id: 1
  - enabled: true
    url: https://adguardteam.github.io/HostlistsRegistry/assets/filter_2.txt
    name: AdAway Default Blocklist
    id: 2
filters_update_interval: 24
```

- **Check the rule count after every list you add** (Filters > DNS blocklists). Past roughly 1 million rules on a Raspberry Pi class device, query latency and RAM both become noticeable.

## Per-client rules and the DHCP trap

- **Identify clients by MAC address or ClientID, not by IP.** IP-based client entries silently detach the moment DHCP hands the device a different lease, and the device quietly falls back to global settings. You will not get an error; you will just notice the kid's tablet has no filtering anymore.
- **Use a DHCP reservation when you must match by IP.** If AdGuard Home runs the DHCP server itself, it maps MAC to client automatically.
- **Use ClientID with encrypted DNS for roaming devices**, since a phone on cellular has no stable LAN IP at all. The device sends `https://dns.example.com/dns-query/laptop` and AdGuard Home matches the `laptop` tag anywhere in the world.

```yaml
clients:
  persistent:
    - name: kids-tablet
      ids:
        - aa:bb:cc:dd:ee:ff
      use_global_settings: false
      filtering_enabled: true
      safebrowsing_enabled: true
      parental_enabled: true
      blocked_services:
        ids:
          - tiktok
          - youtube
    - name: work-laptop
      ids:
        - laptop            # ClientID, used with DoH/DoT
      use_global_settings: true
```

## Custom rules and allowlists

- **Fix a broken site with a targeted unblock rule, not by disabling a whole list.** Adblock syntax in Filters > Custom filtering rules:

```
@@||analytics.example.com^$important     # allow, wins over blocklists
||telemetry.vendor.tld^                  # block this exact domain and subdomains
||ads.example.com^$client='work-laptop'  # block only for one client
/^stats\d+\.example\.com$/               # regex form when the pattern varies
```

- **Add `$important` to allow rules you actually need.** Without it a later blocklist entry can still win, and you will re-debug the same site next month.
- **Test a rule before you trust it**, because a typo fails open or closed silently:

```bash
dig @192.168.1.5 analytics.example.com +short
```

## Local DNS rewrites

- **Use DNS rewrites for internal hostnames instead of editing hosts files on every machine.** One entry serves the whole network and keeps working when the service moves.
- **Use a domain you control or a clearly local suffix.** Do not invent `.local` (reserved for mDNS and it will collide) and do not squat on a real TLD.

```yaml
filtering:
  rewrites:
    - domain: nas.home.arpa
      answer: 192.168.1.20
    - domain: "*.apps.home.arpa"
      answer: 192.168.1.30
    - domain: cloud.example.com
      answer: 192.168.1.30     # split-horizon: LAN clients skip the WAN hairpin
```

- **Wildcard rewrites do not cover the bare apex.** `*.apps.home.arpa` does not answer `apps.home.arpa`; add both entries.

## Failure mode 1: single point of failure

- **Assume that when the AdGuard Home box dies, the entire household loses the internet**, because DNS failure looks exactly like an outage to every user. Plan for it before it happens at 2am.
- **Run a second instance and advertise both in DHCP**, replicating the config file between them:

```bash
rsync -a /opt/adguardhome/conf/AdGuardHome.yaml \
  root@192.168.1.6:/opt/adguardhome/conf/AdGuardHome.yaml
ssh root@192.168.1.6 'docker restart adguardhome'
```

- **Accept the tradeoff of a secondary: clients query either server at will**, so both must carry the same filters or blocking becomes a coin flip.
- **If you will not run a second instance, document the bypass** (set the router DHCP DNS to `1.1.1.1`) somewhere a non-technical housemate can find it.

## Failure mode 2: clients that bypass you entirely

- **Expect browsers and devices to use their own DNS-over-HTTPS and ignore your resolver.** Firefox enables DoH to Cloudflare by default in some regions; Chrome uses Secure DNS; Android has Private DNS; Roku, Chromecast, and many IoT devices hardcode `8.8.8.8`. None of these appear in your query log, which is the tell: a device on the network with zero queries is bypassing you.
- **Block plain outbound DNS at the firewall except from the AdGuard Home host**, so hardcoded `8.8.8.8` devices fall back to DHCP-provided DNS. NAT-redirect rather than reject, since hardcoded devices often have no fallback and simply break:

```bash
# on the router/firewall, adjust interface and IPs
iptables -t nat -I PREROUTING -i br-lan -p udp --dport 53 \
  ! -d 192.168.1.5 -j DNAT --to-destination 192.168.1.5:53
iptables -t nat -I PREROUTING -i br-lan -p tcp --dport 53 \
  ! -d 192.168.1.5 -j DNAT --to-destination 192.168.1.5:53
```

- **Disable Firefox DoH network-wide with the canary domain**, which Firefox checks on startup and honors by turning DoH off. Add to custom filtering rules:

```
||use-application-dns.net^
```

- **Block the well-known public DoH endpoints by domain** so browsers with DoH forced on fall back to system DNS. Enable the "Encrypted DNS servers" blocklist from the AdGuard registry rather than hand-maintaining that list.
- **Block DoT by port**: reject outbound TCP 853 from everything except your resolver. DoQ rides UDP 784 and 8853.
- **You cannot stop a device that hardcodes DoH to an IP address with a pinned certificate.** Put those on an isolated VLAN or accept them.

## Query log and privacy

- **Shorten retention; the default keeps a full record of every site everyone in the house visits.** That is a liability, not a feature.
- **Enable anonymize_client_ip if you only need aggregate stats**, and disable the query log entirely on a network you share with guests.

```yaml
querylog:
  enabled: true
  file_enabled: true
  interval: 168h          # 7 days instead of 90
  size_memory: 1000
  anonymize_client_ip: false
statistics:
  enabled: true
  interval: 168h
```

- **The query log is your primary debugging tool**, so do not disable it while you are still tuning blocklists. Filter it by client to find which device is hammering a domain, and by "Blocked" to find the rule that broke a site.

## Backup and restore

- **Back up `AdGuardHome.yaml` and nothing else for config.** It contains filters, clients, rewrites, custom rules, and the hashed admin password. The `work` directory is regenerable cache and logs.
- **Back up before every upgrade**, because a schema migration on a new major version is one-way.

```bash
# backup
install -d /backups/adguard
cp /opt/adguardhome/conf/AdGuardHome.yaml \
   /backups/adguard/AdGuardHome-$(date +%F).yaml

# restore
docker compose stop adguardhome
cp /backups/adguard/AdGuardHome-2026-09-01.yaml \
   /opt/adguardhome/conf/AdGuardHome.yaml
docker compose start adguardhome
```

- **Stop the container before restoring.** AdGuard Home rewrites the file on shutdown and will overwrite whatever you just copied in.
- **Validate the YAML before restarting** (`docker run --rm -v ...` with any YAML linter, or `python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))"`), because a malformed config makes the service exit on boot and take DNS down with it.

## Interaction with a caching proxy such as lancache

- **Put AdGuard Home in front and forward CDN domains to lancache-dns.** Clients get one DNS server, ads stay blocked, and game CDN names still resolve to the cache.
- **Give the two services different IPs or different ports**, since both want UDP 53.

```yaml
dns:
  upstream_dns:
    - "[/steamcontent.com/]192.168.1.10"
    - "[/epicgames.com/]192.168.1.10"
    - "[/akamaihd.net/]192.168.1.10"
    - https://dns.quad9.net/dns-query
```

- **Exempt cache domains from filtering** if a blocklist ever shadows a CDN hostname; a blocked depot host looks like a corrupt download to the game client.

## Verification checklist

```bash
docker compose ps adguardhome                       # running, not restarting
dig @192.168.1.5 example.com +short                 # resolves
dig @192.168.1.5 doubleclick.net +short             # 0.0.0.0 or empty
dig @192.168.1.5 nas.home.arpa +short               # rewrite works
```

## References

- Official docs: https://adguard.com/kb/adguard-home/overview/
- Docker image: https://hub.docker.com/r/adguard/adguardhome
- Filter syntax: https://adguard.com/kb/general/dns-filtering-syntax/
- Hostlists registry: https://github.com/AdguardTeam/HostlistsRegistry
- Configuration reference: https://github.com/AdguardTeam/AdGuardHome/wiki/Configuration
