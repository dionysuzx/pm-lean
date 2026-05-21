export type ArtifactLayer = "raw" | "normalized" | "derived";

export type ArtifactRole =
  | "agenda"
  | "call-notes"
  | "chat"
  | "decision"
  | "manifest"
  | "recording"
  | "summary"
  | "tldr"
  | "transcript"
  | "transcript-changelog"
  | "transcript-corrected"
  | "youtube-reference"
  | "zoom-reference";

export interface Provenance {
  source: string;
  sourcePath?: string;
  sourceUrl?: string;
  sourceHash?: string;
  commit?: string;
  generatedAt: string;
  generator: string;
  generatorVersion: string;
  model?: string;
  provider?: string;
  promptHash?: string;
  inputHashes?: string[];
  cost?: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedUsd?: number;
  };
}

export interface Artifact {
  layer: ArtifactLayer;
  role: ArtifactRole;
  path: string;
  sha256: string;
  bytes: number;
  updatedAt: string;
  source?: string;
  producedBy?: string;
  from?: string[];
  provenance: Provenance;
}

export interface SourceRef {
  type: "pm" | "github" | "zoom" | "youtube" | "discourse" | "dummy";
  ref: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface MeetingRecord {
  id: string;
  kind: "call";
  title: string;
  seriesSlug: string;
  date: string;
  number: number;
  updatedAt: string;
  dummy: boolean;
  sources: SourceRef[];
  artifacts: Artifact[];
}

export interface CatalogEntry {
  id: string;
  kind: "call";
  title: string;
  manifestPath: string;
  updatedAt: string;
  dummy: boolean;
}

export interface Catalog {
  version: 1;
  generatedAt: string;
  generator: "pm-lean";
  entries: CatalogEntry[];
}

export interface PmManifest {
  version: number;
  series: Record<
    string,
    {
      name: string;
      youtubePlaylist?: string | null;
      calls: Array<{
        date: string;
        path: string;
        resources: Record<string, string>;
        number?: number;
        issue?: number;
        videoUrl?: string;
      }>;
    }
  >;
}
