import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type {
  Artifact,
  ArtifactLayer,
  ArtifactRole,
  Catalog,
  MeetingRecord,
  Provenance,
  SourceRef
} from "./types.js";

export const GENERATOR_NAME = "pm-lean";
export const GENERATOR_VERSION = "0.1.0";

export const nowIso = (): string => new Date().toISOString();

export const sha256Buffer = (buffer: Buffer | string): string =>
  createHash("sha256").update(buffer).digest("hex");

export const sha256File = async (path: string): Promise<string> =>
  sha256Buffer(await readFile(path));

export const toCanonicalDate = (date: string): string => date.replaceAll("-", ".");

export const callId = (seriesSlug: string, date: string, number: number): string =>
  `${seriesSlug}/${toCanonicalDate(date)}-${number}`;

export const recordDir = (outDir: string, record: Pick<MeetingRecord, "seriesSlug" | "date" | "number">): string =>
  join(outDir, "records", "call", record.seriesSlug, `${toCanonicalDate(record.date)}-${record.number}`);

export const manifestPath = (outDir: string, record: Pick<MeetingRecord, "seriesSlug" | "date" | "number">): string =>
  join(recordDir(outDir, record), "manifest.json");

export const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, "utf8")) as T;

export const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

export const ensureLayerDirs = async (baseDir: string): Promise<void> => {
  await mkdir(join(baseDir, "raw"), { recursive: true });
  await mkdir(join(baseDir, "normalized"), { recursive: true });
  await mkdir(join(baseDir, "derived"), { recursive: true });
};

export const artifactRoleForPmResource = (resource: string): { layer: ArtifactLayer; role: ArtifactRole } => {
  switch (resource) {
    case "transcript":
      return { layer: "raw", role: "transcript" };
    case "chat":
      return { layer: "raw", role: "chat" };
    case "transcript_corrected":
      return { layer: "normalized", role: "transcript-corrected" };
    case "changelog":
      return { layer: "normalized", role: "transcript-changelog" };
    case "summary":
      return { layer: "derived", role: "summary" };
    case "tldr":
      return { layer: "derived", role: "tldr" };
    default:
      return { layer: "raw", role: "call-notes" };
  }
};

export const copyArtifact = async (args: {
  sourcePath: string;
  recordBaseDir: string;
  resourceName: string;
  resourceFile: string;
  generatedAt: string;
  sourceRef: string;
}): Promise<Artifact> => {
  const { layer, role } = artifactRoleForPmResource(args.resourceName);
  const targetRelativePath = join(layer, args.resourceFile);
  const targetPath = join(args.recordBaseDir, targetRelativePath);
  await mkdir(dirname(targetPath), { recursive: true });
  await cp(args.sourcePath, targetPath, { force: true });
  const fileStat = await stat(targetPath);
  const hash = await sha256File(targetPath);
  const provenance: Provenance = {
    source: "pm",
    sourcePath: args.sourcePath,
    sourceHash: hash,
    generatedAt: args.generatedAt,
    generator: GENERATOR_NAME,
    generatorVersion: GENERATOR_VERSION
  };
  return {
    layer,
    role,
    path: targetRelativePath,
    sha256: hash,
    bytes: fileStat.size,
    updatedAt: fileStat.mtime.toISOString(),
    source: args.sourceRef,
    provenance
  };
};

export const upsertArtifact = (record: MeetingRecord, artifact: Artifact): MeetingRecord => ({
  ...record,
  updatedAt: artifact.updatedAt > record.updatedAt ? artifact.updatedAt : record.updatedAt,
  artifacts: [
    ...record.artifacts.filter((entry) => entry.path !== artifact.path),
    artifact
  ].sort((a, b) => a.path.localeCompare(b.path))
});

export const writeRecordManifest = async (outDir: string, record: MeetingRecord): Promise<void> => {
  await writeJson(manifestPath(outDir, record), record);
};

export const listRecordManifests = async (outDir: string): Promise<string[]> => {
  const root = join(outDir, "records", "call");
  const manifests: string[] = [];

  const walk = async (dir: string): Promise<void> => {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(dir, entry);
      const info = await stat(path);
      if (info.isDirectory()) {
        await walk(path);
      } else if (entry === "manifest.json") {
        manifests.push(path);
      }
    }
  };

  await walk(root);
  return manifests.sort();
};

export const buildCatalog = async (outDir: string, generatedAt = nowIso()): Promise<Catalog> => {
  const manifests = await listRecordManifests(outDir);
  const entries = await Promise.all(
    manifests.map(async (path) => {
      const record = await readJson<MeetingRecord>(path);
      return {
        id: record.id,
        kind: record.kind,
        title: record.title,
        manifestPath: relative(outDir, path),
        updatedAt: record.updatedAt,
        dummy: record.dummy
      };
    })
  );
  return {
    version: 1,
    generatedAt,
    generator: GENERATOR_NAME,
    entries: entries.sort((a, b) => a.id.localeCompare(b.id))
  };
};

export const writeCatalog = async (outDir: string, generatedAt = nowIso()): Promise<Catalog> => {
  const catalog = await buildCatalog(outDir, generatedAt);
  await writeJson(join(outDir, "catalog.json"), catalog);
  return catalog;
};

export const sourceRefsForCall = (args: {
  issue?: number | undefined;
  videoUrl?: string | undefined;
  seriesSlug: string;
  pmPath: string;
}): SourceRef[] => {
  const refs: SourceRef[] = [
    {
      type: "pm",
      ref: args.pmPath,
      url: `https://github.com/ethereum/pm/tree/master/.github/ACDbot/artifacts/${args.pmPath}`
    }
  ];
  if (args.issue) {
    refs.push({
      type: "github",
      ref: `ethereum/pm#${args.issue}`,
      url: `https://github.com/ethereum/pm/issues/${args.issue}`,
      metadata: { seriesSlug: args.seriesSlug }
    });
  }
  if (args.videoUrl) {
    refs.push({ type: "youtube", ref: args.videoUrl, url: args.videoUrl });
  }
  return refs;
};
