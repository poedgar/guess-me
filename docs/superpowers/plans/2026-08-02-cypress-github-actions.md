# Run Cypress Tests via GitHub Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A GitHub Actions workflow that runs the existing Cypress E2E suite automatically after a push to `main` that touches `apps/web/**`, without needing a human to remember to run it locally.

**Architecture:** A single workflow file, `.github/workflows/cypress-e2e.yml`. Since `apps/web/cypress.config.ts`'s `baseUrl` always points at the live deployment (`https://in-the-mirror.vercel.app`), the workflow never needs to build or serve the app itself — it installs dependencies, reconstructs the local, gitignored `cypress.env.json` at runtime from two GitHub Actions secrets, and runs the suite via the official `cypress-io/github-action`.

**Tech Stack:** GitHub Actions, `cypress-io/github-action@v6`, `actions/checkout@v4`, `actions/setup-node@v4`. No changes to any application or test code.

## Global Constraints

- This workflow must never contain, log, or otherwise expose the actual secret values. Secrets are only ever referenced via `${{ secrets.* }}` inside an `env:` block and consumed through the resulting shell environment variable (`$VAR_NAME`) — never interpolated with `${{ secrets.* }}` directly inside a `run:` script body, which is a known GitHub Actions injection risk if a secret's value ever contained shell metacharacters.
- `apps/web/cypress.env.json` is git-ignored (per an earlier plan) and must stay that way — this plan writes a fresh copy of it on the CI runner's ephemeral filesystem at run time; it must never be committed.
- The workflow's `concurrency` group must serialize runs (`cancel-in-progress: false`), not cancel an in-progress run — a cancelled mid-run Cypress process would skip its own cleanup task, which is exactly the failure mode the underlying Cypress plan's `before:run`/`after:run` sweep was built to prevent.
- Do not add a build/serve/wait-on step for the app itself — `cypress.config.ts`'s `baseUrl` already points at the live production deployment; the workflow only needs the repo checked out for the Cypress spec/support files themselves, not a running local server.
- Two GitHub repository secrets (`CYPRESS_TEST_PASSWORD`, `FIREBASE_SERVICE_ACCOUNT_JSON`) must exist before this workflow can succeed — adding them is a manual step for the project owner (see Task 1, Step 1) that cannot be automated by an agent.

---

## Task 1: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/cypress-e2e.yml`

**Interfaces:**
- None — this is a standalone CI configuration file with no code-level interface to other tasks (this is the only task in this plan).

- [ ] **Step 1: Confirm the two required secrets exist (manual, human action — do this yourself before or during this task, an agent cannot do it)**

In the GitHub repo's web UI: Settings → Secrets and variables → Actions → "New repository secret", add:

1. `CYPRESS_TEST_PASSWORD` — the current real password shared by the `test1`/`test2`/`test3` test accounts (the same value already in the local `apps/web/cypress.env.json`).
2. `FIREBASE_SERVICE_ACCOUNT_JSON` — paste the full, literal JSON contents of the already-downloaded service account key file (the same file whose local path is referenced in `apps/web/cypress.env.json` today).

If you're implementing this task as an agent and these secrets don't exist yet, stop and report this back rather than guessing — the workflow will not function without them, and there is no way for an agent to create them (no GitHub secrets API access, and secret values must never be requested from or typed by an agent).

- [ ] **Step 2: `.github/workflows/cypress-e2e.yml`**

```yaml
name: Cypress E2E Tests

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
  workflow_dispatch: {}

concurrency:
  group: cypress-e2e
  cancel-in-progress: false

jobs:
  cypress-run:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Write Firebase service account key
        env:
          SERVICE_ACCOUNT_JSON: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_JSON }}
        run: echo "$SERVICE_ACCOUNT_JSON" > "$RUNNER_TEMP/service-account.json"

      - name: Write cypress.env.json
        working-directory: apps/web
        env:
          TEST_PASSWORD: ${{ secrets.CYPRESS_TEST_PASSWORD }}
        run: |
          cat > cypress.env.json <<EOF
          {
            "testAccounts": {
              "test1": { "email": "test1@example.com", "password": "$TEST_PASSWORD" },
              "test2": { "email": "test2@example.com", "password": "$TEST_PASSWORD" },
              "test3": { "email": "test3@example.com", "password": "$TEST_PASSWORD" }
            },
            "firebaseServiceAccountPath": "${{ runner.temp }}/service-account.json"
          }
          EOF

      - name: Run Cypress
        uses: cypress-io/github-action@v6
        with:
          working-directory: apps/web
          install: false
          browser: chrome

      - name: Upload screenshots on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cypress-screenshots
          path: apps/web/cypress/screenshots
          if-no-files-found: ignore
```

Notes on specific choices, for whoever reviews or maintains this:
- `install: false` on the `cypress-io/github-action` step: the `npm ci` step above already installs `apps/web`'s `cypress` devDependency, and the `cypress` npm package's own postinstall hook downloads the Cypress binary as part of that — a second install step would be redundant.
- `browser: chrome`: Ubuntu GitHub-hosted runners have Chrome preinstalled; this avoids depending on the bundled Electron browser, which is more prone to environment-specific launch issues (as seen locally, though that specific issue was tied to a machine-specific environment variable, not something expected to recur here) and is less commonly used for CI Cypress runs than Chrome.
- `workflow_dispatch: {}` is included so this can be triggered manually from the Actions tab (useful for Step 4's verification, without needing a qualifying push).
- The screenshot upload step only runs `if: failure()` and only uploads screenshots (not videos, which aren't configured/needed here) — keeps artifact storage minimal while still giving a failed run something actionable to look at beyond the raw log.

- [ ] **Step 3: Verify the YAML is well-formed**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx js-yaml .github/workflows/cypress-e2e.yml > /dev/null && echo "Valid YAML"
```

(`js-yaml` ships as a transitive dependency already in `node_modules` via other tooling in this repo; if `npx js-yaml` isn't resolvable, `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/cypress-e2e.yml'))" && echo "Valid YAML"` is an equivalent fallback most machines have available.)

- [ ] **Step 4: Commit and push, then verify a real run**

```bash
git add .github/workflows/cypress-e2e.yml
git commit -m "$(cat <<'EOF'
Add GitHub Actions workflow to run Cypress E2E tests

Triggers on push to main when apps/web/** changes, plus manual
dispatch. Reconstructs the gitignored cypress.env.json at runtime
from two repo secrets (CYPRESS_TEST_PASSWORD,
FIREBASE_SERVICE_ACCOUNT_JSON) that must already exist — see the
plan's Task 1 Step 1. Concurrency-serialized (not cancelled) so two
runs can't collide over the shared test1 account's data mid-run.
EOF
)"
git push origin main
```

Since this commit touches `.github/workflows/**`, not `apps/web/**`, the push itself will NOT trigger the new workflow (per its own path filter) — use the manual `workflow_dispatch` trigger instead: in the GitHub repo's Actions tab, select "Cypress E2E Tests" from the left sidebar, click "Run workflow", select the `main` branch, and run it. Confirm the run appears, watch it through to completion, and confirm all 4 tests pass (matching what local runs have already shown) and that the `[cleanupTestGames:before:run]`/`[cleanupTestGames:after:run]` log lines appear in the "Run Cypress" step's output, the same way they do locally.

If the secrets from Step 1 are missing or wrong, this run will fail clearly (an auth error signing in, or a file-not-found error reading the service account) rather than silently — if that happens, double-check the two secret values in the GitHub UI rather than changing anything in the workflow file itself.
