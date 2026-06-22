import {describe, test, expect} from 'bun:test';

import {
  normalizeMessages,
  countBySeverity,
  groupByRule,
  sortGroups,
  fileLink,
  buildMarkdown
} from './lib';
import type {EslintFileResult, NormalizedMessage} from './types';

const msg = (overrides: Partial<NormalizedMessage> = {}): NormalizedMessage => ({
  ruleId: 'no-console',
  severity: 'warning',
  message: 'Unexpected console statement.',
  file: 'src/foo.ts',
  line: 1,
  column: 1,
  ...overrides
});

const eslintResult = (
  filePath: string,
  messages: EslintFileResult['messages']
): EslintFileResult => ({
  filePath,
  messages
});

// ── normalizeMessages ─────────────────────────────────────────

describe('normalizeMessages', () => {
  test('returns empty array for empty results', () => {
    expect(normalizeMessages([], '/project/')).toEqual([]);
  });

  test('maps severity 1 to warning', () => {
    const result = eslintResult('/p/a.ts', [
      {ruleId: 'r', severity: 1, message: 'm', line: 1, column: 1}
    ]);
    expect(normalizeMessages([result], '/p/')[0].severity).toBe('warning');
  });

  test('maps severity 2 to error', () => {
    const result = eslintResult('/p/a.ts', [
      {ruleId: 'r', severity: 2, message: 'm', line: 1, column: 1}
    ]);
    expect(normalizeMessages([result], '/p/')[0].severity).toBe('error');
  });

  test('maps null ruleId to "unknown"', () => {
    const result = eslintResult('/p/a.ts', [
      {ruleId: null, severity: 1, message: 'm', line: 1, column: 1}
    ]);
    expect(normalizeMessages([result], '/p/')[0].ruleId).toBe('unknown');
  });

  test('strips cwd prefix from file path', () => {
    const result = eslintResult('/project/src/foo.ts', [
      {ruleId: 'r', severity: 1, message: 'm', line: 1, column: 1}
    ]);
    expect(normalizeMessages([result], '/project/')[0].file).toBe('src/foo.ts');
  });

  test('normalizes backslashes to forward slashes', () => {
    const result = eslintResult('C:\\project\\src\\foo.ts', [
      {ruleId: 'r', severity: 1, message: 'm', line: 1, column: 1}
    ]);
    expect(normalizeMessages([result], 'C:\\project\\')[0].file).toBe('src/foo.ts');
  });

  test('flattens messages from multiple files', () => {
    const results = [
      eslintResult('/p/a.ts', [{ruleId: 'r1', severity: 1, message: 'm', line: 1, column: 1}]),
      eslintResult('/p/b.ts', [{ruleId: 'r2', severity: 2, message: 'm', line: 2, column: 2}])
    ];
    expect(normalizeMessages(results, '/p/')).toHaveLength(2);
  });

  test('skips files with no messages', () => {
    const results = [
      eslintResult('/p/a.ts', []),
      eslintResult('/p/b.ts', [{ruleId: 'r', severity: 1, message: 'm', line: 1, column: 1}])
    ];
    expect(normalizeMessages(results, '/p/')).toHaveLength(1);
  });
});

// ── countBySeverity ───────────────────────────────────────────

describe('countBySeverity', () => {
  test('returns zeros for empty array', () => {
    expect(countBySeverity([])).toEqual({error: 0, warning: 0});
  });

  test('counts errors and warnings separately', () => {
    const messages = [
      msg({severity: 'error'}),
      msg({severity: 'error'}),
      msg({severity: 'warning'})
    ];
    expect(countBySeverity(messages)).toEqual({error: 2, warning: 1});
  });

  test('counts only warnings when no errors', () => {
    const messages = [msg(), msg()];
    expect(countBySeverity(messages)).toEqual({error: 0, warning: 2});
  });
});

// ── groupByRule ───────────────────────────────────────────────

describe('groupByRule', () => {
  test('groups messages by ruleId', () => {
    const messages = [
      msg({ruleId: 'no-console'}),
      msg({ruleId: 'no-console'}),
      msg({ruleId: 'no-unused-vars'})
    ];
    const grouped = groupByRule(messages);
    expect(grouped['no-console']).toHaveLength(2);
    expect(grouped['no-unused-vars']).toHaveLength(1);
  });

  test('returns empty object for empty array', () => {
    expect(groupByRule([])).toEqual({});
  });
});

// ── sortGroups ────────────────────────────────────────────────

