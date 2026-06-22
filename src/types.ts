export interface EslintMessage {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
}

export interface EslintFileResult {
  filePath: string;
  messages: EslintMessage[];
}

export type Severity = 'error' | 'warning';

export interface NormalizedMessage {
  ruleId: string;
  severity: Severity;
  message: string;
  file: string;
  line: number;
  column: number;
}
