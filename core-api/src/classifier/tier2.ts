import Parser from "tree-sitter";
import Go from "tree-sitter-go";
import Java from "tree-sitter-java";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import TypeScript from "tree-sitter-typescript";

/**
 * Tier 2 — tree-sitter AST structural diff parser.
 *
 * Pure logic only: every function here operates on in-memory source strings and
 * tree-sitter's in-memory parse trees. No network/DB/filesystem access, per
 * core-api/CLAUDE.md's "classifier/ is pure" rule.
 */

export type SupportedLanguage = "typescript" | "tsx" | "python" | "go" | "rust" | "java";

export interface AstDelta {
  functionsChanged: number;
  signatureChanges: number;
  nestingDepthDelta: number;
  cyclomaticDelta: number;
}

export interface CodeFileInput {
  path: string;
  before: string;
  after: string;
}

// ---------------------------------------------------------------------------
// Weights — exported so downstream calibration (Phase 3 evaluation harness) can
// tune scoring without touching the diff logic itself.
// ---------------------------------------------------------------------------
export const FUNCTIONS_CHANGED_WEIGHT = 1;
export const SIGNATURE_CHANGE_WEIGHT = 2;
export const NESTING_DEPTH_WEIGHT = 1.5;
export const CYCLOMATIC_WEIGHT = 1;

// ---------------------------------------------------------------------------
// Language / extension configuration
// ---------------------------------------------------------------------------

const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  ts: "typescript",
  tsx: "tsx",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
};

/** Node types that introduce a new named function/method scope, per language. */
const FUNCTION_NODE_TYPES: Record<SupportedLanguage, string[]> = {
  typescript: ["function_declaration", "method_definition", "function_expression", "arrow_function"],
  tsx: ["function_declaration", "method_definition", "function_expression", "arrow_function"],
  python: ["function_definition"],
  go: ["function_declaration", "method_declaration"],
  rust: ["function_item"],
  java: ["method_declaration", "constructor_declaration"],
};

/** Node types treated as a "decision point" for a simplified cyclomatic complexity
 * count, and as a nesting level for the nesting-depth measurement. */
const DECISION_NODE_TYPES: Record<SupportedLanguage, string[]> = {
  typescript: [
    "if_statement",
    "for_statement",
    "for_in_statement",
    "while_statement",
    "do_statement",
    "switch_case",
    "catch_clause",
    "ternary_expression",
  ],
  tsx: [
    "if_statement",
    "for_statement",
    "for_in_statement",
    "while_statement",
    "do_statement",
    "switch_case",
    "catch_clause",
    "ternary_expression",
  ],
  python: ["if_statement", "elif_clause", "for_statement", "while_statement", "except_clause", "conditional_expression"],
  go: ["if_statement", "for_statement", "expression_case", "type_case", "select_statement"],
  rust: ["if_expression", "for_expression", "while_expression", "match_arm", "loop_expression"],
  java: [
    "if_statement",
    "for_statement",
    "enhanced_for_statement",
    "while_statement",
    "do_statement",
    "switch_label",
    "catch_clause",
    "ternary_expression",
  ],
};

/** Node types whose children represent this function's parameter list. */
const PARAMETER_LIST_NODE_TYPES: Record<SupportedLanguage, string[]> = {
  typescript: ["formal_parameters"],
  tsx: ["formal_parameters"],
  python: ["parameters"],
  go: ["parameter_list"],
  rust: ["parameters"],
  java: ["formal_parameters"],
};

function resolveLanguageGrammar(language: SupportedLanguage): Parser.Language {
  switch (language) {
    case "typescript":
      return TypeScript.typescript;
    case "tsx":
      return TypeScript.tsx;
    case "python":
      return Python;
    case "go":
      return Go;
    case "rust":
      return Rust;
    case "java":
      return Java;
    default: {
      const exhaustiveCheck: never = language;
      throw new Error(`Unsupported tree-sitter grammar: ${String(exhaustiveCheck)}`);
    }
  }
}

/** Maps a file extension (no leading dot, e.g. "ts") to its Tier 2 language tag.
 * Returns null for unsupported/unrecognized extensions. */
export function detectLanguageFromPath(path: string): SupportedLanguage | null {
  const match = /\.([a-zA-Z0-9]+)$/.exec(path);
  if (!match) return null;
  const ext = match[1]?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_TO_LANGUAGE[ext] ?? null;
}

