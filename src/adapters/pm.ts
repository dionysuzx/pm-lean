import { join } from "node:path";
import type { MeetingRecord, PmManifest } from "../domain/types.js";
import {
  callId,
  copyArtifact,
  ensureLayerDirs,
  nowIso,
  readJson,
  recordDir,
  sourceRefsForCall,
  writeCatalog,
  writeRecordManifest
} from "../domain/record.js";

export interface IngestPmOptions {
  pmRoot: string;
  outDir: string;
  series?: string | undefined;
  limit?: number | undefined;
  generatedAt?: string | undefined;
}

export const ingestPm = async (options: IngestPmOptions): Promise<MeetingRecord[]> => {
  const generatedAt = options.generatedAt ?? nowIso();
  const manifestFile = join(options.pmRoot, ".github", "ACDbot", "artifacts", "manifest.json");
  const manifest = await readJson<PmManifest>(manifestFile);
  const records: MeetingRecord[] = [];

  for (const [seriesSlug, series] of Object.entries(manifest.series)) {
    if (options.series && options.series !== seriesSlug) continue;
    const calls = [...series.calls]
      .filter((call) => typeof call.number === "number")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, options.limit ?? Number.POSITIVE_INFINITY);

    for (const call of calls) {
      const number = call.number;
      if (number === undefined) continue;
      const id = callId(seriesSlug, call.date, number);
      const baseDir = recordDir(options.outDir, { seriesSlug, date: call.date, number });
      await ensureLayerDirs(baseDir);
      let record: MeetingRecord = {
        id,
        kind: "call",
        title: `${series.name} #${number}`,
        seriesSlug,
        date: call.date,
        number,
        updatedAt: generatedAt,
        dummy: false,
        sources: sourceRefsForCall({
          issue: call.issue,
          videoUrl: call.videoUrl,
          seriesSlug,
          pmPath: call.path
        }),
        artifacts: []
      };

      for (const [resourceName, resourceFile] of Object.entries(call.resources)) {
        const sourcePath = join(options.pmRoot, ".github", "ACDbot", "artifacts", call.path, resourceFile);
        const artifact = await copyArtifact({
          sourcePath,
          recordBaseDir: baseDir,
          resourceName,
          resourceFile,
          generatedAt,
          sourceRef: `pm:${call.path}:${resourceName}`
        });
        record = {
          ...record,
          updatedAt: artifact.updatedAt > record.updatedAt ? artifact.updatedAt : record.updatedAt,
          artifacts: [...record.artifacts, artifact].sort((a, b) => a.path.localeCompare(b.path))
        };
      }

      await writeRecordManifest(options.outDir, record);
      records.push(record);
    }
  }

  await writeCatalog(options.outDir, generatedAt);
  return records;
};
