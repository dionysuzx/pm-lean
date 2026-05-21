import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildCatalog } from "../src/domain/record.js";
import { deriveRecords } from "../src/workflow/derive.js";
import { generateDummyRecords } from "../src/workflow/dummy.js";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  dirs.length = 0;
  delete process.env.ENABLE_DUMMY_PIPELINE;
});

const tempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "pm-lean-test-"));
  dirs.push(dir);
  return dir;
};

describe("manifest contract", () => {
  it("emits catalog entries and derived artifacts compatible with forkcast-data ingestion", async () => {
    process.env.ENABLE_DUMMY_PIPELINE = "true";
    const outDir = await tempDir();
    await generateDummyRecords(outDir, "2099-01-01T00:00:00.000Z");
    await deriveRecords(outDir, "2099-01-01T00:01:00.000Z");
    const catalog = await buildCatalog(outDir, "2099-01-01T00:02:00.000Z");

    expect(catalog.entries).toHaveLength(1);
    expect(catalog.entries[0]).toMatchObject({
      id: "dummy-acde/2099.01.01-1",
      kind: "call",
      dummy: true
    });
    const manifest = JSON.parse(
      await readFile(join(outDir, catalog.entries[0]!.manifestPath), "utf8")
    ) as { artifacts: Array<{ path: string; provenance: unknown }> };
    expect(manifest.artifacts.some((artifact) => artifact.path === "derived/pm-lean-summary.json")).toBe(true);
    expect(manifest.artifacts.every((artifact) => artifact.provenance)).toBe(true);
  });
});
