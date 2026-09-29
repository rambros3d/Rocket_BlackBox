## 1. Edge-Case Diagnostic Implementation

- [x] 1.1 Implement `runEdgeCaseDiagnostics(Print& out)` in `src/imu_sensor.h` and `src/imu_sensor.cpp`.
- [x] 1.2 Implement parasitic bus discharge (pins forced LOW for 500 ms) and 72-clock recovery pulse train with triple STOP condition.
- [x] 1.3 Implement I2C General Call Software Reset (`0x00` + `0x06`) broadcast at 10 kHz.
- [x] 1.4 Implement hardware peripheral cross-check dynamically testing `Wire` (I2C0) on GPIO 2 and 1, followed by clean restoration of Bus 1.

## 2. CLI Integration & Execution

- [x] 2.1 Add option `[e]` to the diagnostic console menu in `src/main.cpp` to trigger the edge-case recovery suite.
- [x] 2.2 Compile and flash firmware to `/dev/ttyACM0`.
- [x] 2.3 Execute option `[e]` over serial and record definitive hardware response logs.
