# Release Checklist

This checklist is the package-release path for Scriveno maintainers. It is designed to verify the source checkout, the package tarball, the installed runtime surfaces, the published npm package, and the GitHub release.

## 1. Confirm A Clean Baseline

```bash
git status --short --branch
npm view scriveno version
```

Choose the next package version from npm, not from memory.

## 2. Run Local Gates

```bash
npm run release:check
npm run pack:repro
npm audit --omit=dev --json
node bin/install.js routes --json
node bin/install.js agents --json
node bin/install.js smoke --json
node bin/install.js sync --check --json
git diff --check
```

Also scan text files for the repo writing policy:

```bash
node scripts/check-writing-policy.js
```

If that script does not exist in a checkout yet, run the equivalent local policy scan used by the release operator.

## 3. Create An Isolated Consumer

Validate the release candidate in a new temporary prefix so stale global files cannot hide installer defects. Do not delete existing user installs.

This path intentionally does not run `npm cache clean --force`. A release proof should not delete the user's shared npm cache when an isolated, offline consumer provides stronger evidence.

```bash
release_candidate_root="$(mktemp -d)"
mkdir -p "$release_candidate_root/dist" "$release_candidate_root/consumer"
npm pack --ignore-scripts --pack-destination "$release_candidate_root/dist"
npm install --prefix "$release_candidate_root/consumer" --ignore-scripts --offline --no-audit --no-fund "$release_candidate_root/dist/scriveno-X.Y.Z.tgz"
node "$release_candidate_root/consumer/node_modules/scriveno/bin/install.js" --version
```

The repository's `test/provenance-consumer.test.js` performs the same lifecycle-disabled, offline install and exercises provenance audit, cleaning, provider fallback, formats, and exit behavior using only installed package contents.

To inspect project install surfaces without changing a global runtime, create a project inside the temporary root:

```bash
mkdir -p "$release_candidate_root/project"
cd "$release_candidate_root/project"
node "$release_candidate_root/consumer/node_modules/scriveno/bin/install.js" --runtimes codex,generic --project --developer --silent
node "$release_candidate_root/consumer/node_modules/scriveno/bin/install.js" smoke --json
```

## 4. Pack The Candidate

```bash
mkdir -p dist
npm run pack:repro
npm pack --ignore-scripts --pack-destination dist
```

Inspect the tarball name and confirm the version matches `package.json`.

## 5. Commit And Tag

```bash
git status --short
git add README.md CHANGELOG.md docs package.json package-lock.json data templates commands .planning test
git commit -m "Release scriveno X.Y.Z"
git tag vX.Y.Z
```

Keep the commit message plain and version-specific.

## 6. Publish To npm

```bash
npm publish --access public
npm view scriveno version
```

The published version must match `package.json` and the tag.

## 7. Push Git And Create GitHub Release

```bash
git push origin main
git push origin vX.Y.Z
gh release create vX.Y.Z dist/scriveno-X.Y.Z.tgz --title "Scriveno X.Y.Z" --notes-file /tmp/scriveno-release-notes.md
```

The release notes should summarize the user-facing change, docs updated, tests run, and npm verification.

## 8. Verify From Published npm

```bash
npm install -g scriveno@latest
scriveno --version
scriveno --runtimes claude-code,cursor,gemini-cli,codex,opencode,copilot,windsurf,antigravity,manus,perplexity-desktop,generic --global --developer --silent
scriveno smoke --json
```

This is the final proof that a fresh user can install the same package that was released.

## 9. Final State

```bash
git status --short --branch
gh release view vX.Y.Z
npm view scriveno version
```

The final state should show a clean worktree, a visible GitHub release, and npm latest aligned to the new version.
