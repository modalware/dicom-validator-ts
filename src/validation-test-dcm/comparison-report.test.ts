import { describe, test, expect } from 'vitest';
import { categorize, generateReport, formatReport } from './comparison-report.js';
import type { ValidationFinding } from '../result/validation-result.js';
import type { ComparisonResult } from './types.js';

const makeTsFinding = (rule: string): ValidationFinding => ({
  severity: 'error',
  tag: '(0010,0010)',
  module: 'Patient',
  message: `Validation failed for rule ${rule}`,
  rule,
});

describe('categorize', () => {
  test('returns "agree" when both validators detect vr-format-DA', () => {
    const tsFindings = [makeTsFinding('vr-format-DA')];
    const pyFindings = [{ severity: 'Error', message: "[General Study] Tag (0008,0020) (Study Date) has invalid value '2024-01-01' for VR DA" }];

    expect(categorize('vr-format-DA', tsFindings, pyFindings)).toBe('agree');
  });

  test('returns "agree" when Python reports "is missing" for type1-missing with matching tag', () => {
    const tsFindings = [makeTsFinding('type1-missing')];
    const pyFindings = [{ severity: 'Error', message: '[General Series] Tag (0008,0060) (Modality) is missing' }];

    expect(categorize('type1-missing', tsFindings, pyFindings, '(0008,0060)')).toBe('agree');
  });

  test('returns "ts-only" when only TS detects the target rule', () => {
    const tsFindings = [makeTsFinding('vr-format-CS')];
    const pyFindings = [{ severity: 'Error', message: '[Patient] Tag (0010,0030) (Birth Date) is missing' }];

    expect(categorize('vr-format-CS', tsFindings, pyFindings)).toBe('ts-only');
  });

  test('returns "ts-only" when Python findings are empty', () => {
    const tsFindings = [makeTsFinding('vm-constraint')];
    const pyFindings: { severity: string; message: string }[] = [];

    expect(categorize('vm-constraint', tsFindings, pyFindings)).toBe('ts-only');
  });

  test('returns "python-only" when only Python detects the target rule', () => {
    const tsFindings: ValidationFinding[] = [];
    const pyFindings = [{ severity: 'Error', message: "[General Study] Tag (0020,0013) (Instance Number) has invalid value 'abc' for VR IS" }];

    expect(categorize('vr-format-IS', tsFindings, pyFindings)).toBe('python-only');
  });

  test('returns "python-only" when TS findings do not match the target rule', () => {
    const tsFindings = [makeTsFinding('vr-format-DA')]; // different rule
    const pyFindings = [{ severity: 'Error', message: "[General Series] Tag (0008,0060) (Modality) has invalid value 'invalid_lower' for VR CS" }];

    expect(categorize('vr-format-CS', tsFindings, pyFindings)).toBe('python-only');
  });

  test('returns "ts-only" when pydicom output cannot be mapped to target rule (req 8.5)', () => {
    const tsFindings = [makeTsFinding('iod-sop-class-unknown')];
    // pydicom doesn't report "unknown" in its message for this case
    const pyFindings = [{ severity: 'Error', message: '[CT Image] Tag (0028,0010) (Rows) is missing' }];

    expect(categorize('iod-sop-class-unknown', tsFindings, pyFindings)).toBe('ts-only');
  });

  test('narrows type1-missing match by expectedTag', () => {
    const tsFindings = [makeTsFinding('type1-missing')];
    // Python reports many "is missing" findings, but only one matches our expected tag
    const pyFindings = [
      { severity: 'Error', message: '[Patient] Tag (0010,0030) (Birth Date) is missing' },
      { severity: 'Error', message: '[General Series] Tag (0008,0060) (Modality) is missing' },
    ];

    // With expectedTag, only the matching one counts
    expect(categorize('type1-missing', tsFindings, pyFindings, '(0008,0060)')).toBe('agree');
  });
});

