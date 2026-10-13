## ADDED Requirements

### Requirement: Cross-Navigation Between Docs and Dashboard
The system SHALL provide seamless cross-navigation links between the root documentation (`/`) and the live telemetry dashboard (`/dashboard/`).

#### Scenario: Launch dashboard from documentation
- **WHEN** user views the documentation at `https://blackbox.rambros3d.com/`
- **THEN** a prominent call-to-action button or navigation link SHALL direct users to `/dashboard/`.

#### Scenario: Return to documentation from dashboard
- **WHEN** user views the telemetry dashboard at `https://blackbox.rambros3d.com/dashboard/`
- **THEN** a documentation link in the sidebar or header SHALL return the user to `/`.
