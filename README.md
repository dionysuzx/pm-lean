# pm-lean

`pm-lean` is a lean, typed prototype for producing Ethereum PM meeting artifacts that `forkcast-data` can ingest as source-close records.

It preserves the existing PM asset shapes where they exist (`transcript.vtt`, `chat.txt`, `transcript_corrected.vtt`, `transcript_changelog.tsv`, `tldr.json`) and writes them into the shared Forkcast/Octobus record layout:

```text
out/
  catalog.json
  records/call/<series>/<yyyy.mm.dd>-<number>/
    manifest.json
    raw/
    normalized/
    derived/
```

`fixture-live` data is deterministic, production-shaped, and clearly marked in provenance. It exists to keep the whole platform alive until real meeting capture hands artifacts to this feed or directly to `forkcast-data`. Old dummy smoke data remains separate and guarded by `ENABLE_DUMMY_PIPELINE=true`.

## Commands

```bash
npm install
npm run ingest -- --pm-root /Users/lucy/fun/pm --out out
npm run derive -- --out out
npm run backfill -- --pm-root /Users/lucy/fun/pm --out out
ENABLE_PM_LEAN_FIXTURE_FEED=true npm run live-fixture -- --out out --cycle 1
ENABLE_DUMMY_PIPELINE=true npm run dummy -- --out out
npm run manifest -- --out out
npm run dispatch -- --out out --dry-run
npm run verify
```

Equivalent `just` commands are available: `just ingest`, `just derive`, `just backfill`, `just dummy`, `just manifest`, `just dispatch`, and `just verify`.

## Output Contract

Every record manifest includes:

- canonical call ID: `{series-slug}/{yyyy.mm.dd}-{number}`
- source references for PM, GitHub issue, YouTube, fixture-live, and dummy fixtures where present
- raw, normalized, and derived artifact entries
- SHA-256 hashes and byte sizes
- generator name/version
- provenance for derived files

## Production Mode

The scheduled GitHub Action runs every 12 hours. Its default and only non-dummy scheduled source is `fixture-live`, which appends one changing, production-shaped PM record to the repo-backed `pm-lean-feed` branch and dispatches `forkcast-data`.

`pm-lean` does not commit generated artifacts to `ethereum/pm` or to this repository's `main` branch. The feed branch is the handoff contract. Future real PM assets should either be emitted into the same feed shape or written directly into `forkcast-data` records. The local `ingest` and `backfill` commands remain as a compatibility bridge for existing `.github/ACDbot/artifacts` checkouts while legacy data is being migrated.

Fake data never runs by default. Any workflow or local command that creates fake artifacts must set:

```bash
ENABLE_DUMMY_PIPELINE=true
```

## Required Production Secrets

`pm-lean` itself can ingest committed PM artifacts without secrets. Real upstream asset generation still needs the PM-side credentials:

- `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_REFRESH_TOKEN`
- `YOUTUBE_API_KEY`, `YOUTUBE_REFRESH_TOKEN`, Google OAuth credentials
- optional LLM provider keys such as `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
- `FORKCAST_DATA_DISPATCH_TOKEN` or a GitHub token that can dispatch `forkcast-data`

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for rerun details.
