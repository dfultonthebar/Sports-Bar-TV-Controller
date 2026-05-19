# Crestron — AtlasIED Atmosphere v1.0 Command Processor

**Source:** https://applicationmarket.crestron.com/content/Help/Control_Concepts/AtlasIED%20Atmosphere%20v1.0%20Command%20Processor%20Help.pdf
**Partner:** AtlasIED
**Model:** Atmosphere (AZM4 / AZM8)
**Device Type:** Digital Signal Processor
**Revision History:** v1.0 — Initial Release

Useful third-party reference — confirms protocol behavior + module architecture for the Atmosphere processor as seen by a Crestron integrator. Not authoritative protocol spec (see `AZM4-AZM8-third-party-control-protocol.md` for that), but corroborates protocol features and adds operational notes.

---

## General Information

| Field | Value |
|---|---|
| SIMPL Windows Name | AtlasIED Atmosphere v1.0 Command Processor |
| Category | DSP |
| Version | 1.0 |

### Summary

This module controls TCP/IP communication with an Atmosphere AZM4 or AZM8 audio processor (henceforth referred to as "device"). This module acts as the primary communication link to a particular device. Multiple instances of this module can be included in the Crestron program to communicate with different devices on the network.

Up to **32 instances** of this module can be used in a single program slot. The module has a parameter that allows you to choose one of the 32 instance IDs. Each instance ID can only be used once per program. The other modules in this suite are control modules. The control modules are responsible for providing the actual control interface in SIMPL. With the SIMPL# technology, the control modules no longer need to be physically "connected" to the command processor. They register themselves automatically behind the scenes. Each of the control modules also have a command processor ID parameter that you assign to the instance of the command processor to which they report to. You can have a virtually unlimited number of control modules report to a single instance of a command processor.

Two `.azm` files (`Demo_Config_AZM4.azm` / `Demo_Config_AZM8.azm`) have been created for Crestron testing purposes. The `.azm` file corresponding to your device model MUST be loaded to the device for proper operation of the demo program. Note if your device is an AZM4, you will need to change the Parameter Index of the included Mix component to 8 instead of 14.

### General Notes (operational)

- Once the processing module has determined that it is communicating with the device, it will initialize any individual control modules that are registered to it. Once a control module receives all the responses it is looking for, it will instruct the processing module that its initialization has been completed.
- The processing module will then request the next control module's initialization. Once all control modules are initialized, the `Is_Initialized` output on the processing module will go high. At this point, you will have full control of all functionality on the registered control modules.
- Because of the multi-module design, you can cause a lot of traffic on your system by triggering many input signals at the same time. **If you have a lot of input signals to trigger at one time, be sure to pace the triggering of the signals allowing the controller to deal with the traffic.**
- Keep in mind the modules, during the initialization process, will get the current state of each of your control points, so you do not need to duplicate this effort.
- If you have to put the control points into a default state for various room configurations, **it is best to use the scene/routine feature built into the device. Trying to automate a scene/routine using SIMPL logic will add a lot of traffic on your system, and may cause adverse effects.**
- You should wait for any and all processing modules to set `Is_Initialized` to high before attempting to control the device.
- You may need to enable the Third Party Device control API on the device in order for control to work. To do this, navigate to **Settings → Third Party Control → General** and toggle the Enable switch on.

> **Cross-reference for this codebase:** the advice "use a Scene rather than scripting individual control points to reach a known state" matches our use of `RecallScene_1` for dbx ZonePRO failsafe-mode escape. The "pace triggers, lots of inflight messages cause traffic problems" advice matches why we batch parameter `set` operations into single JSON-RPC array messages (see protocol doc §3.3).

---

## Crestron Hardware

| Field | Value |
|---|---|
| Crestron Hardware Required | Crestron 3-Series & 4-series processors ONLY |
| Setup of Crestron Hardware | N/A |
| Vendor Firmware | N/A |
| Vendor Setup | N/A (other than enabling Third Party Control on the AZM) |

---

## Parameters

| Parameter | Description |
|---|---|
| `Command_Processor_ID` | ID for a particular processing module. Each processing module controls a single device. Up to 32 separate processing modules may be used in a single program, each one operating independently. Must be unique. |
| `IP_Address` | IP address of the AZM. |

---

## Control Signals (SIMPL input)

| Signal | Type | Description |
|---|---|---|
| `Connect` | D | Establish communication with the device on the rising edge of this signal. Connection automatically occurs upon program start. |
| `Disconnect` | D | Break communication with the device on the rising edge of this signal. |
| `Reinitialize` | D | Re-establish communication — effectively disconnect then connect. Initialization automatically occurs upon connection. |
| `Enable_Debug` | D | Enable internal trace messages in SIMPL Debugger. **Recommended to leave low** unless actively debugging — causes much additional signal traffic. |
| `Enable_Passback` | D | Enable passback functionality. If enabled, all responses from the Atmosphere processor will be sent out of the `Passback` feedback signal. Useful for extending module functionality / debugging. |
| `Passthru` | S | Send commands manually to the device. Any serial data input on this signal will be added to the module's internal command queue and sent to the device. Useful for troubleshooting, sending test commands, or extending control functionality to commands supported by the device but not supported by the module. |

---

## Feedback Signals (SIMPL output)

| Signal | Type | Description |
|---|---|---|
| `Is_Communicating` | D | High once communication has been established. Module will attempt to initialize automatically once communicating. |
| `Is_Initialized` | D | High when all registered control modules have indicated successful initialization. Wait for this before sending control commands. |
| `Is_Debug_Enabled` | D | Reflects current debug-enabled state. |
| `Is_Passback_Enabled` | D | Reflects current passback-enabled state. |
| `Passback` | S | Last serial response received from the device, if `Is_Passback_Enabled` is high. |

---

## Testing

| Field | Value |
|---|---|
| OPS used for testing | CP3: 1.8001.4666.20418, MC4: 2.7000.00031 |
| SIMPL Windows used for testing | 4.1800.14 |
| CRES DB used for testing | 210.0500.001.00 |
| Device Database | 200.14000.001.00 |
| Symbol Library | 1156 |
| Sample Program | AtlasIED Atmosphere v1.0 Demo IP CP3 |
| Revision History | v1.0 – Initial Release |
