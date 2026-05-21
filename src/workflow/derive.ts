import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Artifact, MeetingRecord } from "../domain/types.js";
import {
  GENERATOR_NAME,
  GENERATOR_VERSION,
  listRecordManifests,
  nowIso,
  readJson,
  sha256Buffer,
  sha256File,
  upsertArtifact,
  writeCatalog,
  writeRecordManifest
} from "../domain/record.js";

const compactWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const readArtifactText = async (outDir: string, record: MeetingRecord, role: string): Promise<string | null> => {
  const artifact = record.artifacts.find((entry) => entry.role === role);
  if (!artifact) return null;
  return readFile(join(outDir, "records", "call", record.seriesSlug, `${record.date.replaceAll("-", ".")}-${record.number}`, artifact.path), "utf8");
};

const deriveSummary = async (outDir: string, record: MeetingRecord, generatedAt: string): Promise<MeetingRecord> => {
  const tldr = await readArtifactText(outDir, record, "tldr");
  const transcript = await readArtifactText(outDir, record, "transcript-corrected")
    ?? await readArtifactText(outDir, record, "transcript");
  const basis = compactWhitespace(tldr ?? transcript ?? record.title).slice(0, 900);
  const decisions = record.artifacts.some((entry) => entry.role === "tldr")
    ? ["Imported PM TLDR carries decision/action extraction where available."]
    : ["No PM TLDR was present; fixture summary generated from available transcript text."];
  const body = {
    schemaVersion: 1,
    recordId: record.id,
    title: record.title,
    summary: basis.length > 220 ? `${basis.slice(0, 220)}...` : basis,
    decisions,
    provenance: {
      generatedAt,
      generator: `${GENERATOR_NAME}/derive-summary`,
      generatorVersion: GENERATOR_VERSION,
      inputArtifactHashes: record.artifacts.map((entry) => entry.sha256).sort(),
      provider: "fixture",
      model: "deterministic-extractive"
    }
  };
  const json = `${JSON.stringify(body, null, 2)}\n`;
  const relativePath = "derived/pm-lean-summary.json";
  const target = join(outDir, "records", "call", record.seriesSlug, `${record.date.replaceAll("-", ".")}-${record.number}`, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, json);
  const info = await stat(target);
  const artifact: Artifact = {
    layer: "derived",
    role: "summary",
    path: relativePath,
    sha256: sha256Buffer(json),
    bytes: info.size,
    updatedAt: generatedAt,
    producedBy: `${GENERATOR_NAME}/derive-summary@${GENERATOR_VERSION}`,
    from: record.artifacts.map((entry) => entry.path),
    provenance: {
      source: "pm-lean",
      sourceHash: await sha256File(target),
      generatedAt,
      generator: `${GENERATOR_NAME}/derive-summary`,
      generatorVersion: GENERATOR_VERSION,
      provider: "fixture",
      model: "deterministic-extractive",
      inputHashes: record.artifacts.map((entry) => entry.sha256).sort()
    }
  };
  return upsertArtifact(record, artifact);
};

export const deriveRecords = async (outDir: string, generatedAt = nowIso()): Promise<MeetingRecord[]> => {
  const manifests = await listRecordManifests(outDir);
  const records: MeetingRecord[] = [];
  for (const manifest of manifests) {
    const record = await readJson<MeetingRecord>(manifest);
    const next = await deriveSummary(outDir, record, generatedAt);
    await writeRecordManifest(outDir, next);
    records.push(next);
  }
  await writeCatalog(outDir, generatedAt);
  return records;
};
