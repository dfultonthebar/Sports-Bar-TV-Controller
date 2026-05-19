# dbx ZonePRO — Model Reference

## Source

- Installation Guide 640/640m/641/641m/1260/1260m: https://dbxpro.com/en-US/site_elements/zonepro-install-guide-english
- 1260/1261 User Manual: https://audiovias.com/descarga/272/dbx-manuales/7420/dbx-zonepro1260-1261-manual-de-usuario.pdf
- 640/641 User Manual: https://audiovias.com/descarga/272/dbx-manuales/7428/dbx-zone-pro-640-641-manual-de-usuario.pdf

## Family

| Model    | Inputs | Outputs / Zones | Ethernet | RS-232 | ZC Wall Panels |
|----------|--------|-----------------|----------|--------|----------------|
| 640      | 6      | 4               | —        | yes    | yes            |
| **640m** | 6      | 4               | **yes**  | yes    | yes            |
| 641      | 6      | 4               | —        | yes    | yes            |
| **641m** | 6      | 4               | **yes**  | yes    | yes            |
| 1260     | 12     | 6               | —        | yes    | yes            |
| **1260m**| 12     | 6               | **yes**  | yes    | yes            |
| 1261     | 12     | 6               | —        | yes    | yes            |
| **1261m**| 12     | 6               | **yes**  | yes    | yes            |

The trailing **`m`** designates Ethernet ("HiQnet-managed") variants.
Non-`m` units can only be reached via RS-232. **Holmgren and Lucky's
both run `m` variants** — use TCP 3804.

The 641/641m and 1261/1261m add automatic mic mixing and additional DSP
modules over the 640/1260; the wire protocol is identical.

## Scenes

> *"Up to 50 scenes can be stored in the ZonePRO unit. Scenes can be
> stored by clicking on the Store Scene button in the Unit view."* —
> 640 Installation Guide

A scene = all module parameter values + ZC-to-zone bindings. Scenes
recall via `0x9001` (protocol guide) or via ZC-3/ZC-4 wall panel scene
button.

## Configuration is flash-resident

A single configuration is loaded into the device by ZonePRO Designer
(this defines the modules, their object IDs, and the wiring between
them). The 50 scenes are all variants on top of that single
configuration. **Object IDs only become meaningful after the
configuration is flashed** — fresh-from-factory units have no
addressable processing objects to send SET messages to.

## Factory reset

Hard reset returns to Scene 1, Node Address 32, DHCP flag 0, IP
`169.254.2.2`. The "fresh TCP connection = transient failsafe-shift"
symptom (see protocol notes) appears related to this reset path.

## RS-232 wiring

DB9F, 57.6 kbps, 8N1, null-modem cabling (TX↔RX, GND↔GND). All
ZonePRO models — `m` and non-`m` — accept the same RS-232 framing.
