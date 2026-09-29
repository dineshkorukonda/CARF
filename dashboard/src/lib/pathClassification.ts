export type PathKind = "infra" | "dependency" | "config" | "code" | "data" | "test" | "unclassified";

/** Dashboard-side path labels for the commit page. Not imported from core-api. */
export function classifyPath(path: string): PathKind {
  const p = path.replace(/\\/g, "/");
  if (/\.test\.|\.spec\.|\/__tests__\/|\/tests?\//i.test(p) || /_test\.(go|py)$/.test(p)) return "test";
  if (/(^|\/)Dockerfile$|docker-compose\.ya?ml$|\.tf$|\/k8s\/|\/helm\//i.test(p)) return "infra";
  if (/(package(-lock)?\.json|pnpm-lock\.yaml|pom\.xml|go\.mod|Cargo\.toml|requirements\.txt)$/i.test(p)) {
    return "dependency";
  }
  if (/\/migrations\//.test(p) || /\.sql$/i.test(p)) return "data";
  if (/(^|\/)\.carf\.yml$|\.(ya?ml|toml|ini|env)$/i.test(p) || /\.config\.(js|ts)$/i.test(p)) return "config";
  if (/\.(ts|tsx|js|jsx|mjs|cjs|go|py|rs|java|rb|php)$/i.test(p)) return "code";
  return "unclassified";
}
