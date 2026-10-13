## ADDED Requirements

### Requirement: Documentation Static Root HTML Generation
The system SHALL compile `docs/index.md` into static `docs/index.html` and package it at the root of the GitHub Pages artifact so that the root domain `https://blackbox.rambros3d.com/` resolves with HTTP 200.

#### Scenario: Documentation HTML generation
- **WHEN** the GitHub Pages deployment workflow executes or `docs/build_docs.py` is run
- **THEN** it SHALL compile `docs/index.md` into `docs/index.html` with responsive styles, markdown tables, code syntax highlighting, and cross-links to `/dashboard/`.

#### Scenario: Root URL HTTP 200 resolution
- **WHEN** user loads `https://blackbox.rambros3d.com/` in a web browser
- **THEN** GitHub Pages SHALL return `docs/index.html` with status code 200 instead of a 404 error.
