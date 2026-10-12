## ADDED Requirements

### Requirement: 3D Rocket Orientation Visualization Component
The dashboard SHALL provide an `<AttitudeRocket>` component powered by Three.js and `GLTFLoader` to render the textured 3D rocket model (`/models/rocket/scene.gltf`) with dynamic real-time orientation matching the payload 9-DOF IMU attitude.

#### Scenario: Successful rocket model rendering with attitude tracking
- **WHEN** the Overview or Snapshot dashboard page mounts with valid or simulated attitude data
- **THEN** the `<AttitudeRocket>` component SHALL render the textured rocket model, smoothly interpolate (`slerp`) rotation towards `targetQuaternion(roll, pitch, yaw)`, and display attitude reference gimbal rings (roll = green, pitch = blue, yaw = orange).

#### Scenario: Fallback during asset loading or fetch error
- **WHEN** the glTF model is asynchronously fetching or if the model asset fails to load
- **THEN** the component SHALL display a lightweight wireframe fallback geometry without throwing unhandled exceptions or crashing the dashboard page.

### Requirement: Unified Rocket View Replacement
The dashboard SHALL replace the procedural `<AttitudePlane>` in `OverviewDashboard.tsx` and the `<AttitudeCube>` in `SnapshotDashboard.tsx` with `<AttitudeRocket>`.

#### Scenario: Overview dashboard attitude panel
- **WHEN** user navigates to the Overview tab
- **THEN** the Attitude panel SHALL display the 3D rocket model with live roll, pitch, and yaw telemetry overlays.

#### Scenario: Snapshot dashboard orientation panel
- **WHEN** user navigates to the Snapshot tab
- **THEN** the Orientation panel SHALL display the 3D rocket model alongside digital Euler angle readouts.
