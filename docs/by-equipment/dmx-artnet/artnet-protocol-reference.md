# Art-Net 4 Protocol Reference

**Source URLs:**
- https://art-net.org/ (Artistic Licence — protocol authors)
- https://artisticlicence.com/WebSiteMaster/User%20Guides/art-net.pdf (109-page official spec PDF, mirrored at https://art-net.org.uk/downloads/art-net.pdf)
- https://en.wikipedia.org/wiki/Art-Net
- Cross-referenced against https://en.wikipedia.org/wiki/DMX512 for the underlying DMX layer

**Fetched:** 2026-05-18

---

## What Art-Net Is

Art-Net is a UDP-based protocol for transporting DMX512-A lighting control and RDM data over standard Ethernet/IP networks. Created by Artistic Licence Engineering in 1998. It is **royalty-free** and the de-facto standard for IP-based lighting control alongside sACN/E1.31. The current revision is **Art-Net 4** (released 2016).

| Version | Year | Capability |
|---------|------|------------|
| Art-Net I | 1998 | Broadcast-heavy, ~40 universes practical |
| Art-Net II | — | Mostly unicast, 256 universes |
| Art-Net 3 | 2011 | Up to 32,768 universes |
| **Art-Net 4** | 2016 | 32,768 universes, >1000 ports per IP, full RDMnet/Net/Sub-Net/Universe addressing |

## Transport

- **UDP port:** **6454** (decimal) = **0x1936** (hex). Both source and destination.
- **Broadcast or unicast.** Discovery is broadcast (ArtPoll); streaming data after discovery should be unicast where the controller knows the node's IP.
- **No TCP**, no application-level retransmit, no ack. Data plane is fire-and-forget — packet loss is tolerated because the next refresh arrives ~22 ms later.
- **Max practical refresh rate:** ~44 Hz (limited by the 23 ms wire time of a full DMX512 frame, even though Art-Net itself is faster).

## Addressing (Port-Address)

Art-Net 4 uses a **15-bit Port-Address** that maps onto the underlying DMX universe space:

```
 Net (7 bits)  |  Sub-Net (4 bits)  |  Universe (4 bits)
 0..127        |  0..15             |  0..15
```

- **128 Nets × 16 Sub-Nets × 16 Universes = 32,768 total universes.**
- Each universe is one DMX512 stream: **512 channels × 1 byte (0-255) each.**
- Net is carried in the `Net` field; Sub-Net + Universe are packed into the `SubUni` byte (upper nibble = SubNet, lower nibble = Universe).

## OpCode Table

OpCodes are **16-bit little-endian** in the wire format. The common ones:

| OpCode (hex) | Name | Purpose |
|--------------|------|---------|
| `0x2000` | OpPoll | Controller discovery broadcast |
| `0x2100` | OpPollReply | Node response to OpPoll (announces capabilities, port-address) |
| `0x2300` | OpDiagData | Diagnostic text |
| `0x2400` | OpCommand | Text command (e.g. "SwoutText=Foo") |
| **`0x5000`** | **OpDmx / OpOutput** | **The main one — streams DMX data to a universe** |
| `0x5100` | OpNzs | Non-zero start code DMX (e.g. text, SIP) |
| `0x5200` | OpSync | Synchronizes multiple universes to update simultaneously |
| `0x6000` | OpAddress | Sets a node's Net/SubNet/Universe remotely |
| `0x7000` | OpInput | Disables/enables physical DMX inputs on a node |
| `0x8000` | OpTodRequest | RDM TOD (Table-of-Devices) request |
| `0x8100` | OpTodData | RDM TOD response |
| `0x8200` | OpTodControl | RDM TOD control |
| `0x8300` | OpRdm | RDM packet transport |
| `0x8400` | OpRdmSub | RDM subscription |
| `0x9900` | OpTrigger | Programmable trigger (timecode/macro) |
| `0x9A00` | OpDirectory | File-system browse on the node |
| `0xA010` | OpVideoSetup | Video setup |
| `0xF200` | OpFirmwareMaster | Firmware push |

For sending lighting data, **you only need OpDmx (0x5000)** plus optionally OpPoll/OpPollReply for discovery and OpSync to gang updates.

## ArtDmx Packet Structure (OpCode 0x5000)

The single most important packet — this is what carries DMX channel values to fixtures.

