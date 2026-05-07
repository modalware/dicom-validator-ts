import { expect, afterEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { validateDataset } from './validator.js';
import { DicomDataset } from './types/dataset.js';
import type { DicomElement } from './types/dataset.js';
import { DictionaryLoader } from './dictionary/loader.js';

/**
 * Feature: dicom-validator-ts
 * Property 13: Disabled Check Categories
 *
 * For any validation run with a specific check category disabled (VR, VM, or IOD),
 * the ValidationResult SHALL contain zero findings originating from that category.
 *
 * **Validates: Requirements 8.7**
 */

/** CT Image Storage SOP Class UID */
const CT_SOP_CLASS_UID = '1.2.840.10008.5.1.4.1.1.2';

/**
 * Arbitrary for generating a standard DICOM tag string "(GGGG,EEEE)" with even group number.
 * Avoids (0008,0016) to not conflict with SOP Class UID tag.
 * Uses group numbers in the range 0008-0032 (common DICOM groups).
 */
const standardTagArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom(0x0008, 0x0010, 0x0018, 0x0020, 0x0028, 0x0032),
    fc.integer({ min: 0x0001, max: 0x00ff }),
  )
  .filter(([group, element]) => !(group === 0x0008 && element === 0x0016)) // avoid SOP Class UID
  .map(([group, element]) => {
    const groupHex = group.toString(16).toUpperCase().padStart(4, '0');
    const elementHex = element.toString(16).toUpperCase().padStart(4, '0');
    return `(${groupHex},${elementHex})`;
  });

/**
 * Arbitrary for generating invalid VR values for common VR types.
 * These values are intentionally malformed to trigger VR validation errors.
 */
const invalidVRElementArb: fc.Arbitrary<{ tag: string; element: DicomElement }> = fc
  .tuple(
    standardTagArb,
    fc.constantFrom(
      // Invalid DA (Date) - not YYYYMMDD format
      { vr: 'DA', value: 'NOT-A-DATE' },
      { vr: 'DA', value: '2024-13-45' },
      { vr: 'DA', value: 'ABCDEFGH' },
      // Invalid TM (Time) - not valid time format
      { vr: 'TM', value: '99:99:99' },
      { vr: 'TM', value: 'BADTIME' },
      // Invalid UI (UID) - contains invalid characters
      { vr: 'UI', value: 'not.a" valid.uid!' },
      { vr: 'UI', value: '.1.2.3' },
      // Invalid PN (Person Name) - too many component groups
      { vr: 'PN', value: 'a=b=c=d' },
    ),
  )
  .map(([tag, { vr, value }]) => ({
    tag,
    element: { tag, vr, value } as DicomElement,
  }));

/**
 * Arbitrary for generating a DicomDataset with a known SOP Class UID
 * and 1-5 tags with invalid VR values.
 */
const datasetWithInvalidVRArb: fc.Arbitrary<DicomDataset> = fc
  .array(invalidVRElementArb, { minLength: 1, maxLength: 5 })
  .map((entries) => {
    const elements = new Map<string, DicomElement>();

    // Always include SOP Class UID for CT Image Storage
    elements.set('(0008,0016)', {
      tag: '(0008,0016)',
      vr: 'UI',
      value: CT_SOP_CLASS_UID,
    });

    // Add the generated invalid VR elements
    for (const { tag, element } of entries) {
      elements.set(tag, element);
    }

    return new DicomDataset(elements);
  });

// --- Property 13.1: Disabling VR checks produces zero VR findings ---

test.prop([datasetWithInvalidVRArb], { numRuns: 100 })(
  'Property 13.1: Disabling VR checks produces zero findings with VR-related rules',
  async (dataset) => {
    const result = await validateDataset(dataset, {
      checks: { vr: false, vm: true, iod: true },
      verbosity: 'verbose',
    });

    // No findings should have rules starting with 'vr-'
    const vrFindings = result.findings.filter((f) => f.rule.startsWith('vr-'));
    expect(vrFindings).toHaveLength(0);
  },
);

// --- Property 13.2: Disabling VM checks produces zero VM findings ---

test.prop([datasetWithInvalidVRArb], { numRuns: 100 })(
  'Property 13.2: Disabling VM checks produces zero findings with rule vm-constraint',
  async (dataset) => {
    const result = await validateDataset(dataset, {
      checks: { vr: true, vm: false, iod: true },
      verbosity: 'verbose',
    });

    // No findings should have rule 'vm-constraint'
    const vmFindings = result.findings.filter((f) => f.rule === 'vm-constraint');
    expect(vmFindings).toHaveLength(0);
  },
);

// --- Property 13.3: Disabling IOD checks produces zero IOD findings ---

test.prop([datasetWithInvalidVRArb], { numRuns: 100 })(
  'Property 13.3: Disabling IOD checks produces zero findings with IOD-related rules',
  async (dataset) => {
    const result = await validateDataset(dataset, {
      checks: { vr: true, vm: true, iod: false },
      verbosity: 'verbose',
    });

    // No findings should have IOD-related rules
    const iodFindings = result.findings.filter(
      (f) =>
        f.rule.startsWith('iod-') ||
        f.rule.startsWith('type1-') ||
        f.rule.startsWith('type2-') ||
        f.rule.startsWith('condition-'),
    );
    expect(iodFindings).toHaveLength(0);
  },
);