/** Parses source text with the tree-sitter grammar for the given language. */
export function parseWithGrammar(source: string, language: string): Parser.Tree {
  const grammar = resolveLanguageGrammar(language as SupportedLanguage);
  if (!grammar) {
    throw new Error(`Unsupported tree-sitter grammar: ${language}`);
  }
  const parser = new Parser();
  parser.setLanguage(grammar);
  return parser.parse(source);
}

// ---------------------------------------------------------------------------
// Function extraction
// ---------------------------------------------------------------------------

interface FunctionInfo {
  name: string | null;
  kind: string;
  /** Canonical node-type sequence (preorder) of the whole function subtree. Identical
   * identifier/literal *text* never affects this — only node *types* do — so a pure
   * rename produces an identical signature. */
  structuralSignature: string;
  /** Canonical node-type sequence per parameter, used to detect signature changes
   * while still ignoring parameter renames. */
  paramSignature: string;
  nestingDepth: number;
  cyclomaticComplexity: number;
}

function collectNodesOfType(root: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode[] {
  const found: Parser.SyntaxNode[] = [];
  const typeSet = new Set(types);
  const walk = (node: Parser.SyntaxNode) => {
    if (typeSet.has(node.type)) found.push(node);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return found;
}

/** Preorder node-type sequence for a subtree — the structural fingerprint used for
 * rename-insensitive comparison. */
function structuralTypeSequence(node: Parser.SyntaxNode): string {
  const types: string[] = [];
  const walk = (n: Parser.SyntaxNode) => {
    types.push(n.type);
    for (const child of n.children) walk(child);
  };
  walk(node);
  return types.join(">");
}

function extractFunctionName(node: Parser.SyntaxNode, language: SupportedLanguage): string | null {
  const nameField = node.childForFieldName("name");
  if (nameField) return nameField.text;

  // Arrow/anonymous functions bound via `const foo = (...) => {...}` — attribute the
  // name of the enclosing variable_declarator/assignment so renamed-callback diffs
  // still match the same function across before/after.
  if ((language === "typescript" || language === "tsx") && node.type === "arrow_function") {
    const parent = node.parent;
    if (parent && (parent.type === "variable_declarator" || parent.type === "pair" || parent.type === "assignment_expression")) {
      const parentName = parent.childForFieldName("name") ?? parent.childForFieldName("left") ?? parent.childForFieldName("key");
      if (parentName) return parentName.text;
    }
  }
  return null;
}

function computeNestingDepth(functionBody: Parser.SyntaxNode, language: SupportedLanguage): number {
  const decisionTypes = new Set(DECISION_NODE_TYPES[language]);
  let maxDepth = 0;
  const walk = (node: Parser.SyntaxNode, depth: number) => {
    const isDecision = decisionTypes.has(node.type);
    const nextDepth = isDecision ? depth + 1 : depth;
    if (nextDepth > maxDepth) maxDepth = nextDepth;
    for (const child of node.children) walk(child, nextDepth);
  };
  walk(functionBody, 0);
  return maxDepth;
}

function computeCyclomaticComplexity(functionBody: Parser.SyntaxNode, language: SupportedLanguage): number {
  const decisionTypes = new Set(DECISION_NODE_TYPES[language]);
  const decisionPoints = collectNodesOfType(functionBody, [...decisionTypes]).length;
  return 1 + decisionPoints;
}

function extractParamSignature(node: Parser.SyntaxNode, language: SupportedLanguage): string {
  const paramListTypes = PARAMETER_LIST_NODE_TYPES[language];
  for (const child of node.children) {
    if (paramListTypes.includes(child.type)) {
      return structuralTypeSequence(child);
    }
  }
  return "";
}

function extractFunctions(tree: Parser.Tree, language: SupportedLanguage): FunctionInfo[] {
  const functionNodeTypes = FUNCTION_NODE_TYPES[language];
  const nodes = collectNodesOfType(tree.rootNode, functionNodeTypes);

  return nodes.map((node) => ({
    name: extractFunctionName(node, language),
    kind: node.type,
    structuralSignature: structuralTypeSequence(node),
    paramSignature: extractParamSignature(node, language),
    nestingDepth: computeNestingDepth(node, language),
    cyclomaticComplexity: computeCyclomaticComplexity(node, language),
  }));
}

// ---------------------------------------------------------------------------
// Matching before/after functions
// ---------------------------------------------------------------------------

interface MatchedPair {
  before: FunctionInfo;
  after: FunctionInfo;
}

/** Matches functions between before/after by name first (stable across body edits),
 * falling back to positional order (by kind) for anonymous functions. */
function matchFunctions(
  before: FunctionInfo[],
  after: FunctionInfo[]
): { matched: MatchedPair[]; added: FunctionInfo[]; removed: FunctionInfo[] } {
  const beforeRemaining = [...before];
  const afterRemaining = [...after];
  const matched: MatchedPair[] = [];

  // Pass 1: match named functions by exact name + kind.
  for (const afterFn of [...afterRemaining]) {
    if (afterFn.name === null) continue;
    const idx = beforeRemaining.findIndex((b) => b.name === afterFn.name && b.kind === afterFn.kind);
    if (idx !== -1) {
      matched.push({ before: beforeRemaining[idx]!, after: afterFn });
      beforeRemaining.splice(idx, 1);
      afterRemaining.splice(afterRemaining.indexOf(afterFn), 1);
    }
  }

  // Pass 2: match remaining anonymous functions positionally, by kind, in order of
  // appearance.
  for (const afterFn of [...afterRemaining]) {
    if (afterFn.name !== null) continue;
    const idx = beforeRemaining.findIndex((b) => b.name === null && b.kind === afterFn.kind);
    if (idx !== -1) {
      matched.push({ before: beforeRemaining[idx]!, after: afterFn });
      beforeRemaining.splice(idx, 1);
      afterRemaining.splice(afterRemaining.indexOf(afterFn), 1);
    }
  }

  return { matched, added: afterRemaining, removed: beforeRemaining };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Diffs the AST-derived structure of two versions of one source file and returns a
 * summary delta. Rename-insensitive: only node *types* are compared, never identifier
 * or literal text, so a pure variable/parameter rename yields an all-zero delta.
 */
export function diffAst(beforeSource: string, afterSource: string, language: string): AstDelta {
  const lang = language as SupportedLanguage;
  const beforeTree = parseWithGrammar(beforeSource, lang);
  const afterTree = parseWithGrammar(afterSource, lang);

  const beforeFns = extractFunctions(beforeTree, lang);
  const afterFns = extractFunctions(afterTree, lang);
  const { matched, added, removed } = matchFunctions(beforeFns, afterFns);

  let functionsChanged = 0;
  let signatureChanges = 0;
  let nestingDepthDelta = 0;
  let cyclomaticDelta = 0;

  for (const pair of matched) {
    if (pair.before.structuralSignature !== pair.after.structuralSignature) {
      functionsChanged += 1;
    }
    if (pair.before.paramSignature !== pair.after.paramSignature) {
      signatureChanges += 1;
    }
    nestingDepthDelta += pair.after.nestingDepth - pair.before.nestingDepth;
    cyclomaticDelta += pair.after.cyclomaticComplexity - pair.before.cyclomaticComplexity;
  }

  for (const fn of added) {
    functionsChanged += 1;
    nestingDepthDelta += fn.nestingDepth;
    cyclomaticDelta += fn.cyclomaticComplexity;
  }

  for (const fn of removed) {
    functionsChanged += 1;
    nestingDepthDelta -= fn.nestingDepth;
    cyclomaticDelta -= fn.cyclomaticComplexity;
  }

  return { functionsChanged, signatureChanges, nestingDepthDelta, cyclomaticDelta };
}

/** Weighted-sum complexity score for a single AstDelta. See the exported *_WEIGHT
 * constants above for the current weighting — tune those, not this formula, when
 * calibrating against the Phase 3 evaluation harness. */
export function computeAstScore(delta: AstDelta): number {
  return (
    delta.functionsChanged * FUNCTIONS_CHANGED_WEIGHT +
    delta.signatureChanges * SIGNATURE_CHANGE_WEIGHT +
    delta.nestingDepthDelta * NESTING_DEPTH_WEIGHT +
    delta.cyclomaticDelta * CYCLOMATIC_WEIGHT
  );
}

/**
 * Aggregate Tier 2 complexity score across all code files in a commit. Files with an
 * unsupported/unrecognized extension are skipped (logged, not thrown) and contribute 0.
 */
export function classifyTier2(codeFiles: CodeFileInput[]): number {
  let total = 0;
  for (const file of codeFiles) {
    const language = detectLanguageFromPath(file.path);
    if (!language) {
      console.warn(`[tier2] unsupported file extension, skipping AST diff: ${file.path}`);
      continue;
    }
    try {
      const delta = diffAst(file.before, file.after, language);
      total += computeAstScore(delta);
    } catch (err) {
      console.warn(`[tier2] failed to parse/diff ${file.path}, skipping: ${String(err)}`);
    }
  }
  return total;
}
