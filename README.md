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

Dummy data is deterministic and guarded by `ENABLE_DUMMY_PIPELINE=true`.

## Commands

```bash
npm install
npm run ingest -- --pm-root /Users/lucy/fun/pm --out out
npm run derive -- --out out
npm run backfill -- --pm-root /Users/lucy/fun/pm --out out
ENABLE_DUMMY_PIPELINE=true npm run dummy -- --out out
npm run manifest -- --out out
npm run dispatch -- --out out --dry-run
npm run verify
```

Equivalent `just` commands are available: `just ingest`, `just derive`, `just backfill`, `just dummy`, `just manifest`, `just dispatch`, and `just verify`.

## Output Contract

Every record manifest includes:

- canonical call ID: `{series-slug}/{yyyy.mm.dd}-{number}`
- source references for PM, GitHub issue, YouTube, and dummy fixtures where present
- raw, normalized, and derived artifact entries
- SHA-256 hashes and byte sizes
- generator name/version
- provenance for derived files

## Production Mode

Real ingestion reads PM artifacts from `/Users/lucy/fun/pm/.github/ACDbot/artifacts/manifest.json`.

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
