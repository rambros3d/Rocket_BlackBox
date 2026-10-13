## ADDED Requirements

### Requirement: Custom Domain Configuration for Rocket BlackBox
The repository documentation and ground-station dashboard SHALL be served under the custom domain `blackbox.rambros3d.com` with HTTPS encryption enforced.

#### Scenario: CNAME resolution and HTTPS enforcement
- **WHEN** user visits `https://blackbox.rambros3d.com/`
- **THEN** GitHub Pages SHALL serve the project documentation from the `docs/` directory under a valid TLS certificate.

#### Scenario: Subfolder dashboard navigation
- **WHEN** user navigates to `https://blackbox.rambros3d.com/dashboard/`
- **THEN** GitHub Pages SHALL serve the telemetry dashboard with all assets loading relative to `/dashboard/`.
