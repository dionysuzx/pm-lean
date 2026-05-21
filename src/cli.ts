#!/usr/bin/env node
import { ingestPm } from "./adapters/pm.js";
import { writeCatalog } from "./domain/record.js";
import { createDispatchBundle } from "./workflow/dispatch.js";
import { generateDummyRecords } from "./workflow/dummy.js";
import { deriveRecords } from "./workflow/derive.js";

type Args = Record<string, string | boolean>;

const parseArgs = (argv: string[]): { command: string; args: Args } => {
  const [command = "help", ...rest] = argv;
  const args: Args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = value;
      index += 1;
    }
  }
  return { command, args };
};

const stringArg = (args: Args, key: string, fallback: string): string =>
  typeof args[key] === "string" ? args[key] : fallback;

const optionalStringArg = (args: Args, key: string): string | undefined =>
  typeof args[key] === "string" ? args[key] : undefined;

const optionalNumberArg = (args: Args, key: string): number | undefined => {
  if (typeof args[key] !== "string") return undefined;
  const parsed = Number.parseInt(args[key], 10);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid number for --${key}: ${args[key]}`);
  return parsed;
};

const help = (): void => {
  console.log(`pm-lean commands

  ingest    --pm-root /path/to/pm --out out [--series acde] [--limit 5]
  derive    --out out
  backfill  --pm-root /path/to/pm --out out [--series acde] [--limit 25]
  dummy     --out out  (requires ENABLE_DUMMY_PIPELINE=true)
  manifest  --out out
  dispatch  --out out [--repo dionysuzx/forkcast-data --workflow data-pipeline.yml]
`);
};

const main = async (): Promise<void> => {
  const { command, args } = parseArgs(process.argv.slice(2));
  const outDir = stringArg(args, "out", process.env.PM_LEAN_OUT ?? "out");
  const pmRoot = stringArg(args, "pm-root", process.env.PM_ROOT ?? "/Users/lucy/fun/pm");

  switch (command) {
    case "ingest": {
      const records = await ingestPm({
        pmRoot,
        outDir,
        series: optionalStringArg(args, "series"),
        limit: optionalNumberArg(args, "limit")
      });
      console.log(`Ingested ${records.length} PM call records into ${outDir}`);
      break;
    }
    case "derive": {
      const records = await deriveRecords(outDir);
      console.log(`Derived ${records.length} call records in ${outDir}`);
      break;
    }
    case "backfill": {
      const ingested = await ingestPm({
        pmRoot,
        outDir,
        series: optionalStringArg(args, "series"),
        limit: optionalNumberArg(args, "limit")
      });
      const derived = await deriveRecords(outDir);
      console.log(`Backfilled ${ingested.length} PM calls and derived ${derived.length} records into ${outDir}`);
      break;
    }
    case "dummy": {
      const records = await generateDummyRecords(outDir);
      console.log(`Generated ${records.length} deterministic dummy records into ${outDir}`);
      break;
    }
    case "manifest": {
      const catalog = await writeCatalog(outDir);
      console.log(`Generated catalog with ${catalog.entries.length} records at ${outDir}/catalog.json`);
      break;
    }
    case "dispatch": {
      const path = await createDispatchBundle({
        outDir,
        repo: optionalStringArg(args, "repo") ?? process.env.FORKCAST_DATA_GITHUB_REPO,
        workflow: optionalStringArg(args, "workflow") ?? "data-pipeline.yml",
        dryRun: args["dry-run"] === true
      });
      console.log(`Prepared forkcast-data dispatch bundle at ${path}`);
      break;
    }
    default:
      help();
      if (command !== "help") process.exitCode = 1;
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
