// tree-sitter grammar packages ship no TypeScript declarations. These ambient module
// declarations describe the shape of their CJS exports (verified against the installed
// package versions' `bindings/node/index.js`) so tier2.ts can import them safely under
// strict mode.
declare module "tree-sitter-typescript" {
  import type Parser from "tree-sitter";

  const grammars: {
    typescript: Parser.Language;
    tsx: Parser.Language;
  };
  export default grammars;
}

declare module "tree-sitter-python" {
  import type Parser from "tree-sitter";

  const language: Parser.Language;
  export default language;
}

declare module "tree-sitter-go" {
  import type Parser from "tree-sitter";

  const language: Parser.Language;
  export default language;
}

declare module "tree-sitter-rust" {
  import type Parser from "tree-sitter";

  const language: Parser.Language;
  export default language;
}

declare module "tree-sitter-java" {
  import type Parser from "tree-sitter";

  const language: Parser.Language;
  export default language;
}
