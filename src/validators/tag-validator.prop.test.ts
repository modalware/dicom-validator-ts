import { expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { TagValidator } from './tag-validator.js';
import { DicomDataset, DicomElement } from '../types/dataset.js';
import { TagDictionary } from '../dictionary/tag-dictionary.js';

/**
 * Arbitrary for generating a private tag string "(GGGG,EEEE)" where GGGG is an odd group number.
 * Private tags have odd group numbers (e.g., 0001, 0003, 0009, 00FF, etc.)
 */
const privateTagArb: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 0x7fff })
  .map((n) => {
    // Ensure odd group number: multiply by 2 and add 1
    const oddGroup = n * 2 + 1;
    const groupHex = oddGroup.toString(16).toUpperCase().padStart(4, '0');
    return groupHex;
  })
  .chain((groupHex) =>
    fc.integer({ min: 0, max: 0xffff }).map((element) => {
      const elementHex = element.toString(16).toUpperCase().padStart(4, '0');
      return `(${groupHex},${elementHex})`;
    }),
  );

/**
 * Feature: dicom-validator-ts
 * Property 11: Private Tag Handling
 *
 * For any tag with an odd group number (private tag) encountered during validation,
 * the Tag_Validator SHALL skip VR/VM validation (producing no VR/VM errors) and
 * SHALL add an informational finding identifying the skipped tag.
 *
 * **Validates: Requirements 12.3**
 */
test.prop([privateTagArb, fc.string({ minLength: 1, maxLength: 100 })], { numRuns: 100 })(
  'Property 11: Private tags skip VR/VM validation and produce informational finding',
  (privateTag, value) => {
    // Create a dataset with a single private tag containing a non-empty value
    const elements = new Map<string, DicomElement>();
    elements.set(privateTag, {
      tag: privateTag,
      vr: 'LO', // arbitrary VR - should not matter since validation is skipped
      value,
    });
    const dataset = new DicomDataset(elements);

    // Use an empty dictionary (no tag definitions)
    const dictionary = new TagDictionary([]);

    // Validate all tags
    const validator = new TagValidator();
    const findings = validator.validateAllTags(dataset, dictionary);

    // Exactly one finding is produced
    expect(findings).toHaveLength(1);

    // The finding has severity 'info'
    expect(findings[0].severity).toBe('info');

    // The finding has rule 'private-tag-skipped'
    expect(findings[0].rule).toBe('private-tag-skipped');

    // The finding's tag matches the generated private tag
    expect(findings[0].tag).toBe(privateTag);

    // No error or warning findings are produced (VR/VM validation was skipped)
    const errors = findings.filter((f) => f.severity === 'error');
    const warnings = findings.filter((f) => f.severity === 'warning');
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  },
);
