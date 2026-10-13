## Context

GitHub Pages serves content from the artifact uploaded during GitHub Actions deployment (`.github/workflows/deploy-pages.yml`). Currently, the workflow uploads the `docs/` folder containing `index.md`, `CNAME`, `.nojekyll`, and the subfolder `dashboard/` containing the compiled Vite telemetry application.

Because `docs/.nojekyll` is present and GitHub Actions directly publishes uploaded static artifacts rather than invoking Jekyll, `docs/index.md` is never transformed to HTML. Requests to the root domain `https://blackbox.rambros3d.com/` return HTTP 404 because GitHub Pages requires `index.html` at the root.

## Goals / Non-Goals

**Goals:**
- Provide a clean, standalone build script (`docs/build_docs.py`) that compiles `docs/index.md` into `docs/index.html` using GitHub Primer styling and Markdown formatting (tables, code blocks, alerts).
- Integrate documentation building into `.github/workflows/deploy-pages.yml` so that every deployment automatically compiles fresh documentation HTML before uploading the Pages artifact.
- Track `docs/index.html` in Git so the root page exists locally and immediately upon checkout.
- Ensure seamless cross-linking: the documentation prominently links to `/dashboard/`, and the dashboard links back to the documentation.

**Non-Goals:**
- Replacing Vite or React for the telemetry dashboard.
- Introducing a heavyweight external documentation framework (e.g. Docusaurus or MkDocs) when a lightweight Python markdown build script matches the existing `preview_docs.py` ecosystem.

## Decisions

### 1. Build script using Python `markdown`
- **Choice**: Implement `docs/build_docs.py` utilizing Python's `markdown` library with `tables`, `fenced_code`, and `codehilite` extensions, wrapping the rendered HTML in the GitHub Primer markdown stylesheet.
- **Rationale**: The project already relies on Python in `docs/preview_docs.py` and tools. It executes in milliseconds, requires zero complex Node toolchains beyond what Vite already uses, and guarantees visual parity with local preview.
- **Alternative considered**: Relying on Jekyll. Jekyll was intentionally disabled via `.nojekyll` to avoid mangling Vite's hashed asset folders (`_assets` or dotfiles) and to avoid Ruby dependencies in CI.

### 2. CI Pipeline Integration
- **Choice**: In `.github/workflows/deploy-pages.yml`, install Python's `markdown` package and execute `python3 docs/build_docs.py` prior to `actions/upload-pages-artifact@v3`.
- **Rationale**: Ensures any documentation edits pushed to `main` immediately update the deployed root `https://blackbox.rambros3d.com/` without requiring manual local build steps.

## Risks / Trade-offs

- **[Risk]**: Python `markdown` dependency missing in CI runner.
  - **Mitigation**: Add `pip install markdown` in `.github/workflows/deploy-pages.yml` setup step. Ubuntu runners have Python 3 pre-installed.
