import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateDummyRecords } from "../src/workflow/dummy.js";

let dirs: string[] = [];

beforeEach(() => {
  process.env.ENABLE_DUMMY_PIPELINE = "true";
});

afterEach(async () => {
  delete process.env.ENABLE_DUMMY_PIPELINE;
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  dirs = [];
});

const tempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "pm-lean-test-"));
  dirs.push(dir);
  return dir;
};

describe("dummy pipeline", () => {
  it("is deterministic for a fixed generatedAt timestamp", async () => {
    const first = await tempDir();
    const second = await tempDir();
    await generateDummyRecords(first, "2099-01-01T00:00:00.000Z");
    await generateDummyRecords(second, "2099-01-01T00:00:00.000Z");

    const firstManifest = await readFile(
      join(first, "records/call/dummy-acde/2099.01.01-1/manifest.json"),
      "utf8"
    );
    const secondManifest = await readFile(
      join(second, "records/call/dummy-acde/2099.01.01-1/manifest.json"),
      "utf8"
    );
    expect(firstManifest).toEqual(secondManifest);
  });

  it("refuses to generate fake data unless explicitly enabled", async () => {
    delete process.env.ENABLE_DUMMY_PIPELINE;
    await expect(generateDummyRecords(await tempDir())).rejects.toThrow(/ENABLE_DUMMY_PIPELINE=true/);
  });
});
