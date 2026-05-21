import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildCatalog } from "../src/domain/record.js";
import { generateLiveFixtureRecords } from "../src/workflow/liveFixture.js";

const dirs: string[] = [];

beforeEach(() => {
  process.env.ENABLE_PM_LEAN_FIXTURE_FEED = "true";
});

afterEach(async () => {
  delete process.env.ENABLE_PM_LEAN_FIXTURE_FEED;
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  dirs.length = 0;
});

const tempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "pm-lean-live-fixture-test-"));
  dirs.push(dir);
  return dir;
};

describe("fixture-live feed", () => {
  it("emits deterministic production-shaped records for a fixed cycle", async () => {
    const first = await tempDir();
    const second = await tempDir();
    await generateLiveFixtureRecords(first, { cycle: 42, generatedAt: "2026-05-21T00:00:00.000Z" });
    await generateLiveFixtureRecords(second, { cycle: 42, generatedAt: "2026-05-21T00:00:00.000Z" });

    const path = "records/call/fixture-acde/2026.05.21-900042/manifest.json";
    expect(await readFile(join(first, path), "utf8")).toEqual(await readFile(join(second, path), "utf8"));
  });

  it("accumulates changing cycle records in one feed catalog", async () => {
    const outDir = await tempDir();
    await generateLiveFixtureRecords(outDir, { cycle: 1, generatedAt: "2026-05-21T00:00:00.000Z" });
    await generateLiveFixtureRecords(outDir, { cycle: 2, generatedAt: "2026-05-21T00:30:00.000Z" });
    const catalog = await buildCatalog(outDir, "2026-05-21T00:31:00.000Z");

    expect(catalog.entries.map((entry) => entry.id)).toEqual([
      "fixture-acde/2026.05.21-900001",
      "fixture-acde/2026.05.21-900002"
    ]);
    expect(catalog.entries.every((entry) => entry.dummy === false)).toBe(true);
  });

  it("is explicitly guarded from accidental generation", async () => {
    delete process.env.ENABLE_PM_LEAN_FIXTURE_FEED;
    await expect(generateLiveFixtureRecords(await tempDir(), { cycle: 1 })).rejects.toThrow(/ENABLE_PM_LEAN_FIXTURE_FEED=true/);
  });
});
