## Why

The ground station telemetry dashboard (`dashboard/`) receives live rocket telemetry frames and modem link metrics, but does not display Received Signal Strength Indication (RSSI) and Signal-to-Noise Ratio (SNR) in the Devices tab's "Link Statistics" panel, leaving operators without real-time visibility into RF link budget and link degradation. Additionally, the dashboard still references the Bosch BME680 sensor (in the subsystems table and demo simulator), despite the physical hardware having isolated the BME680 (R26 desoldered on the PCB due to a pin short) and remapped barometric altimetry to the MS5607 and cabin humidity/temperature to the SCD40.

## What Changes

- **Add RSSI and SNR to Link Statistics**: In `dashboard/src/pages/DevicesPage.tsx`, display real-time RSSI (in dBm) and SNR (in dB) using the existing `latest.link.rssi` and `latest.link.snr` metrics from the telemetry store.
- **Retire BME680 from UI**: In `dashboard/src/pages/DevicesPage.tsx`, remove the obsolete `BME680` entry from the Subsystems table so it no longer appears as a false "Offline" sensor.
- **Clean Up Demo Simulation**: In `dashboard/src/lib/demo.ts`, remove `FLAG.BME680` from the simulated bitmask and update simulated environmental sources to `SCD40` (temperature and humidity) and `MS5607` (barometric pressure), matching real rocket flight firmware.
- **Wire and Type Cleanliness**: In `dashboard/src/lib/types.ts` and `dashboard/src/lib/protocol.ts`, clean up BME680 references while preserving wire protocol decoding safety.

## Capabilities

### New Capabilities
- `dashboard-telemetry-ui`: Covers the user interface display of RF link metrics (RSSI, SNR), packet statistics, and the active hardware subsystem status table in the ground station dashboard.

### Modified Capabilities
<!-- None: existing ground-station-lora-receiver spec governs modem hardware/firmware, not dashboard UI -->

## Impact

- **Affected subsystem**: `dashboard/` (website / ground-station frontend).
- **Files modified**:
  - `dashboard/src/pages/DevicesPage.tsx`
  - `dashboard/src/lib/demo.ts`
  - `dashboard/src/lib/types.ts`
  - `dashboard/src/lib/protocol.ts`
- **Firmware & Hardware**: No modifications required to `flight_firmware/` or PCB hardware.
