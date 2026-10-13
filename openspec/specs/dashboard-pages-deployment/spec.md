# Dashboard Pages Deployment Specification

## Purpose
Defines the automated build, packaging, and static asset distribution for hosting the React telemetry dashboard on GitHub Pages.

## Requirements

### Requirement: Dashboard Static Production Deployment
The system SHALL compile the React dashboard into static assets and place them inside `docs/dashboard/` with relative base path resolution.

#### Scenario: Production build and packaging
- **WHEN** the dashboard build workflow runs
- **THEN** it SHALL generate static bundles in `docs/dashboard/` containing `index.html`, bundled scripts, stylesheets, and 3D assets.

#### Scenario: Web Serial capability under HTTPS
- **WHEN** user loads `https://blackbox.rambros3d.com/dashboard/` in a supported browser (Chrome, Edge, Zen)
- **THEN** `navigator.serial` SHALL be accessible for direct Web Serial connections without mixed-content security blocks.
