# Run Cypress Tests via GitHub Actions

**Date:** 2026-08-02
**Scope:** repo-level CI configuration (`.github/workflows/`) plus a small addition to `apps/web`'s Cypress config to read credentials from environment variables when present. No changes to the tests themselves or to the app.

## Problem

The Cypress E2E suite (added in an earlier plan) only runs when someone manually invokes it locally. The design spec for that earlier plan explicitly deferred CI wiring as a fast follow-up. This is that follow-up: run the suite automatically in GitHub Actions after relevant pushes to `main`, without needing a human to remember to run it.

## Behavior

**Trigger:** a new workflow runs on `push` to `main`, filtered to only fire when files under `apps/web/**` change (via GitHub's `paths` filter) — a commit that only touches `apps/expo` or documentation does not trigger a run. This repo does not use pull requests today (everything is pushed directly to `main`), so there is no PR-triggered variant of this workflow.

**Concurrency:** the workflow declares a `concurrency` group (e.g. `cypress-e2e`) with `cancel-in-progress: false`, so if a second qualifying push lands while a run is still in progress, the second run queues behind the first rather than starting in parallel. This matters specifically because the suite's cleanup task deletes every game owned by the shared `test1` test account — two overlapping runs would each be creating and deleting games under the same identity, and could delete a game the other run is still mid-way through using.

**Job steps:** checkout, set up Node (matching the version used locally, `22.x`), `npm ci` at the repo root (monorepo workspace install), reconstruct `apps/web/cypress.env.json` at runtime from two GitHub Actions secrets (see Secrets below) plus a service-account key file written to the runner's temp directory, then run the suite via the official `cypress-io/github-action` (handles Cypress binary caching and installation itself — the binary problems hit during local development this session were specific to that machine's sandbox, not something expected to recur on a clean GitHub-hosted runner).

**Failure visibility:** relies on GitHub Actions' own default behavior (a red X in the Actions tab, a notification email to whoever pushed the failing commit) — no additional Slack/Discord/webhook integration, since none exists in this project today and none was asked for.

## Secrets (manual setup — cannot be done by an agent)

Two repository secrets, added by the project owner via GitHub's web UI (Settings → Secrets and variables → Actions → New repository secret), never pasted into any AI conversation or committed to the repo:

- `CYPRESS_TEST_PASSWORD` — the shared password for the `test1`/`test2`/`test3` test accounts (the same value already sitting in the local, gitignored `apps/web/cypress.env.json`).
- `FIREBASE_SERVICE_ACCOUNT_JSON` — the full JSON contents of the already-downloaded Firebase service account key file (the same file whose local path is referenced in `apps/web/cypress.env.json` today; in CI there is no such local file, so the actual JSON content itself is stored as the secret, and the workflow writes it out to a file on the runner at run time).

The workflow step that constructs `cypress.env.json` writes:

```json
{
  "testAccounts": {
    "test1": { "email": "test1@example.com", "password": "<CYPRESS_TEST_PASSWORD>" },
    "test2": { "email": "test2@example.com", "password": "<CYPRESS_TEST_PASSWORD>" },
    "test3": { "email": "test3@example.com", "password": "<CYPRESS_TEST_PASSWORD>" }
  },
  "firebaseServiceAccountPath": "<runner-temp-path>/service-account.json"
}
```

This file is written fresh on every run, inside the ephemeral runner's filesystem — it never touches the repo and is discarded when the job finishes.

## Out of Scope

- Per-run test-data isolation (separate test accounts or a run-scoped identifier so concurrent runs can't collide) — the `concurrency` group above serializes runs instead, which is a cheaper mitigation sufficient for this project's actual push frequency. True isolation is future work if this workflow is ever parallelized.
- Any change to the tests themselves, the app, or the existing `cleanupTestGames` logic.
- PR-triggered runs (this repo doesn't use PRs).
- Notification integrations beyond GitHub's own defaults.
- Rotating the test-account password or the service-account key as part of this work — this plan documents using whatever the current real values already are.
