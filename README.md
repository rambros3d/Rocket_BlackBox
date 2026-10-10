# Rocket BlackBox: Avionics & Flight Data Recorder

[![placeholder to be replaced with actual photo of payload](docs/assets/RAK3112-8-SM-I.png)](https://rambros3d.github.io/Rocket_BlackBox/)

### **Documentation:** [https://rambros3d.github.io/Rocket_BlackBox/](https://rambros3d.github.io/Rocket_BlackBox/)

**Rocket BlackBox** is an open-source avionics payload and flight data recorder (FDR) designed for model rocketry and sounding rocket flights. Powered by the **RAK3112** module (Espressif ESP32-S3 + Semtech SX1262 LoRa), the system captures multi-sensor environmental telemetry, high-precision barometric altitude, and GNSS position.

## Mission: DSRSLV (SINSME Foundation)

[![DSRSLV Phase 2](docs/assets/DSRSLV-P2.jpg)](https://www.sinsmefoundation.org/general-7-1)

Rocket BlackBox is developed for the **DSRSLV** sounding rocket initiative, spearheaded by the **[SINSME Foundation](https://www.sinsmefoundation.org/general-7-1)**.

The **DSRSLV Phase 2 (P2)** mission aims for an apogee of approximately 5 km, carrying student atmospheric payloads and flight instrumentation to foster hands-on space science and aerospace education.

🔗 **Mission Details:** [SINSME Foundation DSRSLV Project](https://www.sinsmefoundation.org/general-7-1)

---

## EasyEDA Educator Program

[![EasyEDA Educator Program](docs/assets/easyeda-educator-program.png)](https://easyeda.com/)

This project's PCB design, fabrication, and PCBA assembly were generously sponsored by the [EasyEDA Educator Program](https://easyeda.com/) and fabricated by [JLCPCB](https://jlcpcb.com/).

---

## Key Highlights

- **Avionics & RF Core**: RAK3112 module with dual-core ESP32-S3 (240 MHz, 16MB Flash, 8MB PSRAM) and Semtech SX1262 LoRa transceiver for long-range telemetry.
- **Redundant Dual Storage**:
  - **12MB Internal SPI Flash (`/ffat`)**: Wear-leveling partition with composite USB MSC support (mounts as a USB flash drive).
  - **4-bit SDMMC MicroSD**: High-throughput card slot for high-rate flight logging.
- **Multi-Sensor Array (Dual I2C Buses)**:
  - **Flight Altimeter**: MS5607 (24-bit $\Delta\Sigma$ ADC, ~20 cm altitude resolution).
  - **Environmental & Cabin**: Sensirion SCD40 (NDIR CO₂, RH, Temperature) and SGP41 (VOC & NOₓ indices).
  - **Optical & Motion**: TSL25911 dual-channel lux/IR sensor and Bosch BNO055 9-DOF orientation IMU.
- **GNSS & Time Sync**: Beitian BE-166 receiver with hardware 1PPS timing line for sub-microsecond timestamping.
- **Power Subsystem**: Push-button soft-latch power controller with Texas Instruments BQ24075 USB/LiPo battery management.

---

## Ground Station Dashboard

[`dashboard/`](dashboard/) is a React + Vite + Tailwind CSS web app (Antariksha India branding) that runs on the ground PC with a **Waveshare USB-TO-LoRa-HF** receiver plugged in. It talks to the dongle over Web Serial, configures it with AT commands, decodes the payload's LoRa frames and sends uplink commands (ping, start/stop flash logging). It can also connect directly to the payload over USB for bench testing, or run on simulated data.

Pages: Dashboard (snapshot and overview layouts), Live Data, Map View with path playback, Charts, Alerts, Devices (link setup + serial console), Export (CSV / JSON / GPX / KML) and Settings.

```bash
cd dashboard
npm install
npm run dev      # http://localhost:5173 — open in Chrome or Edge (Web Serial)
npm run build    # static build in dashboard/dist
```

Flash the payload with the v2 telemetry firmware (`pio run -e rocket_payload_telemetry -t upload`, see [flight_firmware/README.md](flight_firmware/README.md)). The existing [test_firmware/](test_firmware/) project remains the diagnostic image.

---

## Detailed Resources

- 🌐 [Live Documentation Site](https://rambros3d.github.io/Rocket_BlackBox/)
- 📊 [Ground Station Dashboard](dashboard/)
- 📄 [Electrical Schematic PDF](pcb/Payload_Schematic.pdf)
- 📌 [Hardware Pinout Reference](flight_firmware/pinout.md)
- 📐 [3D Mechanical Models](mechanical/)
