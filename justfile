set dotenv-load := true

out := env_var_or_default("PM_LEAN_OUT", "out")
pm_root := env_var_or_default("PM_ROOT", "/Users/lucy/fun/pm")

install:
    npm install

ingest:
    npm run ingest -- --pm-root {{pm_root}} --out {{out}}

derive:
    npm run derive -- --out {{out}}

backfill:
    npm run backfill -- --pm-root {{pm_root}} --out {{out}}

dummy:
    ENABLE_DUMMY_PIPELINE=true npm run dummy -- --out {{out}}

manifest:
    npm run manifest -- --out {{out}}

dispatch:
    npm run dispatch -- --out {{out}}

verify:
    npm run verify
