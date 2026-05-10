import type { ComparisonResult, ComparisonReport } from './types.js';
import type { ValidationFinding } from '../result/validation-result.js';

/**
 * Rule-to-pattern mapping for detecting pydicom/dicom-validator findings.
 *
 * validate_iods output uses phrases like:
 * - "has invalid value '...' for VR DA" → vr-format-DA
 * - "is missing" → type1-missing / type2-missing
 * - "is unexpected" → vr-unknown / vr-undetermined
 */
const PYDICOM_RULE_PATTERNS: Record<string, (msg: string, tag?: string) => boolean> = {
  'vr-format-AE': (msg) => /invalid value.*for VR AE/i.test(msg),
  'vr-format-AS': (msg) => /invalid value.*for VR AS/i.test(msg),
  'vr-format-CS': (msg) => /invalid value.*for VR CS/i.test(msg),
  'vr-format-DA': (msg) => /invalid value.*for VR DA/i.test(msg),
  'vr-format-DS': (msg) => /invalid value.*for VR DS/i.test(msg),
  'vr-format-IS': (msg) => /invalid value.*for VR IS/i.test(msg),
  'vr-format-LO': (msg) => /invalid value.*for VR LO/i.test(msg),
  'vr-format-LT': (msg) => /invalid value.*for VR LT/i.test(msg),
  'vr-format-PN': (msg) => /invalid value.*for VR PN/i.test(msg),
  'vr-format-SH': (msg) => /invalid value.*for VR SH/i.test(msg),
  'vr-format-ST': (msg) => /invalid value.*for VR ST/i.test(msg),
  'vr-format-TM': (msg) => /invalid value.*for VR TM/i.test(msg),
  'vr-format-UI': (msg) => /invalid value.*for VR UI/i.test(msg),
  'vr-format-UR': (msg) => /invalid value.*for VR UR/i.test(msg),
  'vr-format-UT': (msg) => /invalid value.*for VR UT/i.test(msg),
  'vm-constraint': (msg) => /too many|too few|value multiplicity/i.test(msg),
  'type1-missing': (msg) => /is missing/i.test(msg),
  'type1-empty': (msg) => /empty|zero.?length/i.test(msg),
  'type2-missing': (msg) => /is missing/i.test(msg),
  'iod-sop-class-missing': (msg) => /sop class.*missing|missing.*sop class/i.test(msg),
  'iod-sop-class-unknown': (msg) => /unknown.*sop|sop.*unknown|not.*found/i.test(msg),
  'vr-unknown': (msg) => /unexpected|unknown/i.test(msg),
  'vr-undetermined': (msg) => /unexpected|unknown/i.test(msg),
};

/**
 * Categorize the comparison between TS and Python validation results for a single file.
 *
 * Determines whether each validator detected the target rule:
 * - "agree": both validators detected the rule
 * - "ts-only": only dicom-validator-ts detected the rule
 * - "python-only": only pydicom/dicom-validator detected the rule
 *
 * For TS findings, detection is based on an exact match of the `rule` field.
 * For Python findings, detection uses rule-specific pattern matching against
 * the validate_iods output format. If pydicom output cannot be mapped to the
 * target rule, the file is categorized as "ts-only" per requirement 8.5.
 *
 * @param targetRule - The validation rule the test file was designed to trigger
 * @param tsFindings - Findings from dicom-validator-ts
 * @param pyFindings - Findings from pydicom/dicom-validator
 * @param expectedTag - Optional expected tag to narrow matching for module rules
 * @returns The category: "agree", "ts-only", or "python-only"
 *
 * Validates: Requirements 8.1, 8.2, 8.5
 */
export function categorize(
  targetRule: string,
  tsFindings: ValidationFinding[],
  pyFindings: { severity: string; message: string }[],
  expectedTag?: string,
): 'agree' | 'ts-only' | 'python-only' {
  // TS detected the rule if any finding has an exact match on the rule field
  const tsDetected = tsFindings.some(f => f.rule === targetRule);

  // Python detection uses rule-specific patterns
  const patternFn = PYDICOM_RULE_PATTERNS[targetRule];
  let pyDetected = false;

  if (patternFn) {
    pyDetected = pyFindings.some(f => {
      // If we have an expected tag, narrow the match to findings mentioning that tag
      if (expectedTag && !f.message.includes(expectedTag)) {
        return false;
      }
      return patternFn(f.message);
    });
  } else {
    // Fallback: check if any finding message contains the rule name
    const ruleAsWords = targetRule.replace(/-/g, ' ');
    pyDetected = pyFindings.some(
      f =>
        f.message.toLowerCase().includes(targetRule.toLowerCase()) ||
        f.message.toLowerCase().includes(ruleAsWords.toLowerCase()),
    );
  }

  if (tsDetected && pyDetected) return 'agree';
  if (tsDetected && !pyDetected) return 'ts-only';
  return 'python-only';
}

/**
 * Generate a comparison report from an array of comparison results.
 */
export function generateReport(results: ComparisonResult[]): ComparisonReport {
  return {
    totalFiles: results.length,
    agree: results.filter(r => r.category === 'agree').length,
    tsOnly: results.filter(r => r.category === 'ts-only').length,
    pythonOnly: results.filter(r => r.category === 'python-only').length,
    results,
  };
}

/**
 * Format a comparison report as human-readable text.
 * Includes full messages for disagreements (ts-only and python-only).
 */
export function formatReport(report: ComparisonReport): string {
  const lines: string[] = [
    '=== Cross-Validator Comparison Report ===',
    '',
    `Total files: ${report.totalFiles}`,
    `Agree: ${report.agree}`,
    `TS-only: ${report.tsOnly}`,
    `Python-only: ${report.pythonOnly}`,
    '',
  ];

  // Show disagreements with full messages
  const disagreements = report.results.filter(r => r.category !== 'agree');
  if (disagreements.length > 0) {
    lines.push('--- Disagreements ---');
    lines.push('');
    for (const result of disagreements) {
      lines.push(`File: ${result.filePath}`);
      lines.push(`Rule: ${result.targetRule}`);
      lines.push(`Category: ${result.category}`);
      if (result.tsFindings.length > 0) {
        lines.push('  TS findings:');
        for (const f of result.tsFindings) {
          lines.push(`    [${f.severity}] ${f.rule}: ${f.message}`);
        }
      }
      if (result.pyFindings.length > 0) {
        lines.push('  Python findings:');
        for (const f of result.pyFindings) {
          lines.push(`    [${f.severity}] ${f.message}`);
        }
      }
      lines.push('');
    }
  } else {
    lines.push('All validators agree on all test files.');
  }

  return lines.join('\n');
}
