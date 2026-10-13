export function ScoreExplanation() {
  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        How these scores are calculated
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          File categories, structural code changes, and how they affect the rollback policy.
        </span>
      </summary>
      <div className="space-y-6 border-t border-border p-4 text-sm leading-relaxed text-muted-foreground sm:p-5">
        <p>
          CARF analyzes changed file paths and their full before/after contents. Both classifiers
          use deterministic rules. The complexity score measures structural change; it is not a
          probability of failure. PR analysis calculates policy before deployment; runtime health
          determines whether a deployed revision needs rollback.
        </p>

        <section className="space-y-3" aria-label="Classifier 1 algorithm">
          <h3 className="font-semibold text-foreground">Classifier 1: which parts of the system changed?</h3>
          <p>
            Each path is checked against ordered glob patterns. Repository rules in .carf.yml run
            first, followed by built-in rules. The first matching rule assigns one category.
            File contents and the number of changed lines do not affect this classification.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="font-medium text-foreground">Infrastructure:</strong> Dockerfiles, Terraform, and recognized Kubernetes or Helm paths.</li>
            <li><strong className="font-medium text-foreground">Dependency:</strong> dependency manifests and recognized lockfiles, such as package.json and go.mod.</li>
            <li><strong className="font-medium text-foreground">Data:</strong> recognized database migration directories, including Prisma migrations.</li>
            <li><strong className="font-medium text-foreground">Test:</strong> test/spec files and recognized test directories.</li>
            <li><strong className="font-medium text-foreground">Config:</strong> environment files, YAML, properties, and recognized framework configuration.</li>
            <li><strong className="font-medium text-foreground">Code:</strong> TypeScript/TSX, Python, Go, Rust, Java, and Elixir source files.</li>
          </ul>
          <p>
            Built-in migration and test rules precede generic source rules, so a migration ending
            in .ts is data and a .test.ts file is a test. Documentation, images, and unmatched
            paths are unclassified and excluded from the mix. Each classified file counts once.
          </p>
          <p className="rounded-md bg-muted/40 p-3 font-mono text-xs text-foreground">
            Category share = category file count / all classified files<br />
            Code share = (code files + test files) / all classified files
          </p>
          <p>
            The dashboard file labels are approximate built-in labels; saved mix values come from
            the core classifier and can reflect repository overrides. Changes with no classified
            files produce no vector or policy.
          </p>
        </section>

        <section className="space-y-3" aria-label="Classifier 2 algorithm">
          <h3 className="font-semibold text-foreground">Classifier 2: how much did code structure change?</h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Take only files classified as code or test. Tree-sitter parses their before/after contents for TypeScript, TSX, Python, Go, Rust, and Java.</li>
            <li>Extract functions and methods, recording their syntax-node structure, parameter-list structure, decision nesting depth, and simplified cyclomatic complexity.</li>
            <li>Match named functions by exact name and node kind; match remaining anonymous functions by kind in order of appearance. Unmatched functions count as additions or removals.</li>
            <li>Compare matched functions and aggregate the four metrics below for each file.</li>
          </ol>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="font-medium text-foreground">F:</strong> number of structurally changed, added, or removed functions.</li>
            <li><strong className="font-medium text-foreground">S:</strong> number of matched functions whose parameter-list structure changed.</li>
            <li><strong className="font-medium text-foreground">ΔN:</strong> aggregate change in maximum decision nesting depth.</li>
            <li><strong className="font-medium text-foreground">ΔC:</strong> aggregate change in cyclomatic complexity, measured as 1 + recognized decision nodes such as conditions, loops, and catches.</li>
          </ul>
          <p>
            Matched functions contribute after minus before for nesting and cyclomatic complexity.
            Added functions contribute positively; removed functions subtract their values.
          </p>
          <p className="rounded-md bg-muted/40 p-3 font-mono text-xs text-foreground">
            File score = max(0, F + 2S + 1.5ΔN + ΔC)<br />
            Recognized test paths: file score × 0.1<br />
            Raw score = sum of discounted file scores<br />
            Stored complexity = clamp(raw score / 50, 0, 1)<br />
            Displayed score = stored complexity × 100
          </p>
          <p>
            For example, adding the first if statement to an existing function, with unchanged
            parameters, gives F = 1, S = 0, ΔN = 1, and ΔC = 1. Its raw score is 3.5, displayed
            as 7/100. The same change in a test contributes 0.35 raw points, or 0.7/100.
            A displayed 100/100 means the raw score reached at least 50; larger scores are capped.
            This example illustrates the algorithm, not a breakdown of this revision.
          </p>
          <p>
            The comparison uses syntax-node types, so local variable renames and same-type literal
            changes can score zero even when behavior changes. Changes outside extracted functions
            are not directly scored. Function renames may count as a removal and an addition.
            Unsupported files or exceptions during parsing/diffing contribute zero. Tests keep
            their full file-count share; only their complexity contribution is discounted.
          </p>
        </section>

        <section className="space-y-3" aria-label="Rollback policy algorithm">
          <h3 className="font-semibold text-foreground">How the scores affect the policy</h3>
          <p>
            For every category with a positive share, CARF adjusts its base threshold and window.
            The smallest threshold and longest window win across active categories. Complexity
            further lowers the error ceiling and does not change the window.
          </p>
          <p className="rounded-md bg-muted/40 p-3 font-mono text-xs text-foreground">
            Category threshold = base threshold × (1 − decay × share)<br />
            Category window = base window × (1 − decay × share)<br />
            Final threshold = min(category thresholds) × (1 − complexity decay × stored complexity)<br />
            Final window = max(category windows)
          </p>
          <p>
            Default threshold/window pairs are infrastructure 1%/60s, dependency 3%/180s,
            config 5%/300s, code 8%/900s, and data 1%/600s. Default decay is 0.5 and
            complexity decay is 0.3. Repository configuration can override this tuning;
            the saved policy numbers above are authoritative.
          </p>
          <p>
            During active observation, a reported health signal at or above the threshold triggers
            rollback handling. The signal depends on the runtime adapter; it can include process
            failures and HTTP probe results. Application rollback does not automatically reverse
            database migrations.
          </p>
        </section>
      </div>
    </details>
  );
}
