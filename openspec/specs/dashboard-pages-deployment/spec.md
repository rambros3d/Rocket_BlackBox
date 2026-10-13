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

### Requirement: Documentation Static Root HTML Generation
The system SHALL compile `docs/index.md` into static `docs/index.html` and package it at the root of the GitHub Pages artifact so that the root domain `https://blackbox.rambros3d.com/` resolves with HTTP 200.

#### Scenario: Documentation HTML generation
- **WHEN** the GitHub Pages deployment workflow executes or `docs/build_docs.py` is run
- **THEN** it SHALL compile `docs/index.md` into `docs/index.html` with responsive styles, markdown tables, code syntax highlighting, and cross-links to `/dashboard/`.

#### Scenario: Root URL HTTP 200 resolution
- **WHEN** user loads `https://blackbox.rambros3d.com/` in a web browser
- **THEN** GitHub Pages SHALL return `docs/index.html` with status code 200 instead of a 404 error.

