import * as fs from 'node:fs';
import path from 'node:path';

import * as core from '@actions/core';

import {normalizeMessages, countBySeverity, buildMarkdown} from './lib';
import type {EslintFileResult} from './types';

const SERVER_URL = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
const REPOSITORY = process.env.GITHUB_REPOSITORY ?? '';
const SHA = process.env.GITHUB_SHA ?? 'HEAD';
const summaryFile = process.env.GITHUB_STEP_SUMMARY;

const reportPath = core.getInput('report-path');
const failOnError = core.getInput('fail-on-error') !== 'false';
const failOnWarn = core.getInput('fail-on-warning') === 'true';
const title = core.getInput('title');

function appendSummary(md: string): void {
  if (summaryFile) {
    fs.appendFileSync(summaryFile, md);
  } else {
    process.stdout.write(md);
  }
}

if (!fs.existsSync(reportPath)) {
  appendSummary(`## 🔍 ${title}\n\n✅ **No lint issues found.**\n`);
  process.exit(0);
}

let results: EslintFileResult[];
try {
  results = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as EslintFileResult[];
} catch (err) {
  core.setFailed(`Failed to parse ${reportPath}: ${(err as Error).message}`);
  process.exit(1);
}

const cwd = process.cwd() + path.sep;
const allMessages = normalizeMessages(results, cwd);
appendSummary(buildMarkdown(allMessages, title, SERVER_URL, REPOSITORY, SHA));

const counts = countBySeverity(allMessages);

if (counts.error > 0 && failOnError) {
  core.setFailed(`❌ ${counts.error} lint error(s) found`);
  process.exit(1);
}

if (counts.warning > 0 && failOnWarn) {
  core.setFailed(`❌ ${counts.warning} lint warning(s) found`);
  process.exit(1);
}

console.log(`✅ No blocking lint issues (${counts.error} error(s), ${counts.warning} warning(s))`);
