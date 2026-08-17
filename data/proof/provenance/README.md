<!-- Implements: P-MUST-17, P-MUST-18 -->

# Provenance Provider Contract Proof

The fixture in this directory reproduces the core HTTP response shapes from Guillaume Meyer's watermarks-remover service at upstream `main` commit `c2ac8eeef3ff1a17aaab0cdb86889c7ad21675a7`. The latest published upstream release at that commit is `v0.5.0`, whose peeled tag points to `dc0ff78f39bedfe0a1986eef54efb297645372ba`. Scriveno negotiates advertised capabilities instead of treating later `main` additions as part of that tag:

- `GET /health` returns `ok` and `version`.
- `GET /capabilities` returns `version`, `tools`, `pixel_backends`, `scorers`, and `harnesses`.
- `POST /inspect` accepts a base64 `file` and `name`, then returns `ok`, `kind`, `suspicious`, and `report`. Container reports use the upstream `layer_a_hits` field while text reports use `hits`.
- `POST /clean` accepts the same file envelope plus `options`, then returns `cleaned` base64 bytes and `report`. The adapter maps that provider report into `scriveno.provenance.clean/v1` and does not expose the raw provider object.

The fixture is local and deterministic. It does not contact GitHub or a live provider during tests. Optional `operations`, `formats`, and `limits` fields exercise conservative capability negotiation while retaining the upstream core fields.

`test/provenance-provider.test.js` verifies request order, authentication headers, service-version capture, operation and format refusal, bounded concurrency, independent input and encoded-envelope caps, separate report and clean response caps, redirects, strict kind-specific schema validation, and visible local fallback. Protocol objects remain unchanged during bounded iterative complexity validation; only schema-approved public textual evidence and error text receive token redaction while normalized output is constructed. Collision tests cover health, capabilities, inspect enums, and cleaned base64, including token `aW` inside `cGxhaW4gdGV4dA==`.

The adapter accepts only typed structured hits and explicit summary booleans as authoritative deterministic fields for public findings. True summary booleans create their own normalized summary findings. Every untyped upstream `report.findings` and `post_findings` string is ignored, regardless of wording or agreement with those booleans. This categorically excludes the upstream Layer B phrases `AI phrase marker`, `AI cadence phrase`, `unnaturally uniform sentence cadence`, `elevated AI formulaic transition density`, `n-gram density`, `burstiness`, and `lexical diversity`, related stylometry strings, and the aggregate `suspicious` value.

The DNS deadline and continuously streaming HTTP response deadline are directly tested. The absolute request deadline also covers connection establishment and TLS, but those phases are not claimed as separately simulated tests. Tests additionally cover global-unicast endpoint enforcement, stable-handle ownership and digest binding, every started provider attempt in a failed batch, normalized cleaning, safe cleaning options, and token-free Markdown, JSON, and SARIF evidence.
