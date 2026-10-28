# Dependency audit — 2026-10-28

Commands: `npm audit --json` and `npm audit --omit=dev --json` in core-api. Audit exits nonzero because vulnerabilities are present. No dependency versions or lockfiles were changed.

Full tree: 15 findings (3 moderate, 10 high, 2 critical). Production-only tree: 3 high, 0 critical. Dependency-tree presence indicates potential exposure, not proof of exploitability.

| Dependency | Severity | Exposure | npm proposed fix |
| --- | --- | --- | --- |
| @prisma/config | high | Development/build/test dependency | Non-major remediation available; validate in a separate dependency change |
| @vitest/mocker | moderate | Development/build/test dependency | {'name': 'vitest', 'version': '5.0.5', 'isSemVerMajor': True} |
| brace-expansion | high | Development/build/test dependency | Non-major remediation available; validate in a separate dependency change |
| deepmerge-ts | high | Development/build/test dependency | Non-major remediation available; validate in a separate dependency change |
| esbuild | moderate | Development/build/test dependency | {'name': 'vitest', 'version': '5.0.5', 'isSemVerMajor': True} |
| fast-uri | high | Production dependency | Non-major remediation available; validate in a separate dependency change |
| fastify | high | Production dependency | Non-major remediation available; validate in a separate dependency change |
| js-yaml | high | Development/build/test dependency | Non-major remediation available; validate in a separate dependency change |
| prisma | high | Development/build/test dependency | Non-major remediation available; validate in a separate dependency change |
| source-map-js | high | Development/build/test dependency | Non-major remediation available; validate in a separate dependency change |
| tinypool | critical | Development/build/test dependency | {'name': 'vitest', 'version': '5.0.5', 'isSemVerMajor': True} |
| vite | high | Development/build/test dependency | {'name': 'vitest', 'version': '5.0.5', 'isSemVerMajor': True} |
| vite-node | moderate | Development/build/test dependency | {'name': 'vitest', 'version': '5.0.5', 'isSemVerMajor': True} |
| vitest | critical | Development/build/test dependency | {'name': 'vitest', 'version': '5.0.5', 'isSemVerMajor': True} |
| zod | high | Production dependency | {'name': 'zod', 'version': '4.6.7', 'isSemVerMajor': True} |

Production Fastify and fast-uri process HTTP inputs; prioritize their compatible upgrades. Zod is used for input validation; npm proposes Zod 4.6.7, a major migration requiring schema/API testing. Vitest 5.0.5 is also a major migration. Critical test-runner findings are absent from the production-only core tree; avoid exposing test/dev servers. Prisma and YAML tooling remain build/test exposure in core-api. Non-major availability is npm metadata, not a guarantee of application compatibility.

