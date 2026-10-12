## Context

The repository `rambros3d/Rocket_BlackBox` has its documentation hosted at `https://rambros3d.github.io/Rocket_BlackBox/` served directly from the `docs/` folder via GitHub Pages. The user has registered DNS at Cloudflare with a CNAME record mapping `blackbox.rambros3d.com` to `rambros3d.github.io` (verified active).

The telemetry dashboard is an SPA located in `dashboard/` built with React, Vite, Tailwind, and Three.js. It needs to be hosted at `https://blackbox.rambros3d.com/dashboard/` while the documentation is hosted at `https://blackbox.rambros3d.com/`.

## Goals / Non-Goals

**Goals:**
- Bind `blackbox.rambros3d.com` as the primary custom domain for the repository's GitHub Pages.
- Deploy the production dashboard build into `docs/dashboard/` so that GitHub Pages serves both the documentation (`/`) and dashboard (`/dashboard/`) from a single repository.
- Ensure all relative assets (JS, CSS, 3D glTF models, fonts) load cleanly without 404s.
- Provide full Web Serial API connectivity under HTTPS.
- Create an automated CI/CD GitHub Actions workflow to build the dashboard and deploy pages on git push.

**Non-Goals:**
- Creating a separate second GitHub repository.
- Relying on Cloudflare Workers or external hosting servers.

## Decisions

### 1. Unified Directory Layout under `docs/`
- **Decision**: Place the built dashboard output inside `docs/dashboard/`.
- **Directory Structure**:
  ```
  docs/
  ├── CNAME             -> blackbox.rambros3d.com
  ├── .nojekyll         -> ensures folders/assets with special names are served
  ├── index.md          -> root documentation
  ├── assets/           -> docs images & schematics
  └── dashboard/        -> Vite production build
      ├── index.html
      ├── assets/
      └── models/
  ```
- **Rationale**: GitHub Pages serves whatever is inside `docs/` on the designated branch. Because `CNAME` is inside `docs/`, GitHub immediately recognizes `blackbox.rambros3d.com`.

### 2. HashRouter and Relative Base
- **Decision**: Maintain `<HashRouter>` in `dashboard/src/main.tsx` and `base: './'` in `dashboard/vite.config.ts`.
- **Rationale**: When users navigate routes (e.g. `/#/charts`, `/#/devices`), all route changes occur on the client side via URL hashes. GitHub Pages' static file server will never return 404 on page refreshes.

### 3. Jekyll `.nojekyll` Marker
- **Decision**: Add an empty `.nojekyll` file at `docs/.nojekyll`.
- **Rationale**: GitHub Pages runs Jekyll by default, which ignores folders or files starting with underscores (e.g. `_assets/`). While Vite by default uses `assets/`, `.nojekyll` prevents any Jekyll pipeline interference with Vite assets.

### 4. Continuous Deployment via GitHub Actions
- **Decision**: Provide `.github/workflows/deploy-pages.yml` with two jobs:
  1. Setup Node.js, `npm ci`, and `npm run build` in `dashboard/`.
  2. Copy `dashboard/dist/` into `docs/dashboard/` and deploy to GitHub Pages.

## Risks / Trade-offs

- **[Risk] SSL Certificate Issuance Delay** → **Mitigation**: Cloudflare CNAME must point directly to `rambros3d.github.io` with Proxy mode set to "DNS Only" (or Full Strict SSL in Cloudflare) so GitHub can verify ownership and issue the Let's Encrypt TLS certificate. DNS resolution was already confirmed active.
- **[Risk] Relative Link Breaks between Docs and Dashboard** → **Mitigation**: Use explicit links: in docs, add header link `[Launch Live Telemetry Dashboard](/dashboard/)`; in dashboard, link back to `[Docs](/)`.
