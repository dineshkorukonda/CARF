export interface CodeFile {
  path: string;
  before: string;
  after: string;
}

export interface CodeComplexityScorer {
  /** Aggregate complexity score across all "code"-classified files in a commit. */
  score(codeFiles: CodeFile[]): number;
}

function countLines(text: string): number {
  return text.length === 0 ? 0 : text.split("\n").length;
}

function scoreFile(before: string, after: string): number {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const lineCountDelta = Math.abs(countLines(after) - countLines(before));
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  let changedAtSameIndex = 0;
  for (let i = 0; i < maxLen; i++) {
    if (beforeLines[i] !== afterLines[i]) changedAtSameIndex += 1;
  }
  return lineCountDelta + changedAtSameIndex;
}

/**
 * Deterministic placeholder scorer — proportional to total line-delta across code files.
 * NOT real AST analysis. Exists to exercise the vector pipeline and Phase 2 threshold
 * math end-to-end before #7's tree-sitter-backed scorer replaces it.
 */
export class StubComplexityScorer implements CodeComplexityScorer {
  score(codeFiles: CodeFile[]): number {
    return codeFiles.reduce((total, file) => total + scoreFile(file.before, file.after), 0);
  }
}
