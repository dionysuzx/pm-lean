# pm-lean Runbook

## Local Legacy Backfill

```bash
npm install
npm run backfill -- --pm-root /Users/lucy/fun/pm --out out
npm run verify
npm run dispatch -- --out out --repo dionysuzx/forkcast-data --workflow data-pipeline.yml
```

Use `--series acde --limit 5` to run a small slice. This command is intentionally local-only compatibility for existing `.github/ACDbot/artifacts` trees. Scheduled production does not checkout `ethereum/pm` and does not commit generated assets to any PM master/main branch.

## Manual Fixture-Live Feed Cycle

This is the automated feed used until real meeting capture hands artifacts to `pm-lean` or directly to `forkcast-data`. It is not `dummy`; it is a production-shaped PM Lean source record with `source.type: "fixture-live"` and replacement metadata.

```bash
ENABLE_PM_LEAN_FIXTURE_FEED=true npm run live-fixture -- --out out --cycle 1
npm run derive -- --out out
npm run manifest -- --out out
npm run dispatch -- --out out --repo dionysuzx/forkcast-data --workflow data-pipeline.yml --feed-ref pm-lean-feed
```

The GitHub workflow publishes the accumulated `out/` tree to the `pm-lean-feed` branch, then dispatches `forkcast-data`. It does not update `main`, and it does not update upstream `ethereum/pm`.

## Manual Dummy Pipeline

```bash
ENABLE_DUMMY_PIPELINE=true npm run dummy -- --out out
npm run derive -- --out out
npm run manifest -- --out out
npm run dispatch -- --out out --dry-run
```

The generated data is visibly marked with `dummy: true` and `source.type: "dummy"`.

## Workflow Dispatch Inputs

- `source`: `fixture-live` or `dummy`
- `series`: optional PM call series such as `acde`
- `limit`: optional maximum calls for smoke runs
- `enable_dummy_pipeline`: explicit dummy guard
- `dispatch_forkcast_data`: whether to send a downstream GitHub workflow dispatch

Scheduled runs default to `fixture-live` every 30 minutes. To move from fixture-live to real data, keep the same feed contract and replace the generator behind the workflow with a real meeting-capture producer; do not reintroduce automated commits to upstream PM.

## Failure Policy

- Fixture-live runs fail unless `ENABLE_PM_LEAN_FIXTURE_FEED=true`; the workflow sets this explicitly.
- Dummy runs fail unless `ENABLE_DUMMY_PIPELINE=true`.
- Dispatch failures leave `out/dispatch/forkcast-data.json` on disk for manual handoff.
