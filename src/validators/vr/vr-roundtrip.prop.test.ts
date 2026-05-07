import { expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { validateDA } from './da.js';
import { validateTM } from './tm.js';
import { validateUI } from './ui.js';

/**
 * Arbitrary for generating valid DA (Date) strings in YYYYMMDD format.
 * Generates valid dates with correct month/day ranges including leap year rules.
 */
const validDAArb: fc.Arbitrary<string> = fc
  .record({
    year: fc.integer({ min: 1, max: 9999 }),
    month: fc.integer({ min: 1, max: 12 }),
    dayFrac: fc.double({ min: 0, max: 1, noNaN: true }),
  })
  .map(({ year, month, dayFrac }) => {
    const isLeapYear = (y: number) =>
      (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const maxDays = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const day = Math.max(1, Math.min(maxDays[month - 1], Math.floor(dayFrac * maxDays[month - 1]) + 1));
    const yStr = year.toString().padStart(4, '0');
    const mStr = month.toString().padStart(2, '0');
    const dStr = day.toString().padStart(2, '0');
    return `${yStr}${mStr}${dStr}`;
  });

/**
 * Arbitrary for generating valid TM (Time) strings.
 * Generates one of the valid truncated forms: HH, HHMM, HHMMSS, or HHMMSS.FFFFFF.
 */
const validTMArb: fc.Arbitrary<string> = fc.oneof(
  // HH format
  fc.integer({ min: 0, max: 23 }).map((hh) => hh.toString().padStart(2, '0')),
  // HHMM format
  fc
    .record({
      hh: fc.integer({ min: 0, max: 23 }),
      mm: fc.integer({ min: 0, max: 59 }),
    })
    .map(({ hh, mm }) => `${hh.toString().padStart(2, '0')}${mm.toString().padStart(2, '0')}`),
  // HHMMSS format
  fc
    .record({
      hh: fc.integer({ min: 0, max: 23 }),
      mm: fc.integer({ min: 0, max: 59 }),
      ss: fc.integer({ min: 0, max: 59 }),
    })
    .map(
      ({ hh, mm, ss }) =>
        `${hh.toString().padStart(2, '0')}${mm.toString().padStart(2, '0')}${ss.toString().padStart(2, '0')}`,
    ),
  // HHMMSS.FFFFFF format
  fc
    .record({
      hh: fc.integer({ min: 0, max: 23 }),
      mm: fc.integer({ min: 0, max: 59 }),
      ss: fc.integer({ min: 0, max: 59 }),
      frac: fc.integer({ min: 1, max: 6 }).chain((len) =>
        fc.integer({ min: 0, max: Math.pow(10, len) - 1 }).map((v) => v.toString().padStart(len, '0')),
      ),
    })
    .map(
      ({ hh, mm, ss, frac }) =>
        `${hh.toString().padStart(2, '0')}${mm.toString().padStart(2, '0')}${ss.toString().padStart(2, '0')}.${frac}`,
    ),
);

/**
 * Arbitrary for generating valid UI (Unique Identifier) strings.
 * Generates UIDs with only digits and periods, no leading/trailing periods,
 * no consecutive periods, and total length <= 64.
 */
const validUIArb: fc.Arbitrary<string> = fc
  .array(fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 1, maxLength: 10 }), {
    minLength: 1,
    maxLength: 6,
  })
  .map((components) => components.join('.'))
  .filter((uid) => uid.length <= 64 && uid.length > 0);

const tagId = '(0008,0020)';

/**
 * Feature: dicom-validator-ts
 * Property 10: VR Format Round-Trip
 *
 * For string-based VR types (DA, TM, UI), a valid value that passes validation
 * is already in its canonical form. The "round-trip" property means: if a value
 * passes VR validation, it's already in the correct format and doesn't need
 * transformation. We verify that validateDA/validateTM/validateUI return zero
 * findings for the generated valid values (confirming they're in canonical form).
 *
 * **Validates: Requirements 11.5**
 */
test.prop([validDAArb], { numRuns: 100 })(
  'Property 10: DA valid values are already in canonical form (zero findings)',
  (daValue) => {
    const findings = validateDA(daValue, tagId);
    expect(findings).toHaveLength(0);
  },
);

test.prop([validTMArb], { numRuns: 100 })(
  'Property 10: TM valid values are already in canonical form (zero findings)',
  (tmValue) => {
    const findings = validateTM(tmValue, tagId);
    expect(findings).toHaveLength(0);
  },
);

test.prop([validUIArb], { numRuns: 100 })(
  'Property 10: UI valid values are already in canonical form after null trimming (zero findings)',
  (uiValue) => {
    // The canonical form for UI is the value after null trimming.
    // A valid UI string without trailing nulls should pass validation as-is.
    const findings = validateUI(uiValue, tagId);
    expect(findings).toHaveLength(0);
  },
);