describe('generateReport', () => {
  test('returns correct totals for empty results', () => {
    const report = generateReport([]);
    expect(report.totalFiles).toBe(0);
    expect(report.agree).toBe(0);
    expect(report.tsOnly).toBe(0);
    expect(report.pythonOnly).toBe(0);
    expect(report.results).toEqual([]);
  });

  test('counts categories correctly', () => {
    const results: ComparisonResult[] = [
      {
        filePath: 'vr/vr-format-DA.dcm',
        targetRule: 'vr-format-DA',
        category: 'agree',
        tsFindings: [{ severity: 'error', tag: '(0008,0020)', module: '', message: 'Invalid date', rule: 'vr-format-DA' }],
        pyFindings: [{ severity: 'Error', message: 'Invalid date format' }],
      },
      {
        filePath: 'vm/vm-constraint-too-many.dcm',
        targetRule: 'vm-constraint',
        category: 'ts-only',
        tsFindings: [{ severity: 'error', tag: '(0020,0037)', module: '', message: 'Too many values', rule: 'vm-constraint' }],
        pyFindings: [],
      },
      {
        filePath: 'module/type1-missing.dcm',
        targetRule: 'type1-missing',
        category: 'python-only',
        tsFindings: [],
        pyFindings: [{ severity: 'Error', message: 'Missing type 1 attribute' }],
      },
      {
        filePath: 'vr/vr-format-CS.dcm',
        targetRule: 'vr-format-CS',
        category: 'agree',
        tsFindings: [{ severity: 'error', tag: '(0008,0060)', module: '', message: 'Invalid CS', rule: 'vr-format-CS' }],
        pyFindings: [{ severity: 'Error', message: 'Invalid CS value' }],
      },
    ];

    const report = generateReport(results);
    expect(report.totalFiles).toBe(4);
    expect(report.agree).toBe(2);
    expect(report.tsOnly).toBe(1);
    expect(report.pythonOnly).toBe(1);
    expect(report.results).toBe(results);
  });
});

describe('formatReport', () => {
  test('formats report with all agreements', () => {
    const report = generateReport([
      {
        filePath: 'vr/vr-format-DA.dcm',
        targetRule: 'vr-format-DA',
        category: 'agree',
        tsFindings: [{ severity: 'error', tag: '(0008,0020)', module: '', message: 'Invalid date', rule: 'vr-format-DA' }],
        pyFindings: [{ severity: 'Error', message: 'Invalid date format' }],
      },
    ]);

    const text = formatReport(report);
    expect(text).toContain('=== Cross-Validator Comparison Report ===');
    expect(text).toContain('Total files: 1');
    expect(text).toContain('Agree: 1');
    expect(text).toContain('TS-only: 0');
    expect(text).toContain('Python-only: 0');
    expect(text).toContain('All validators agree on all test files.');
  });

  test('formats report with disagreements including full messages', () => {
    const results: ComparisonResult[] = [
      {
        filePath: 'vm/vm-constraint-too-many.dcm',
        targetRule: 'vm-constraint',
        category: 'ts-only',
        tsFindings: [{ severity: 'error', tag: '(0020,0037)', module: '', message: 'Too many values for VM', rule: 'vm-constraint' }],
        pyFindings: [],
      },
      {
        filePath: 'module/type1-missing.dcm',
        targetRule: 'type1-missing',
        category: 'python-only',
        tsFindings: [],
        pyFindings: [{ severity: 'Error', message: 'Required attribute missing' }],
      },
    ];

    const report = generateReport(results);
    const text = formatReport(report);

    expect(text).toContain('Total files: 2');
    expect(text).toContain('Agree: 0');
    expect(text).toContain('TS-only: 1');
    expect(text).toContain('Python-only: 1');
    expect(text).toContain('--- Disagreements ---');
    expect(text).toContain('File: vm/vm-constraint-too-many.dcm');
    expect(text).toContain('Rule: vm-constraint');
    expect(text).toContain('Category: ts-only');
    expect(text).toContain('[error] vm-constraint: Too many values for VM');
    expect(text).toContain('File: module/type1-missing.dcm');
    expect(text).toContain('Rule: type1-missing');
    expect(text).toContain('Category: python-only');
    expect(text).toContain('[Error] Required attribute missing');
  });

  test('formats report with empty results', () => {
    const report = generateReport([]);
    const text = formatReport(report);

    expect(text).toContain('Total files: 0');
    expect(text).toContain('All validators agree on all test files.');
  });
});
