import { expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { getVRValidator } from './index.js';

/**
 * The set of VR codes registered in the validator registry.
 */
const registeredVRCodes = [
  'AE', 'AS', 'CS', 'DA', 'DS', 'IS', 'LO', 'LT',
  'SH', 'ST', 'UC', 'UR', 'UT', 'OB', 'OW', 'TM', 'UI', 'PN',
] as const;

/**
 * Arbitrary that generates a VR code from the registered set.
 */
const vrCodeArb = fc.constantFrom(...registeredVRCodes);

/**
 * Feature: dicom-validator-ts
 * Property 2: VR Validation Skips Empty Values
 *
 * For any VR type and a zero-length (empty) tag value, VR format validation
 * SHALL produce zero findings for that tag.
 *
 * **Validates: Requirements 3.8**
 */
test.prop([vrCodeArb], { numRuns: 100 })(
  'Property 2: zero-length values produce zero findings for any VR type',
  (vrCode) => {
    const validator = getVRValidator(vrCode);
    expect(validator).toBeDefined();

    const findings = validator!('', '(0010,0010)');
    expect(findings).toEqual([]);
  },
);
