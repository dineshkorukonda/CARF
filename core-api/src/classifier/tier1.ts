import micromatch from "micromatch";

export type ChangeType = "infra" | "dependency" | "config" | "code" | "data" | "unclassified";

export interface FileClassification {
  path: string;
  type: ChangeType;
}

export interface Tier1Result {
  /** Every input path, including "unclassified" ones — kept for observability/logging. */
  files: FileClassification[];
  /** Counts per type, including "unclassified". */
  tally: Record<ChangeType, number>;
  /**
   * Count of CLASSIFIED files only (excludes "unclassified"). This is the denominator
   * vector.ts's buildChangeVector() divides by — see core-api/CLAUDE.md.
   */
  totalFiles: number;
}

interface PatternRule {
  patterns: string[];
  type: ChangeType;
}

// Ordered specific -> generic, first match wins. Non-signal paths (docs, license,
// changelog, images) resolve to "unclassified" rather than falling back to "config",
// so they're excluded from the tally/totalFiles denominator instead of diluting it.
const RULES: PatternRule[] = [
  { patterns: ["Dockerfile", "**/Dockerfile", "docker-compose.yml", "docker-compose.yaml"], type: "infra" },
  { patterns: ["k8s/**/*.yaml", "k8s/**/*.yml", "helm/**"], type: "infra" },
  { patterns: ["*.tf", "**/*.tf"], type: "infra" },
  { patterns: ["package.json", "requirements.txt", "go.mod", "Cargo.toml", "mix.exs"], type: "dependency" },
  { patterns: ["migrations/**"], type: "data" },
  { patterns: ["*.ts", "*.tsx", "*.go", "*.py", "*.rs", "*.java", "*.ex", "**/*.ts", "**/*.tsx", "**/*.go", "**/*.py", "**/*.rs", "**/*.java", "**/*.ex"], type: "code" },
  { patterns: ["*.yaml", "*.yml", "*.env", "**/*.yaml", "**/*.yml", "**/*.env", "**/ConfigMap*.yaml", "**/ConfigMap*.yml"], type: "config" },
  {
    patterns: [
      "README*",
      "**/README*",
      "CHANGELOG*",
      "**/CHANGELOG*",
      "LICENSE*",
      "**/LICENSE*",
      "docs/**",
      "*.md",
      "**/*.md",
      "*.png",
      "*.jpg",
      "*.jpeg",
      "*.svg",
      "*.gif",
      "**/*.png",
      "**/*.jpg",
      "**/*.jpeg",
      "**/*.svg",
      "**/*.gif",
    ],
    type: "unclassified",
  },
];

function matchPath(path: string): { type: ChangeType; matchedRule: boolean } {
  for (const rule of RULES) {
    if (micromatch.isMatch(path, rule.patterns, { dot: true, nocase: true })) {
      return { type: rule.type, matchedRule: true };
    }
  }
  // Genuinely unmatched (no rule, explicit or catch-all, applies) — warn, since this is
  // the "we didn't anticipate this path shape" case rather than a known non-signal file.
  return { type: "unclassified", matchedRule: false };
}

function emptyTally(): Record<ChangeType, number> {
  return { infra: 0, dependency: 0, config: 0, code: 0, data: 0, unclassified: 0 };
}

export function classifyTier1(changedFilePaths: string[]): Tier1Result {
  const tally = emptyTally();
  const files: FileClassification[] = changedFilePaths.map((path) => {
    const { type, matchedRule } = matchPath(path);
    if (!matchedRule) {
      console.warn(`[tier1] unmatched path, treated as unclassified: ${path}`);
    }
    tally[type] += 1;
    return { path, type };
  });

  const totalFiles = files.reduce((count, f) => (f.type === "unclassified" ? count : count + 1), 0);

  return { files, tally, totalFiles };
}
