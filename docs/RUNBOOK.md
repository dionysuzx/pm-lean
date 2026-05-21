# pm-lean Runbook

## Manual Real Backfill

```bash
npm install
npm run backfill -- --pm-root /Users/lucy/fun/pm --out out
npm run verify
npm run dispatch -- --out out --repo dionysuzx/forkcast-data --workflow data-pipeline.yml
```

Use `--series acde --limit 5` to run a small slice.

## Manual Dummy Pipeline

```bash
ENABLE_DUMMY_PIPELINE=true npm run dummy -- --out out
npm run derive -- --out out
npm run manifest -- --out out
npm run dispatch -- --out out --dry-run
```

The generated data is visibly marked with `dummy: true` and `source.type: "dummy"`.

## Workflow Dispatch Inputs

- `source`: `pm`, `pm-lean`, or `dummy`
- `series`: optional PM call series such as `acde`
- `limit`: optional maximum calls for smoke runs
- `enable_dummy_pipeline`: explicit dummy guard
- `dispatch_forkcast_data`: whether to send a downstream GitHub workflow dispatch

## Failure Policy

- Missing PM artifacts fail real runs.
- Dummy runs fail unless `ENABLE_DUMMY_PIPELINE=true`.
- Dispatch failures leave `out/dispatch/forkcast-data.json` on disk for manual handoff.
