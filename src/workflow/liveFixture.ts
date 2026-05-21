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

const FIXTURES = [
  {
    topic: "Glamsterdam BAL status",
    eip: "EIP-7928",
    decision: "BAL fixture cycle accepted the latest block-access-list readiness note.",
    impact: "Execution clients need one more cross-client fixture pass before the next devnet."
  },
  {
    topic: "EIP-7702 wallet impact",
    eip: "EIP-7702",
    decision: "Wallet impact notes were refreshed and linked to delegation UX follow-up.",
    impact: "Wallet and account-abstraction teams should review delegation safety text."
  },
  {
    topic: "SFI movement watch",
    eip: "EIP-8253",
    decision: "SFI watchlist fixture advanced a candidate replacement discussion.",
    impact: "Fork planners should compare replacement scope against existing Glamsterdam candidates."
  }
];

const writeArtifact = async (args: {
  baseDir: string;
  layer: "raw" | "normalized" | "derived";
  role: Artifact["role"];
  fileName: string;
  body: string;
  generatedAt: string;
  cycle: number;
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
    producedBy: `${GENERATOR_NAME}/fixture-live@${GENERATOR_VERSION}`,
    provenance: {
      source: "fixture-live",
      sourceHash: hash,
      generatedAt: args.generatedAt,
      generator: `${GENERATOR_NAME}/fixture-live`,
      generatorVersion: GENERATOR_VERSION,
      provider: "fixture",
      model: "deterministic",
      promptHash: sha256Buffer(`fixture-live:${args.cycle}`)
    }
  };
  if (args.from) artifact.from = args.from;
  return artifact;
};

const cycleDate = (cycle: number): string => {
  const start = Date.UTC(2026, 4, 21);
  const date = new Date(start + cycle * 30 * 60 * 1000);
  return date.toISOString().slice(0, 10);
};

export const generateLiveFixtureRecords = async (
  outDir: string,
  options: { cycle: number; generatedAt?: string } = { cycle: 1 }
): Promise<MeetingRecord[]> => {
  if (process.env.ENABLE_PM_LEAN_FIXTURE_FEED !== "true") {
    throw new Error("Refusing to generate fixture-live data unless ENABLE_PM_LEAN_FIXTURE_FEED=true");
  }

  const generatedAt = options.generatedAt ?? nowIso();
  const cycle = Number.isFinite(options.cycle) && options.cycle > 0 ? Math.trunc(options.cycle) : 1;
  const fixture = FIXTURES[(cycle - 1) % FIXTURES.length]!;
  const seriesSlug = "fixture-acde";
  const date = cycleDate(cycle);
  const number = 900000 + cycle;
  const baseDir = recordDir(outDir, { seriesSlug, date, number });
  await ensureLayerDirs(baseDir);

  const transcriptBody = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
Facilitator: PM Lean fixture-live cycle ${cycle} is publishing a production-shaped feed record.

2
00:00:05.000 --> 00:00:14.000
Protocol Support: ${fixture.topic} is the active agenda item for this cycle.

3
00:00:14.000 --> 00:00:24.000
Client Lead: ${fixture.decision}

4
00:00:24.000 --> 00:00:34.000
Research: ${fixture.impact}
`;
  const agendaBody = `# PM Lean Fixture Live Cycle ${cycle}

- ${fixture.topic}
- ${fixture.eip}
- ${fixture.impact}
`;
  const summary = {
    schemaVersion: 1,
    source: "fixture-live",
    fixtureLive: true,
    cycle,
    topic: fixture.topic,
    eip: fixture.eip,
    summary: fixture.impact,
    decisions: [{ timestamp: "00:00:14", decision: fixture.decision }],
    replacementNote: "Replace source=fixture-live with source=pm once upstream PM credentials and artifacts are configured."
  };

  const transcript = await writeArtifact({
    baseDir,
    layer: "raw",
    role: "transcript",
    fileName: "transcript.vtt",
    body: transcriptBody,
    generatedAt,
    cycle
  });
  const agenda = await writeArtifact({
    baseDir,
    layer: "normalized",
    role: "agenda",
    fileName: "agenda.md",
    body: agendaBody,
    generatedAt,
    cycle,
    from: [transcript.path]
  });
  const tldr = await writeArtifact({
    baseDir,
    layer: "derived",
    role: "tldr",
    fileName: "tldr.json",
    body: `${JSON.stringify(summary, null, 2)}\n`,
    generatedAt,
    cycle,
    from: [transcript.path, agenda.path]
  });

  const record: MeetingRecord = {
    id: callId(seriesSlug, date, number),
    kind: "call",
    title: `PM Lean Fixture Live Cycle ${cycle}: ${fixture.topic}`,
    seriesSlug,
    date,
    number,
    updatedAt: generatedAt,
    dummy: false,
    sources: [
      {
        type: "fixture-live",
        ref: `pm-lean-fixture-live-cycle-${cycle}`,
        url: "https://github.com/dionysuzx/pm-lean/tree/pm-lean-feed",
        metadata: {
          cycle,
          fixtureLive: true,
          replaceWith: "source=pm once upstream ethereum/pm artifacts are configured"
        }
      }
    ],
    artifacts: [agenda, tldr, transcript].sort((a, b) => a.path.localeCompare(b.path))
  };

  await writeRecordManifest(outDir, record);
  await writeCatalog(outDir, generatedAt);
  return [record];
};