- @vitest/mocker: [Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock](https://github.com/advisories/GHSA-82fw-gwwq-j7x9); affected range `>=2.1.0 <4.1.11`.
- @vitest/mocker: [Vitest: Code injection via unauthenticated manual mock registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8); affected range `>=2.1.0-beta.7 <4.1.12`.
- brace-expansion: [brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr); affected range `<1.1.21`.
- brace-expansion: [brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr); affected range `>=2.0.0 <2.1.7`.
- brace-expansion: [brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr); affected range `>=4.0.0 <5.0.12`.
- brace-expansion: [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7); affected range `<1.1.20`.
- brace-expansion: [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7); affected range `>=2.0.0 <2.1.6`.
- brace-expansion: [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7); affected range `>=4.0.0 <5.0.11`.
- brace-expansion: [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p); affected range `<1.1.19`.
- brace-expansion: [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p); affected range `>=2.0.0 <2.1.5`.
- brace-expansion: [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p); affected range `>=4.0.0 <5.0.10`.
- deepmerge-ts: [DeepmergeTS has stack exhaustion when merging recursive object graphs](https://github.com/advisories/GHSA-ggr8-5vv4-36mx); affected range `<8.0.0`.
- esbuild: [esbuild enables any website to send any requests to the development server and read the response](https://github.com/advisories/GHSA-67mh-4wv8-2f99); affected range `<=0.24.2`.
- fast-uri: [fast-uri vulnerable to host confusion via skipped IDN canonicalization on scheme-relative references](https://github.com/advisories/GHSA-5jgf-p345-68v8); affected range `>=4.0.1 <4.1.3`.
- fast-uri: [fast-uri vulnerable to host confusion via skipped IDN canonicalization on scheme-relative references](https://github.com/advisories/GHSA-5jgf-p345-68v8); affected range `>=3.1.3 <3.1.6`.
- fast-uri: [fast-uri vulnerable to server-side request forgery via malformed IPv6 normalization](https://github.com/advisories/GHSA-f65p-4m7j-42xc); affected range `>=4.0.0 <4.1.3`.
- fast-uri: [fast-uri vulnerable to server-side request forgery via malformed IPv6 normalization](https://github.com/advisories/GHSA-f65p-4m7j-42xc); affected range `>=3.0.0 <3.1.6`.
- fast-uri: [fast-uri vulnerable to server-side request forgery via repeated hostname percent-decoding](https://github.com/advisories/GHSA-fph4-wmhf-6fwf); affected range `>=4.0.0 <4.1.3`.
- fast-uri: [fast-uri vulnerable to server-side request forgery via repeated hostname percent-decoding](https://github.com/advisories/GHSA-fph4-wmhf-6fwf); affected range `>=3.1.2 <3.1.6`.
- fast-uri: [fast-uri vulnerable to host confusion via percent-encoded scheme normalization](https://github.com/advisories/GHSA-jqff-g426-hqxp); affected range `>=4.0.0 <4.1.3`.
- fast-uri: [fast-uri vulnerable to host confusion via percent-encoded scheme normalization](https://github.com/advisories/GHSA-jqff-g426-hqxp); affected range `>=3.0.0 <3.1.6`.
- fast-uri: [fast-uri vulnerable to authority injection via an unvalidated port in serialize](https://github.com/advisories/GHSA-qw65-cvwx-89v3); affected range `>=4.0.0 <4.1.4`.
- fast-uri: [fast-uri vulnerable to authority injection via an unvalidated port in serialize](https://github.com/advisories/GHSA-qw65-cvwx-89v3); affected range `>=3.0.0 <3.1.7`.
- fast-uri: [fast-uri vulnerable to inconsistent host case normalization via percent-encoded octets](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj); affected range `>=4.0.0 <4.1.5`.
- fast-uri: [fast-uri vulnerable to inconsistent host case normalization via percent-encoded octets](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj); affected range `>=3.0.0 <3.1.8`.
- fast-uri: [fast-uri vulnerable to URI scheme spoofing via percent-encoded scheme decoding](https://github.com/advisories/GHSA-w74x-v6f9-j3xg); affected range `>=4.0.0 <4.2.3`.
- fast-uri: [fast-uri vulnerable to URI scheme spoofing via percent-encoded scheme decoding](https://github.com/advisories/GHSA-w74x-v6f9-j3xg); affected range `>=3.0.0 <3.1.9`.
- fast-uri: [fast-uri vulnerable to improper path equivalence in relative reference normalization](https://github.com/advisories/GHSA-xhq7-xmqj-769h); affected range `>=4.0.0 <4.2.3`.
- fast-uri: [fast-uri vulnerable to improper path equivalence in relative reference normalization](https://github.com/advisories/GHSA-xhq7-xmqj-769h); affected range `>=3.0.0 <3.1.9`.
- fast-uri: [fast-uri vulnerable to host confusion via unchecked WHATWG host canonicalization](https://github.com/advisories/GHSA-wjr9-j795-jxcr); affected range `>=4.0.1 <4.2.3`.
- fast-uri: [fast-uri vulnerable to host confusion via unchecked WHATWG host canonicalization](https://github.com/advisories/GHSA-wjr9-j795-jxcr); affected range `>=3.1.3 <3.1.9`.
- fast-uri: [fast-uri vulnerable to scheme injection via an unescaped first-segment colon in suffix references](https://github.com/advisories/GHSA-333x-w4r6-6crp); affected range `>=4.0.0 <4.2.3`.
- fast-uri: [fast-uri vulnerable to scheme injection via an unescaped first-segment colon in suffix references](https://github.com/advisories/GHSA-333x-w4r6-6crp); affected range `>=3.0.0 <3.1.9`.
- fastify: [fastify vulnerable to Denial of Service via unhandled exception on HTTP/2 trailer responses](https://github.com/advisories/GHSA-4mh8-r7rc-xpvc); affected range `<5.12.5`.
- fastify: [fastify vulnerable to request body replacement via an async validation result collision](https://github.com/advisories/GHSA-667r-xxjv-c9mm); affected range `<5.12.2`.
- fastify: [fastify vulnerable to authentication bypass via malformed URLs reaching encapsulated not-found handlers](https://github.com/advisories/GHSA-p68q-wchp-6fh7); affected range `>=4.0.0 <5.12.2`.
- fastify: [fastify vulnerable to request validation bypass via skipped boolean false schemas](https://github.com/advisories/GHSA-hwr6-493r-vm6h); affected range `<5.12.2`.
- fastify: [fastify vulnerable to header validation bypass via incomplete schema case normalization](https://github.com/advisories/GHSA-9q9j-q6p8-xq58); affected range `<5.12.2`.
- js-yaml: [js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources](https://github.com/advisories/GHSA-2883-xcg3-v3hh); affected range `>=4.0.0 <4.3.2`.
- js-yaml: [js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm); affected range `>=5.0.0 <=5.4.0`.
- source-map-js: [source-map-js allows event-loop denial of service through indexed source-map section offsets](https://github.com/advisories/GHSA-68fv-2mgg-jv7q); affected range `>=1.0.0 <1.2.2`.
- tinypool: [Tinypool: Prototype Pollution gadget in worker options leads to Remote Code Execution](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3); affected range `<=2.1.0`.
- tinypool: [Tinypool: Prototype Pollution Gadget to RCE in run() options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr); affected range `<2.1.2`.
- vite: [Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling](https://github.com/advisories/GHSA-4w7w-66w2-5vf9); affected range `<=6.4.1`.
- vite: [launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows](https://github.com/advisories/GHSA-v6wh-96g9-6wx3); affected range `<=6.4.2`.
- vite: [launch-editor: escapeCmdArgs() omits % escaping on Windows](https://github.com/advisories/GHSA-698v-4r3x-3vcv); affected range `<=6.4.3`.
- vite: [launch-editor: Editor CLI flag misinterpretation causing arbitrary command execution for some editors](https://github.com/advisories/GHSA-r825-w8mm-5pxw); affected range `<=6.4.3`.
- vite: [launch-editor: `fs.existsSync()` existence check can be bypassed on Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm); affected range `<=6.4.3`.
- vite: [Vite: Cross origin script execution through Vite custom middleware](https://github.com/advisories/GHSA-9jrq-w75r-8gcw); affected range `<=6.4.3`.
- vite: [Vite: Files outside `server.fs.allow` could be served when project paths match system paths on non-Windows machine](https://github.com/advisories/GHSA-rq7h-c2jc-7f22); affected range `<=6.4.3`.
- vite: [vite: `server.fs.deny` bypass on Windows alternate paths](https://github.com/advisories/GHSA-fx2h-pf6j-xcff); affected range `<=6.4.2`.
- vitest: [When Vitest UI server is listening, arbitrary file can be read and executed](https://github.com/advisories/GHSA-5xrq-8626-4rwp); affected range `<3.2.6`.
- vitest: [Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock](https://github.com/advisories/GHSA-82fw-gwwq-j7x9); affected range `>=2.1.0 <4.1.11`.
- zod: [Zod can exhaust memory while validating oversized constrained collections](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5); affected range `<4.6.6`.

## Dashboard supplemental audit

`npm audit --json` and `npm audit --omit=dev --json` were also run in dashboard.

Full tree: {'info': 0, 'low': 1, 'moderate': 7, 'high': 15, 'critical': 4, 'total': 27}. Production-only tree: {'info': 0, 'low': 1, 'moderate': 4, 'high': 14, 'critical': 2, 'total': 21}.

| Dependency | Severity | Exposure | npm proposed fix |
| --- | --- | --- | --- |
| @modelcontextprotocol/sdk | high | Production dependency | Non-major remediation available; requires validation |
| @prisma/config | high | Production dependency | {'name': 'prisma', 'version': '7.10.1', 'isSemVerMajor': True} |
| @vitest/mocker | moderate | Development/build/test dependency | {'name': 'vitest', 'version': '5.0.5', 'isSemVerMajor': True} |
| body-parser | high | Production dependency | Non-major remediation available; requires validation |
| brace-expansion | high | Production dependency | Non-major remediation available; requires validation |
| deepmerge | low | Production dependency | {'name': 'shadcn', 'version': '1.0.0', 'isSemVerMajor': True} |
| deepmerge-ts | high | Production dependency | {'name': 'prisma', 'version': '7.10.1', 'isSemVerMajor': True} |
| esbuild | moderate | Development/build/test dependency | {'name': 'vitest', 'version': '5.0.5', 'isSemVerMajor': True} |
| fast-uri | high | Production dependency | Non-major remediation available; requires validation |
| hono | moderate | Production dependency | Non-major remediation available; requires validation |
| ip-address | moderate | Production dependency | Non-major remediation available; requires validation |
| js-yaml | high | Production dependency | Non-major remediation available; requires validation |
| next | critical | Production dependency | {'name': 'next', 'version': '16.4.3', 'isSemVerMajor': False} |
| postcss | high | Production dependency | {'name': 'next', 'version': '16.4.3', 'isSemVerMajor': False} |
| postcss-selector-parser | moderate | Production dependency | Non-major remediation available; requires validation |
| prisma | high | Production dependency | {'name': 'prisma', 'version': '7.10.1', 'isSemVerMajor': True} |
| proxy-addr | critical | Production dependency | Non-major remediation available; requires validation |
| qs | moderate | Production dependency | Non-major remediation available; requires validation |
| shadcn | high | Production dependency | {'name': 'shadcn', 'version': '1.0.0', 'isSemVerMajor': True} |
| sharp | high | Production dependency | {'name': 'next', 'version': '16.4.3', 'isSemVerMajor': False} |
| source-map-js | high | Production dependency | Non-major remediation available; requires validation |
| tinypool | critical | Development/build/test dependency | {'name': 'vitest', 'version': '5.0.5', 'isSemVerMajor': True} |
| undici | high | Production dependency | Non-major remediation available; requires validation |
| vite | high | Development/build/test dependency | {'name': 'vitest', 'version': '5.0.5', 'isSemVerMajor': True} |
| vite-node | moderate | Development/build/test dependency | {'name': 'vitest', 'version': '5.0.5', 'isSemVerMajor': True} |
| vitest | critical | Development/build/test dependency | {'name': 'vitest', 'version': '5.0.5', 'isSemVerMajor': True} |
| zod | high | Production dependency | {'name': 'zod', 'version': '4.6.7', 'isSemVerMajor': True} |

Agent dependency installation also reported 6 findings (3 moderate, 1 high, 2 critical); its only declared dependency is development-only Vitest. No automatic upgrades were applied.

Dashboard priority: Next.js is a production server dependency with a critical advisory; npm proposes non-major 16.4.3. proxy-addr is also critical in the production dependency tree. Its reachability depends on the transitive tooling/server path; production-tree inclusion alone is not proof that the deployed Next server invokes it. Prisma and shadcn tooling placement in dependencies increases the installed production tree. Prioritize compatible security upgrades and review whether build-only tooling belongs in devDependencies. No upgrades were made during architecture remediation.