| Offset | Size | Field | Value / Notes |
|--------|------|-------|---------------|
| 0 | 8 | `ID` | ASCII `"Art-Net"` + `\0` (null terminator) — exactly 8 bytes |
| 8 | 2 | `OpCode` | `0x5000` **little-endian** (so wire bytes are `0x00 0x50`) |
| 10 | 2 | `ProtVer` | `0x000E` (= 14) big-endian, current protocol version |
| 12 | 1 | `Sequence` | 1-255 incrementing counter for packet ordering; 0 = disabled |
| 13 | 1 | `Physical` | Source DMX physical port (informational, 0-3) |
| 14 | 1 | `SubUni` | Low byte of Port-Address: upper nibble = SubNet, lower nibble = Universe |
| 15 | 1 | `Net` | High byte of Port-Address: bits 0-6 = Net (bit 7 = 0) |
| 16 | 2 | `Length` | DMX data length, **big-endian**, 2-512 (must be even, max 512) |
| 18 | N | `Data` | N DMX channel values, 1 byte each (0-255), N = `Length` |

**Total packet size:** 18 + Length bytes. For a full 512-channel frame: 530 bytes.

### Worked example: send R=255 G=0 B=0 to channels 1-3 of Net 0 SubNet 0 Universe 1

```
Bytes (hex):
41 72 74 2D 4E 65 74 00   "Art-Net\0"
00 50                      OpCode 0x5000 LE
00 0E                      ProtVer 14
01                         Sequence
00                         Physical
01                         SubUni = SubNet 0 | Universe 1
00                         Net 0
00 06                      Length = 6 (6 channels of payload)
FF 00 00 00 00 00          Channels 1-6: R=255, G=0, B=0, ch4-6=0
```

(Length must be even, so pad to 6 even though only 3 channels carry data.)

## ArtPoll / ArtPollReply Discovery Flow

1. Controller broadcasts `OpPoll` (0x2000) to 255.255.255.255:6454 (or directed broadcast on the lighting subnet).
2. Every Art-Net node on the subnet replies with `OpPollReply` (0x2100) containing its IP, MAC, ports, port-addresses, short/long name, status.
3. Controller builds a node table, then unicasts subsequent `OpDmx` packets to the specific node IPs that own each Port-Address.
4. Best practice: re-poll every 2.5-3 s; node entries time out after 6 s of no PollReply (per spec).

## ArtSync (OpCode 0x5200)

Sent **after** a burst of OpDmx packets to multiple universes. Tells all listening nodes to **simultaneously latch and output** their just-received DMX. Use for multi-universe synchronized chases or video-mapped LED walls.

Packet is 14 bytes: `ID` + `OpCode 0x5200 LE` + `ProtVer 0x000E` + `Aux1 0x00` + `Aux2 0x00`.

## Underlying DMX512 Constraints (Carried Over)

- 512 channels per universe, 1 byte (0-255) per channel.
- Start code `0x00` = standard DMX (lighting). Other start codes exist (text, SIP, RDM) — Art-Net's `OpNzs` (0x5100) carries non-zero start codes.
- Channel mapping is fixture-specific: an RGB par might be `ch1=R ch2=G ch3=B`; a moving head might be `ch1=pan ch2=tilt ch3=intensity ch4=zoom ...` — see the fixture's DMX profile.
- DMX is **stateless and uncorrected** — repeat the full frame ~30-44 times/sec to maintain output. If the controller stops sending, fixture behavior is undefined (most hold last value; some fade to black after timeout).

## Common Pitfalls

1. **Endianness:** OpCode is **little-endian**, but Length and ProtVer are **big-endian**. Mixing them up makes packets silently invalid (nodes drop without complaint).
2. **Port-Address packing:** `SubUni` is `(SubNet << 4) | Universe`, NOT just universe. Wrong shift → DMX lands on the wrong universe.
3. **Length must be even** (1-byte fix by padding with 0x00) — odd lengths violate spec and some nodes reject.
4. **Sequence is per-Port-Address, not per-socket** — each universe has its own counter.
5. **44 Hz max** — sending faster wastes bandwidth and can overflow DMX serializer on the node.
6. **Broadcast vs unicast:** broadcasting OpDmx works but eats every node's CPU. Always unicast in production.

## RDM (Remote Device Management) over Art-Net

Art-Net carries RDM (ANSI E1.20) bidirectionally via `OpTodRequest` / `OpTodData` / `OpRdm`. Lets a controller discover fixtures by UID, set DMX start address, query sensors, identify a fixture (flashing strobe) without physical access. Most production controllers (grandMA, Hog, ETC EOS) handle RDM transparently; custom integrations must implement the TOD (Table-of-Devices) round-trip themselves.

## References

- Art-Net 4 Specification PDF (Artistic Licence): https://art-net.org.uk/downloads/art-net.pdf
- Wikipedia Art-Net: https://en.wikipedia.org/wiki/Art-Net
- Wikipedia DMX512 (underlying layer): https://en.wikipedia.org/wiki/DMX512
- Implementation reference: libartnet (C), node-artnet (JS), python-artnet
