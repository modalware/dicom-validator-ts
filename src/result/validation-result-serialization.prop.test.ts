import { expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { ValidationResult, type ValidationFinding, type Severity } from './validation-result.js';

/**
 * Property 8: Validation Result Serialization Round-Trip
 *
 * For any ValidationResult instance, JSON.parse(JSON.stringify(result.toJSON()))
 * SHALL produce an object with a "findings" array and "summary" object that are
 * structurally equivalent to the original.
 *
 * **Validates: Requirements 7.5**
 */

/** Arbitrary for Severity */
const severityArb: fc.Arbitrary<Severity> = fc.constantFrom('error', 'warning', 'info');

/** Arbitrary for a DICOM tag string in "(GGGG,EEEE)" format or empty string */
const tagArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.tuple(
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 4, maxLength: 4 })
  ).map(([group, element]) => `(${group},${element})`)
);

/** Arbitrary for a module name (string, possibly empty) */
const moduleArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.stringOf(fc.char(), { minLength: 1, maxLength: 50 })
);

/** Arbitrary for a human-readable message (1-500 chars) */
const messageArb: fc.Arbitrary<string> = fc.stringOf(fc.char(), { minLength: 1, maxLength: 100 });

/** Arbitrary for a rule identifier */
const ruleArb: fc.Arbitrary<string> = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
  { minLength: 1, maxLength: 30 }
);

/** Arbitrary for a single ValidationFinding */
const validationFindingArb: fc.Arbitrary<ValidationFinding> = fc.record({
  severity: severityArb,
  tag: tagArb,
  module: moduleArb,
  message: messageArb,
  rule: ruleArb,
});

/** Arbitrary for a list of ValidationFinding objects */
const findingsListArb: fc.Arbitrary<ValidationFinding[]> = fc.array(validationFindingArb, {
  minLength: 0,
  maxLength: 20,
});

test.prop([findingsListArb], { numRuns: 100 })(
  'Property 8: Validation Result Serialization Round-Trip — JSON.parse(JSON.stringify(result.toJSON())) is structurally equivalent',
  (findings) => {
    const result = new ValidationResult();

    for (const finding of findings) {
      result.addFinding(finding);
    }

    const json = result.toJSON();
    const roundTripped = JSON.parse(JSON.stringify(json));

    // The round-tripped object should be structurally equivalent to the original
    expect(roundTripped).toEqual(json);

    // Verify the structure has the expected shape
    expect(roundTripped).toHaveProperty('findings');
    expect(roundTripped).toHaveProperty('summary');
    expect(Array.isArray(roundTripped.findings)).toBe(true);
    expect(roundTripped.findings).toHaveLength(findings.length);
    expect(typeof roundTripped.summary.errors).toBe('number');
    expect(typeof roundTripped.summary.warnings).toBe('number');
    expect(typeof roundTripped.summary.infos).toBe('number');
  }
);
