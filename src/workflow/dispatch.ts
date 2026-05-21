import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { buildCatalog, nowIso, writeJson } from "../domain/record.js";

export interface DispatchOptions {
  outDir: string;
  repo?: string | undefined;
  workflow?: string | undefined;
  feedRepo?: string | undefined;
  feedRef?: string | undefined;
  feedPath?: string | undefined;
  dryRun?: boolean | undefined;
}

export const createDispatchBundle = async (options: DispatchOptions): Promise<string> => {
  const catalog = await buildCatalog(options.outDir);
  const path = join(options.outDir, "dispatch", "forkcast-data.json");
  await mkdir(join(options.outDir, "dispatch"), { recursive: true });
  await writeJson(path, {
    schemaVersion: 1,
    createdAt: nowIso(),
    source: "pm-lean",
    catalogPath: "catalog.json",
    feed: {
      repo: options.feedRepo ?? "dionysuzx/pm-lean",
      ref: options.feedRef ?? "pm-lean-feed",
      path: options.feedPath ?? "catalog.json"
    },
    records: catalog.entries.map((entry) => entry.id),
    dummy: catalog.entries.some((entry) => entry.dummy)
  });

  if (!options.dryRun && options.repo && options.workflow) {
    const result = spawnSync(
      "gh",
      [
        "workflow",
        "run",
        options.workflow,
        "-R",
        options.repo,
        "-f",
        "source=pm-lean",
        "-f",
        "force_rebuild=true",
        "-f",
        `pm_lean_bundle=github:${options.feedRepo ?? "dionysuzx/pm-lean"}@${options.feedRef ?? "pm-lean-feed"}:${options.feedPath ?? "catalog.json"}`
      ],
      { encoding: "utf8" }
    );
    if (result.status !== 0) {
      throw new Error(`gh workflow dispatch failed: ${result.stderr || result.stdout}`);
    }
  }

  return path;
};
