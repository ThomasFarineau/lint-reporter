# Lint Reporter

[![Build](https://github.com/ThomasFarineau/lint-reporter/actions/workflows/ci.yml/badge.svg)](https://github.com/ThomasFarineau/lint-reporter/actions/workflows/ci.yml)
[![Release](https://github.com/ThomasFarineau/lint-reporter/actions/workflows/release.yml/badge.svg)](https://github.com/ThomasFarineau/lint-reporter/actions/workflows/release.yml)
[![Latest Tag](https://img.shields.io/github/v/tag/ThomasFarineau/lint-reporter)](https://github.com/ThomasFarineau/lint-reporter/tags)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

GitHub Action that generates a [Job Summary](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/adding-a-job-summary) from an ESLint JSON report.

## Usage

```yaml
- name: Run ESLint
  run: npx eslint . --format json --output-file eslint-report.json
  continue-on-error: true

- name: Lint Report
  uses: ThomasFarineau/lint-reporter@v1
```

## Inputs

| Input             | Description                                | Default              |
| ----------------- | ------------------------------------------ | -------------------- |
| `report-path`     | Path to the ESLint JSON report file        | `eslint-report.json` |
| `fail-on-error`   | Fail the step when lint errors are found   | `true`               |
| `fail-on-warning` | Fail the step when lint warnings are found | `false`              |
| `title`           | Title displayed in the Job Summary         | `Lint Report`        |

## Example

```yaml
- uses: ThomasFarineau/lint-reporter@v1
  with:
    report-path: reports/eslint.json
    fail-on-error: true
    fail-on-warning: false
    title: ESLint Results
```

## Output

Issues are grouped by rule, sorted by severity then occurrence count, with a direct link to each file and line.

![Example summary showing error/warning counts grouped by rule with file links](.github/summary-preview.png)

## Development

```bash
bun install
bun run build   # → dist/index.js
```

The `dist/` is committed to the repository and rebuilt via the **Build** workflow (`Actions → Build → Run workflow`).

## License

MIT