describe('sortGroups', () => {
  test('puts error rules before warning rules', () => {
    const grouped = {
      'warn-rule': [msg({severity: 'warning'})],
      'error-rule': [msg({severity: 'error'})]
    };
    const sorted = sortGroups(grouped);
    expect(sorted[0][0]).toBe('error-rule');
    expect(sorted[1][0]).toBe('warn-rule');
  });

  test('sorts by occurrence count descending within same severity', () => {
    const grouped = {
      'rare-error': [msg({severity: 'error'})],
      'common-error': [msg({severity: 'error'}), msg({severity: 'error'}), msg({severity: 'error'})]
    };
    const sorted = sortGroups(grouped);
    expect(sorted[0][0]).toBe('common-error');
    expect(sorted[1][0]).toBe('rare-error');
  });

  test('a rule with mixed severities is treated as error', () => {
    const grouped = {
      'warn-only': [msg({severity: 'warning'})],
      'mixed-rule': [msg({severity: 'warning'}), msg({severity: 'error'})]
    };
    const sorted = sortGroups(grouped);
    expect(sorted[0][0]).toBe('mixed-rule');
  });
});

// ── fileLink ──────────────────────────────────────────────────

describe('fileLink', () => {
  test('generates correct GitHub blob URL', () => {
    expect(fileLink('src/foo.ts', 42, 'https://github.com', 'owner/repo', 'abc123')).toBe(
      'https://github.com/owner/repo/blob/abc123/src/foo.ts#L42'
    );
  });

  test('works with SHA "HEAD"', () => {
    expect(fileLink('index.ts', 1, 'https://github.com', 'org/repo', 'HEAD')).toBe(
      'https://github.com/org/repo/blob/HEAD/index.ts#L1'
    );
  });
});

// ── buildMarkdown ─────────────────────────────────────────────

describe('buildMarkdown', () => {
  const GH = {serverUrl: 'https://github.com', repo: 'owner/repo', sha: 'abc123'};

  test('returns "no lint issues" message when no messages', () => {
    const md = buildMarkdown([], 'My Report', GH.serverUrl, GH.repo, GH.sha);
    expect(md).toContain('No lint issues found');
    expect(md).toContain('My Report');
  });

  test('includes the title in the header', () => {
    const md = buildMarkdown(
      [msg({severity: 'error'})],
      'Custom Title',
      GH.serverUrl,
      GH.repo,
      GH.sha
    );
    expect(md).toContain('Custom Title');
  });

  test('includes error icon for error severity', () => {
    const md = buildMarkdown([msg({severity: 'error'})], 'Lint', GH.serverUrl, GH.repo, GH.sha);
    expect(md).toContain('🔴');
  });

  test('includes warning icon for warning severity', () => {
    const md = buildMarkdown([msg({severity: 'warning'})], 'Lint', GH.serverUrl, GH.repo, GH.sha);
    expect(md).toContain('🟡');
  });

  test('includes ruleId in output', () => {
    const md = buildMarkdown(
      [msg({ruleId: 'my-custom-rule'})],
      'Lint',
      GH.serverUrl,
      GH.repo,
      GH.sha
    );
    expect(md).toContain('my-custom-rule');
  });

  test('includes file link pointing to correct line', () => {
    const md = buildMarkdown(
      [msg({file: 'src/bar.ts', line: 99, severity: 'error'})],
      'Lint',
      GH.serverUrl,
      GH.repo,
      'deadbeef'
    );
    expect(md).toContain('https://github.com/owner/repo/blob/deadbeef/src/bar.ts#L99');
  });

  test('shows issue count summary', () => {
    const messages = [msg({severity: 'error'}), msg({severity: 'warning'})];
    const md = buildMarkdown(messages, 'Lint', GH.serverUrl, GH.repo, GH.sha);
    expect(md).toContain('**2**');
  });

  test('errors appear before warnings in output', () => {
    const messages = [
      msg({ruleId: 'warn-rule', severity: 'warning'}),
      msg({ruleId: 'error-rule', severity: 'error'})
    ];
    const md = buildMarkdown(messages, 'Lint', GH.serverUrl, GH.repo, GH.sha);
    expect(md.indexOf('error-rule')).toBeLessThan(md.indexOf('warn-rule'));
  });

  test('sorts lines within a file ascending', () => {
    const messages = [
      msg({ruleId: 'r', file: 'a.ts', line: 10}),
      msg({ruleId: 'r', file: 'a.ts', line: 3}),
      msg({ruleId: 'r', file: 'a.ts', line: 7})
    ];
    const md = buildMarkdown(messages, 'Lint', GH.serverUrl, GH.repo, GH.sha);
    const l3 = md.indexOf('L3');
    const l7 = md.indexOf('L7');
    const l10 = md.indexOf('L10');
    expect(l3).toBeLessThan(l7);
    expect(l7).toBeLessThan(l10);
  });
});
