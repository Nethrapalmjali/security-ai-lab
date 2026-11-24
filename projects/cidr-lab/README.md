# CIDR Subnet Lab

An IPv4 subnet calculator and allow-list auditor that runs entirely in the browser.

**Live:** https://nethrapalmjali.github.io/security-ai-lab/projects/cidr-lab/

## Features
- **Subnet calculator** – network, netmask, wildcard, broadcast, host range, usable hosts, binary view, and classification (RFC 1918, CGNAT, loopback, link-local/cloud-metadata, TEST-NET, multicast, public). Handles /31 (RFC 3021) and /32.
- **Membership check** – is an IP inside the network?
- **Subnet splitter** – divide a block into smaller prefixes.
- **Range → CIDR** – minimal CIDR cover of an arbitrary start/end range.
- **Allow-list auditor + route summariser** – flags `0.0.0.0/0`, ranges broader than /8, huge public ranges, duplicates, redundant (covered) rules, host bits set, and invalid lines, then prints the minimal equivalent list.

## How it works
Addresses are unsigned 32-bit integers (`>>> 0`). A prefix `p` gives mask `0xffffffff << (32-p)`; the network is `ip & mask`. Two CIDRs are either nested or disjoint, so `relation()` compares first/last addresses. `rangeToCidrs` greedily takes the largest aligned block that fits; `summarize` sorts ranges, merges overlapping/adjacent ones and converts back to CIDRs. The parser rejects leading-zero octets, which some parsers read as octal (a classic SSRF/ACL-bypass vector).

## Concepts demonstrated
Network security hygiene (least-privilege allow-lists, over-permissive security groups), SSRF-relevant ranges (169.254.169.254, loopback, RFC 1918), route aggregation.

## Tests
`node projects/cidr-lab/test.mjs` (no dependencies).

## Limitations
IPv4 only. No IPv6, no DNS resolution, and the auditor is O(n²) so it is meant for lists of up to a few thousand rules.
