import { expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { ValidationResult, ValidationFinding, Severity } from './validation-result.js';

/**
 * Arbitrary for generating a valid Severity value.
 */
const severityArb = fc.constantFrom<Severity>('error', 'warning', 'info');

/**
 * Arbitrary for generating a valid ValidationFinding object.
 */
const validationFindingArb: fc.Arbitrary<ValidationFinding> = fc.record({
  severity: severityArb,
  tag: fc.oneof(
    fc.constant(''),
    fc.tuple(
      fc.hexaString({ minLength: 4, maxLength: 4 }),
      fc.hexaString({ minLength: 4, maxLength: 4 }),
    ).map(([group, element]) => `(${group},${element})`),
  ),
  module: fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 50 })),
  message: fc.string({ minLength: 1, maxLength: 500 }),
  rule: fc.string({ minLength: 1, maxLength: 50 }),
});

/**
 * Feature: dicom-validator-ts
 * Property 7: Validation Result Summary Invariant
 *
 * For any ValidationResult instance, the summary counts SHALL equal the actual
 * number of findings of each severity: summary.errors === findings.filter(f => f.severity === 'error').length,
 * and passed === (summary.errors === 0).
 *
 * **Validates: Requirements 7.3, 7.4**
 */
test.prop([fc.array(validationFindingArb, { minLength: 0, maxLength: 50 })], { numRuns: 100 })(
  'Property 7: summary counts equal actual findings counts, passed === (errors === 0)',
  (findings) => {
    const result = new ValidationResult();

    for (const finding of findings) {
      result.addFinding(finding);
    }

    const expectedErrors = findings.filter(f => f.severity === 'error').length;
    const expectedWarnings = findings.filter(f => f.severity === 'warning').length;
    const expectedInfos = findings.filter(f => f.severity === 'info').length;

    // Summary counts must equal actual findings counts
    expect(result.summary.errors).toBe(expectedErrors);
    expect(result.summary.warnings).toBe(expectedWarnings);
    expect(result.summary.infos).toBe(expectedInfos);

    // passed === (summary.errors === 0)
    expect(result.passed).toBe(expectedErrors === 0);
  },
);
