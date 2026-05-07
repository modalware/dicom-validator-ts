import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { ValidationResult, ValidationFinding, Severity } from './validation-result.js';

/**
 * Feature: dicom-validator-ts
 * Property 9: Findings Collection Integrity
 *
 * For any sequence of findings added to a ValidationResult, the `findings` array
 * SHALL preserve insertion order, and `getFindings(severity)` SHALL return exactly
 * the subset of findings matching that severity.
 *
 * **Validates: Requirements 7.6, 7.7**
 */

const severityArb: fc.Arbitrary<Severity> = fc.constantFrom('error', 'warning', 'info');

const validationFindingArb: fc.Arbitrary<ValidationFinding> = fc.record({
  severity: severityArb,
  tag: fc.oneof(
    fc.constant(''),
    fc.tuple(
      fc.hexaString({ minLength: 4, maxLength: 4 }),
      fc.hexaString({ minLength: 4, maxLength: 4 }),
    ).map(([g, e]) => `(${g},${e})`),
  ),
  module: fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 50 })),
  message: fc.string({ minLength: 1, maxLength: 500 }),
  rule: fc.string({ minLength: 1, maxLength: 100 }),
});

const findingsListArb = fc.array(validationFindingArb, { minLength: 0, maxLength: 50 });

describe('Property 9: Findings Collection Integrity', () => {
  test.prop([findingsListArb], { numRuns: 100 })(
    'result.findings preserves exact insertion order',
    (findings) => {
      const result = new ValidationResult();
      for (const f of findings) {
        result.addFinding(f);
      }

      expect(result.findings).toHaveLength(findings.length);
      for (let i = 0; i < findings.length; i++) {
        expect(result.findings[i]).toEqual(findings[i]);
      }
    },
  );

  test.prop([findingsListArb], { numRuns: 100 })(
    'getFindings("error") returns exactly the subset with severity "error" in order',
    (findings) => {
      const result = new ValidationResult();
      for (const f of findings) {
        result.addFinding(f);
      }

      const expectedErrors = findings.filter(f => f.severity === 'error');
      const actualErrors = result.getFindings('error');

      expect(actualErrors).toHaveLength(expectedErrors.length);
      for (let i = 0; i < expectedErrors.length; i++) {
        expect(actualErrors[i]).toEqual(expectedErrors[i]);
      }
    },
  );

  test.prop([findingsListArb], { numRuns: 100 })(
    'getFindings("warning") returns exactly the subset with severity "warning" in order',
    (findings) => {
      const result = new ValidationResult();
      for (const f of findings) {
        result.addFinding(f);
      }

      const expectedWarnings = findings.filter(f => f.severity === 'warning');
      const actualWarnings = result.getFindings('warning');

      expect(actualWarnings).toHaveLength(expectedWarnings.length);
      for (let i = 0; i < expectedWarnings.length; i++) {
        expect(actualWarnings[i]).toEqual(expectedWarnings[i]);
      }
    },
  );

  test.prop([findingsListArb], { numRuns: 100 })(
    'getFindings("info") returns exactly the subset with severity "info" in order',
    (findings) => {
      const result = new ValidationResult();
      for (const f of findings) {
        result.addFinding(f);
      }

      const expectedInfos = findings.filter(f => f.severity === 'info');
      const actualInfos = result.getFindings('info');

      expect(actualInfos).toHaveLength(expectedInfos.length);
      for (let i = 0; i < expectedInfos.length; i++) {
        expect(actualInfos[i]).toEqual(expectedInfos[i]);
      }
    },
  );
});
