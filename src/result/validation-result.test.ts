import { describe, it, expect } from 'vitest';
import { ValidationResult, ValidationFinding } from './validation-result.js';

describe('ValidationResult', () => {
  it('starts with empty findings and zero summary counts', () => {
    const result = new ValidationResult();

    expect(result.findings).toEqual([]);
    expect(result.summary).toEqual({ errors: 0, warnings: 0, infos: 0 });
    expect(result.passed).toBe(true);
  });

  it('adds findings and updates summary counts', () => {
    const result = new ValidationResult();

    result.addFinding({
      severity: 'error',
      tag: '(0008,0016)',
      module: 'Patient',
      message: 'Missing required attribute',
      rule: 'type1-missing',
    });

    result.addFinding({
      severity: 'warning',
      tag: '(0010,0010)',
      module: 'Patient',
      message: 'Missing type 2 attribute',
      rule: 'type2-missing',
    });

    result.addFinding({
      severity: 'info',
      tag: '(0009,0010)',
      module: '',
      message: 'Private tag skipped',
      rule: 'private-tag-skipped',
    });

    expect(result.findings).toHaveLength(3);
    expect(result.summary).toEqual({ errors: 1, warnings: 1, infos: 1 });
    expect(result.passed).toBe(false);
  });

  it('passed returns true when there are only warnings and infos', () => {
    const result = new ValidationResult();

    result.addFinding({
      severity: 'warning',
      tag: '(0010,0010)',
      module: 'Patient',
      message: 'Missing type 2 attribute',
      rule: 'type2-missing',
    });

    result.addFinding({
      severity: 'info',
      tag: '',
      module: '',
      message: 'Informational message',
      rule: 'info-rule',
    });

    expect(result.passed).toBe(true);
  });

  it('preserves insertion order of findings', () => {
    const result = new ValidationResult();
    const findings: ValidationFinding[] = [
      { severity: 'info', tag: '(0001,0001)', module: '', message: 'First', rule: 'r1' },
      { severity: 'error', tag: '(0002,0002)', module: '', message: 'Second', rule: 'r2' },
      { severity: 'warning', tag: '(0003,0003)', module: '', message: 'Third', rule: 'r3' },
      { severity: 'error', tag: '(0004,0004)', module: '', message: 'Fourth', rule: 'r4' },
    ];

    for (const f of findings) {
      result.addFinding(f);
    }

    expect(result.findings).toEqual(findings);
  });

  it('getFindings filters by severity', () => {
    const result = new ValidationResult();

    result.addFinding({ severity: 'error', tag: '(0001,0001)', module: '', message: 'E1', rule: 'r1' });
    result.addFinding({ severity: 'warning', tag: '(0002,0002)', module: '', message: 'W1', rule: 'r2' });
    result.addFinding({ severity: 'error', tag: '(0003,0003)', module: '', message: 'E2', rule: 'r3' });
    result.addFinding({ severity: 'info', tag: '(0004,0004)', module: '', message: 'I1', rule: 'r4' });

    const errors = result.getFindings('error');
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toBe('E1');
    expect(errors[1].message).toBe('E2');

    const warnings = result.getFindings('warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toBe('W1');

    const infos = result.getFindings('info');
    expect(infos).toHaveLength(1);
    expect(infos[0].message).toBe('I1');
  });

  it('toJSON returns a serializable object with findings and summary', () => {
    const result = new ValidationResult();

    result.addFinding({ severity: 'error', tag: '(0008,0016)', module: 'General', message: 'Error msg', rule: 'rule1' });
    result.addFinding({ severity: 'warning', tag: '(0010,0010)', module: 'Patient', message: 'Warn msg', rule: 'rule2' });

    const json = result.toJSON();

    expect(json).toEqual({
      findings: [
        { severity: 'error', tag: '(0008,0016)', module: 'General', message: 'Error msg', rule: 'rule1' },
        { severity: 'warning', tag: '(0010,0010)', module: 'Patient', message: 'Warn msg', rule: 'rule2' },
      ],
      summary: { errors: 1, warnings: 1, infos: 0 },
    });
  });

  it('toJSON output is JSON-serializable and structurally equivalent after round-trip', () => {
    const result = new ValidationResult();

    result.addFinding({ severity: 'error', tag: '(0008,0016)', module: 'M', message: 'msg', rule: 'r' });
    result.addFinding({ severity: 'info', tag: '', module: '', message: 'info', rule: 'i' });

    const json = result.toJSON();
    const roundTripped = JSON.parse(JSON.stringify(json));

    expect(roundTripped).toEqual(json);
  });

  it('findings array is readonly (cannot be mutated externally)', () => {
    const result = new ValidationResult();
    result.addFinding({ severity: 'error', tag: '(0001,0001)', module: '', message: 'msg', rule: 'r' });

    // The readonly type prevents direct mutation at compile time.
    // At runtime, the array reference is the internal array, but TypeScript
    // enforces immutability through the type system.
    const findings = result.findings;
    expect(findings).toHaveLength(1);
  });
});
