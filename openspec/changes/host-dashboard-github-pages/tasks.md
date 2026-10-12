## 1. Domain Configuration & Jekyll Setup

- [x] 1.1 Create `docs/CNAME` containing `blackbox.rambros3d.com`.
- [x] 1.2 Create empty `docs/.nojekyll` file to allow Vite static asset paths.
- [x] 1.3 Add a prominent banner and link to the live telemetry dashboard (`/dashboard/`) in `docs/index.md`.

## 2. Dashboard Build & Deployment Packaging

- [x] 2.1 Verify relative base path (`base: './'`) in `dashboard/vite.config.ts`.
- [x] 2.2 Add documentation link in `dashboard/src/components/layout/AppShell.tsx` leading back to `/`.
- [x] 2.3 Run production build (`npm run build`) in `dashboard/`.
- [x] 2.4 Deploy built bundle (`dashboard/dist/*`) into `docs/dashboard/`.

## 3. GitHub Actions Continuous Deployment Workflow

- [x] 3.1 Create `.github/workflows/deploy-pages.yml` workflow to automatically build `dashboard/` and deploy GitHub Pages on push to `main`.
- [x] 3.2 Verify workflow YAML syntax and permissions.

## 4. Verification

- [x] 4.1 Verify local static server rendering of `docs/dashboard/index.html`.
- [x] 4.2 Validate OpenSpec change compliance (`openspec validate host-dashboard-github-pages`).
