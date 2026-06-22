import type {Severity, NormalizedMessage, EslintFileResult} from './types';

export const SEVERITY_MAP: Record<1 | 2, Severity> = {1: 'warning', 2: 'error'};
export const SEVERITY_ICON: Record<Severity, string> = {error: '🔴', warning: '🟡'};

export function normalizeMessages(results: EslintFileResult[], cwd: string): NormalizedMessage[] {
  return results.flatMap((fileResult) =>
    fileResult.messages.map((msg) => ({
      ruleId: msg.ruleId ?? 'unknown',
      severity: SEVERITY_MAP[msg.severity] ?? 'warning',
      message: msg.message,
      file: fileResult.filePath.replace(cwd, '').replace(/\\/g, '/'),
      line: msg.line,
      column: msg.column
    }))
  );
}

export function countBySeverity(messages: NormalizedMessage[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {error: 0, warning: 0};
  for (const m of messages) counts[m.severity]++;
  return counts;
}

export function groupByRule(messages: NormalizedMessage[]): Record<string, NormalizedMessage[]> {
  return messages.reduce<Record<string, NormalizedMessage[]>>((acc, m) => {
    (acc[m.ruleId] ??= []).push(m);
    return acc;
  }, {});
}

export function sortGroups(
  grouped: Record<string, NormalizedMessage[]>
): [string, NormalizedMessage[]][] {
  return Object.entries(grouped).sort(([, a], [, b]) => {
    const sevA = a.some((x) => x.severity === 'error') ? 0 : 1;
    const sevB = b.some((x) => x.severity === 'error') ? 0 : 1;
    if (sevA !== sevB) return sevA - sevB;
    return b.length - a.length;
  });
}

export function fileLink(
  file: string,
  line: number,
  serverUrl: string,
  repository: string,
  sha: string
): string {
  return `${serverUrl}/${repository}/blob/${sha}/${file}#L${line}`;
}

export function buildMarkdown(
  messages: NormalizedMessage[],
  title: string,
  serverUrl: string,
  repository: string,
  sha: string
): string {
  if (!messages.length) {
    return `## 🔍 ${title}\n\n✅ **No lint issues found.**\n`;
  }

  const counts = countBySeverity(messages);
  const grouped = groupByRule(messages);
  const sorted = sortGroups(grouped);

  let md = `## 🔍 ${title}\n\n`;

  md += '| Severity | Count |\n|----------|-------|\n';
  if (counts.error) md += `| ${SEVERITY_ICON.error} error | **${counts.error}** |\n`;
  if (counts.warning) md += `| ${SEVERITY_ICON.warning} warning | **${counts.warning}** |\n`;
  md += `\n**${messages.length}** issue(s) across **${Object.keys(grouped).length}** rule(s)\n\n`;

  for (const [ruleId, items] of sorted) {
    const hasError = items.some((x) => x.severity === 'error');
    const icon = hasError ? SEVERITY_ICON.error : SEVERITY_ICON.warning;
    const severity: Severity = hasError ? 'error' : 'warning';

    md += `<details><summary>${icon} <strong>${ruleId}</strong>`;
    md += ` — ${items.length} occurrence(s) · ${severity}`;
    md += '</summary>\n\n';

    const byFile = items.reduce<Record<string, NormalizedMessage[]>>((acc, m) => {
      (acc[m.file] ??= []).push(m);
      return acc;
    }, {});

    md += '| File | Line | Message |\n';
    md += '|------|------|---------|\n';

    for (const [file, msgs] of Object.entries(byFile)) {
      for (const m of msgs.sort((a, b) => a.line - b.line)) {
        const link = fileLink(file, m.line, serverUrl, repository, sha);
        md += `| [\`${file}\`](${link}) | [${m.line}:${m.column}](${link}) | ${m.message} |\n`;
      }
    }

    md += '\n</details>\n\n';
  }

  return md;
}
