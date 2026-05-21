import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Artifact, MeetingRecord } from "../domain/types.js";
import {
  GENERATOR_NAME,
  GENERATOR_VERSION,
  callId,
  ensureLayerDirs,
  nowIso,
  recordDir,
  sha256Buffer,
  writeCatalog,
  writeRecordManifest
} from "../domain/record.js";

const DUMMY_TRANSCRIPT = `WEBVTT

1
00:00:00.000 --> 00:00:04.000
Facilitator: This is a deterministic Forkcast dummy call for pipeline verification.

2
00:00:04.000 --> 00:00:12.000
Protocol Support: Glamsterdam dummy status moved EIP-7702 impact notes into a review lane.

3
00:00:12.000 --> 00:00:20.000
Client Lead: BAL dummy devnet remains green and a fixture decision is recorded for traceability.
`;

const DUMMY_CHAT = `00:00:01\tprotocol-support\tDummy pipeline enabled explicitly.
00:00:08\tclient-lead\tBAL fixture decision has provenance.
`;

const DUMMY_TLDR = {
  meeting: "Forkcast Dummy ACDE #1 - January 1, 2099",
  fakeData: true,
  highlights: {
    fork_status_and_schedule: [
      {
        timestamp: "00:00:04",
        highlight: "Glamsterdam dummy data refreshed for end-to-end verification"
      }
    ],
    eip_proposals: [
      {
        timestamp: "00:00:08",
        highlight: "EIP-7702 impact fixture linked to wallet UX and delegation provenance"
      }
    ]
  },
  action_items: [
    {
      timestamp: "00:00:12",
      action: "Publish dummy snapshot and rebuild Astro from pinned data",
      owner: "Forkcast dummy operator"
    }
  ],
  decisions: [
    {
      timestamp: "00:00:18",
      decision: "Dummy BAL decision accepted for fixture-only smoke verification"
    }
  ]
};

const writeArtifact = async (args: {
  baseDir: string;
  layer: "raw" | "normalized" | "derived";
  role: Artifact["role"];
  fileName: string;
  body: string;
  generatedAt: string;
  from?: string[];
}): Promise<Artifact> => {
  const relativePath = join(args.layer, args.fileName);
  const target = join(args.baseDir, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, args.body);
  const hash = sha256Buffer(args.body);
  const artifact: Artifact = {
    layer: args.layer,
    role: args.role,
    path: relativePath,
    sha256: hash,
    bytes: Buffer.byteLength(args.body),
    updatedAt: args.generatedAt,
    producedBy: `${GENERATOR_NAME}/dummy@${GENERATOR_VERSION}`,
    provenance: {
      source: "dummy",
      sourceHash: hash,
      generatedAt: args.generatedAt,
      generator: `${GENERATOR_NAME}/dummy`,
      generatorVersion: GENERATOR_VERSION,
      provider: "fixture",
      model: "deterministic"
    }
  };
  if (args.from) artifact.from = args.from;
  return artifact;
};

export const generateDummyRecords = async (outDir: string, generatedAt = nowIso()): Promise<MeetingRecord[]> => {
  if (process.env.ENABLE_DUMMY_PIPELINE !== "true") {
    throw new Error("Refusing to generate dummy data unless ENABLE_DUMMY_PIPELINE=true");
  }

  const seriesSlug = "dummy-acde";
  const date = "2099-01-01";
  const number = 1;
  const baseDir = recordDir(outDir, { seriesSlug, date, number });
  await ensureLayerDirs(baseDir);

  const transcript = await writeArtifact({
    baseDir,
    layer: "raw",
    role: "transcript",
    fileName: "transcript.vtt",
    body: DUMMY_TRANSCRIPT,
    generatedAt
  });
  const chat = await writeArtifact({
    baseDir,
    layer: "raw",
    role: "chat",
    fileName: "chat.txt",
    body: DUMMY_CHAT,
    generatedAt
  });
  const tldr = await writeArtifact({
    baseDir,
    layer: "derived",
    role: "tldr",
    fileName: "tldr.json",
    body: `${JSON.stringify(DUMMY_TLDR, null, 2)}\n`,
    generatedAt,
    from: [transcript.path, chat.path]
  });

  const record: MeetingRecord = {
    id: callId(seriesSlug, date, number),
    kind: "call",
    title: "Forkcast Dummy ACDE #1",
    seriesSlug,
    date,
    number,
    updatedAt: generatedAt,
    dummy: true,
    sources: [
      {
        type: "dummy",
        ref: "ENABLE_DUMMY_PIPELINE=true",
        metadata: {
          warning: "Fixture-only data. Never publish as production truth."
        }
      }
    ],
    artifacts: [chat, tldr, transcript].sort((a, b) => a.path.localeCompare(b.path))
  };
  await writeRecordManifest(outDir, record);
  await writeCatalog(outDir, generatedAt);
  return [record];
};
