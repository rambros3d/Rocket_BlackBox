## Why

The Rocket BlackBox project documentation is currently hosted at `https://rambros3d.github.io/Rocket_BlackBox/`, while the ground-station telemetry dashboard is only runnable locally on Vite dev server. Operators, field technicians, and ground station teams need the live dashboard deployed over secure HTTPS alongside the documentation at custom domain `https://blackbox.rambros3d.com/` (docs) and `https://blackbox.rambros3d.com/dashboard/` (telemetry dashboard).

Because modern web browsers require a Secure Context (`https://`) to access the Web Serial API (`navigator.serial`) for communication with the Waveshare LoRa dongle and rocket payload, hosting the dashboard on GitHub Pages under the custom domain provides plug-and-play field access from any laptop without local node/npm installation.

## What Changes

- **Custom Domain Integration (`docs/CNAME`)**:
  - Add `docs/CNAME` configured with `blackbox.rambros3d.com` to bind the repository's GitHub Pages to the Cloudflare DNS CNAME record.
  - Add `docs/.nojekyll` to prevent Jekyll from ignoring Vite build asset folders containing underscores or special symbols.

- **Dashboard Deployment Directory (`docs/dashboard/`)**:
  - Build the React + Vite dashboard with production optimization.
  - Deploy the production bundle to `docs/dashboard/` with root `index.html` and bundled assets.
  - Ensure links to documentation from the dashboard and links to the dashboard from documentation (`docs/index.md`) are properly interconnected.

- **Automated CI/CD Workflow (`.github/workflows/deploy-pages.yml`)**:
  - Implement a GitHub Actions workflow that automatically builds the dashboard and publishes both the Jekyll docs and dashboard static bundle to GitHub Pages on every push to `main`.

## Capabilities

### New Capabilities
- `dashboard-pages-deployment`: Automated build and hosting of the telemetry dashboard under GitHub Pages at `/dashboard/` with Web Serial HTTPS support.
- `custom-domain-blackbox`: Custom domain configuration linking `blackbox.rambros3d.com` to docs root and dashboard path.

### Modified Capabilities
- `dashboard-telemetry-ui`: Support path-relative routing and navigation links between documentation and ground-station views.

## Impact

- **Repository**:
  - `docs/CNAME`: Custom domain binding.
  - `docs/.nojekyll`: Disables Jekyll preprocessing for static assets.
  - `docs/dashboard/`: Static dashboard production build.
  - `docs/index.md`: Cross-links to live web dashboard.
  - `.github/workflows/deploy-pages.yml`: Automated GitHub Pages build & deployment pipeline.
