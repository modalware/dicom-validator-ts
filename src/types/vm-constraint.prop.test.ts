import { expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { parseVMConstraint, satisfiesVM } from './vm-constraint.js';

/**
 * Feature: dicom-validator-ts
 * Property 3: VM Constraint Satisfaction
 *
 * For any VM constraint string in DICOM standard format (fixed number, range,
 * range with "n", or multiplier notation) and for any value count, parsing the
 * VM constraint and evaluating the count SHALL return true if and only if the
 * count satisfies the constraint.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 11.6**
 */

/**
 * Arbitrary for generating a positive integer (used as fixed VM value or range bounds).
 * DICOM VM values are typically small positive integers.
 */
const positiveIntArb = fc.integer({ min: 1, max: 100 });

/**
 * Arbitrary for generating a count value to test against constraints.
 * Includes 0 and negative values to test boundary behavior.
 */
const countArb = fc.integer({ min: -5, max: 200 });

/**
 * Property 3.1: Fixed VM constraint "N"
 * satisfiesVM returns true iff count === N
 */
test.prop([positiveIntArb, countArb], { numRuns: 100 })(
  'Property 3: Fixed "N" — satisfiesVM returns true iff count === N',
  (n, count) => {
    const vmString = `${n}`;
    const constraint = parseVMConstraint(vmString);

    expect(constraint.min).toBe(n);
    expect(constraint.max).toBe(n);
    expect(constraint.step).toBe(1);

    const result = satisfiesVM(count, constraint);
    const expected = count === n;
    expect(result).toBe(expected);
  },
);

/**
 * Property 3.2: Range VM constraint "M-N"
 * satisfiesVM returns true iff M <= count <= N
 */
test.prop(
  [positiveIntArb, positiveIntArb, countArb],
  { numRuns: 100 },
)(
  'Property 3: Range "M-N" — satisfiesVM returns true iff M <= count <= N',
  (a, b, count) => {
    // Ensure M <= N by sorting
    const m = Math.min(a, b);
    const n = Math.max(a, b);
    // Skip when m === n as that's a fixed constraint, not a range
    fc.pre(m < n);

    const vmString = `${m}-${n}`;
    const constraint = parseVMConstraint(vmString);

    expect(constraint.min).toBe(m);
    expect(constraint.max).toBe(n);
    expect(constraint.step).toBe(1);

    const result = satisfiesVM(count, constraint);
    const expected = count >= m && count <= n;
    expect(result).toBe(expected);
  },
);

/**
 * Property 3.3: Unbounded VM constraint "M-n"
 * satisfiesVM returns true iff count >= M
 */
test.prop([positiveIntArb, countArb], { numRuns: 100 })(
  'Property 3: Unbounded "M-n" — satisfiesVM returns true iff count >= M',
  (m, count) => {
    const vmString = `${m}-n`;
    const constraint = parseVMConstraint(vmString);

    expect(constraint.min).toBe(m);
    expect(constraint.max).toBeNull();
    expect(constraint.step).toBe(1);

    const result = satisfiesVM(count, constraint);
    const expected = count >= m;
    expect(result).toBe(expected);
  },
);

/**
 * Property 3.4: Multiplier VM constraint "M-Mn"
 * satisfiesVM returns true iff count >= M && count % M === 0
 */
test.prop(
  [fc.integer({ min: 2, max: 50 }), countArb],
  { numRuns: 100 },
)(
  'Property 3: Multiplier "M-Mn" — satisfiesVM returns true iff count >= M && count % M === 0',
  (m, count) => {
    const vmString = `${m}-${m}n`;
    const constraint = parseVMConstraint(vmString);

    expect(constraint.min).toBe(m);
    expect(constraint.max).toBeNull();
    expect(constraint.step).toBe(m);

    const result = satisfiesVM(count, constraint);
    const expected = count >= m && count % m === 0;
    expect(result).toBe(expected);
  },
);
