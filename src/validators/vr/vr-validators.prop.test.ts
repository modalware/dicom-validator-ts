import { expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { validateDA } from './da.js';
import { validateTM } from './tm.js';
import { validateUI } from './ui.js';
import { validatePN } from './pn.js';

/**
 * Feature: dicom-validator-ts
 * Property 1: VR Validation Correctness
 *
 * Valid values produce zero errors, invalid values produce at least one error.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */

const tagId = '(0008,0020)';

// --- DA (Date) Validators ---

/**
 * Arbitrary for generating valid DA values (YYYYMMDD with valid dates).
 */
const validDAArb: fc.Arbitrary<string> = fc
  .record({
    year: fc.integer({ min: 1, max: 9999 }),
    month: fc.integer({ min: 1, max: 12 }),
    dayFraction: fc.double({ min: 0, max: 1, noNaN: true }),
  })
  .map(({ year, month, dayFraction }) => {
    const maxDays = daysInMonth(month, year);
    const day = Math.floor(dayFraction * (maxDays - 1)) + 1;
    const yyyy = year.toString().padStart(4, '0');
    const mm = month.toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  });

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month: number, year: number): number {
  switch (month) {
    case 1: case 3: case 5: case 7: case 8: case 10: case 12:
      return 31;
    case 4: case 6: case 9: case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

/**
 * Arbitrary for generating invalid DA values.
 */
const invalidDAArb: fc.Arbitrary<string> = fc.oneof(
  // Wrong length (not 8 digits)
  fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 1, maxLength: 7 }),
  fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 9, maxLength: 12 }),
  // Contains non-digit characters
  fc.tuple(
    fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 3, maxLength: 7 }),
    fc.constantFrom('a', 'b', '-', '/', ' ', '.'),
  ).map(([digits, char]) => digits + char),
  // Invalid month (00 or 13-99)
  fc.tuple(
    fc.integer({ min: 1, max: 9999 }),
    fc.constantFrom(0, 13, 14, 15, 99),
  ).map(([year, month]) => {
    const yyyy = year.toString().padStart(4, '0');
    const mm = month.toString().padStart(2, '0');
    return `${yyyy}${mm}15`;
  }),
  // Invalid day (00 or day > max for month)
  fc.tuple(
    fc.integer({ min: 1, max: 9999 }),
    fc.integer({ min: 1, max: 12 }),
  ).map(([year, month]) => {
    const yyyy = year.toString().padStart(4, '0');
    const mm = month.toString().padStart(2, '0');
    const maxDays = daysInMonth(month, year);
    const invalidDay = maxDays + 1;
    const dd = invalidDay.toString().padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }),
);

test.prop([validDAArb], { numRuns: 100 })(
  'Property 1 (DA valid): valid DA values produce zero findings',
  (value) => {
    const findings = validateDA(value, tagId);
    expect(findings).toHaveLength(0);
  },
);

test.prop([invalidDAArb], { numRuns: 100 })(
  'Property 1 (DA invalid): invalid DA values produce at least one finding',
  (value) => {
    const findings = validateDA(value, tagId);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  },
);

// --- TM (Time) Validators ---

/**
 * Arbitrary for generating valid TM values.
 * Valid formats: HH, HHMM, HHMMSS, HHMMSS.FFFFFF
 */
const validTMArb: fc.Arbitrary<string> = fc.oneof(
  // HH format
  fc.integer({ min: 0, max: 23 }).map((hh) => hh.toString().padStart(2, '0')),
  // HHMM format
  fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
  ).map(([hh, mm]) => `${hh.toString().padStart(2, '0')}${mm.toString().padStart(2, '0')}`),
  // HHMMSS format
  fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 59 }),
  ).map(([hh, mm, ss]) =>
    `${hh.toString().padStart(2, '0')}${mm.toString().padStart(2, '0')}${ss.toString().padStart(2, '0')}`
  ),
  // HHMMSS.FFFFFF format (1-6 fractional digits)
  fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 1, max: 6 }),
    fc.integer({ min: 0, max: 999999 }),
  ).map(([hh, mm, ss, fracLen, fracVal]) => {
    const frac = fracVal.toString().padStart(fracLen, '0').substring(0, fracLen);
    return `${hh.toString().padStart(2, '0')}${mm.toString().padStart(2, '0')}${ss.toString().padStart(2, '0')}.${frac}`;
  }),
);

test.prop([validTMArb], { numRuns: 100 })(
  'Property 1 (TM valid): valid TM values produce zero findings',
  (value) => {
    const findings = validateTM(value, tagId);
    expect(findings).toHaveLength(0);
  },
);

// --- UI (Unique Identifier) Validators ---

/**
 * Arbitrary for generating valid UI values.
 * Rules: digits and periods only, no leading/trailing period,
 * no empty components (no ".."), total length <= 64.
 */
const validUIArb: fc.Arbitrary<string> = fc
  .tuple(
    // Generate 1-10 numeric components
    fc.array(
      fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 1, maxLength: 6 }),
      { minLength: 1, maxLength: 10 },
    ),
  )
  .map(([components]) => components.join('.'))
  .filter((uid) => uid.length <= 64);

test.prop([validUIArb], { numRuns: 100 })(
  'Property 1 (UI valid): valid UI values produce zero findings',
  (value) => {
    const findings = validateUI(value, tagId);
    expect(findings).toHaveLength(0);
  },
);

// --- PN (Person Name) Validators ---

/**
 * Arbitrary for generating valid PN values.
 * Rules: up to 3 groups separated by "=", up to 5 components per group separated by "^",
 * each group <= 64 characters total.
 */
const validPNArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 1, max: 3 }), // number of groups
  )
  .chain(([numGroups]) =>
    fc.tuple(
      ...Array.from({ length: numGroups }, () => validPNGroupArb()),
    ),
  )
  .map((groups) => (groups as string[]).join('='));

function validPNGroupArb(): fc.Arbitrary<string> {
  return fc
    .integer({ min: 1, max: 5 })
    .chain((numComponents) =>
      fc.tuple(
        ...Array.from({ length: numComponents }, () =>
          // Each component: alphanumeric characters, short enough that group stays <= 64
          fc.string({ minLength: 0, maxLength: 10, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')) }),
        ),
      ),
    )
    .map((components) => (components as string[]).join('^'))
    .filter((group) => group.length <= 64);
}

test.prop([validPNArb], { numRuns: 100 })(
  'Property 1 (PN valid): valid PN values produce zero findings',
  (value) => {
    const findings = validatePN(value, tagId);
    expect(findings).toHaveLength(0);
  },
);
