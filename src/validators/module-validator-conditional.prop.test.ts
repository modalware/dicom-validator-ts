import { expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { ModuleValidator } from './module-validator.js';
import { ConditionEvaluator } from '../condition/evaluator.js';
import { DicomDataset } from '../types/dataset.js';
import type { DicomElement } from '../types/dataset.js';
import type { ModuleDefinition, ModuleAttribute } from '../dictionary/module-registry.js';
import type { TagPresent } from '../condition/types.js';

/**
 * Feature: dicom-validator-ts
 * Property 5: Conditional Attribute Enforcement
 *
 * For any dataset, module, and Type 1C/2C attribute with an associated condition:
 * - If the condition evaluates to true and the attribute is missing: Type 1C produces an error, Type 2C produces a warning
 * - If the condition evaluates to true and the attribute is present but empty: Type 1C produces an error, Type 2C produces no error
 * - If the condition evaluates to false: no error or warning is produced regardless of attribute presence
 *
 * **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**
 */

/**
 * Arbitrary for generating a valid DICOM tag string "(GGGG,EEEE)" with even group number.
 */
const dicomTagArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 1, max: 0x7fff }).map((n) => n * 2), // even group number
    fc.integer({ min: 0, max: 0xffff }),
  )
  .map(([group, element]) => {
    const groupHex = group.toString(16).toUpperCase().padStart(4, '0');
    const elementHex = element.toString(16).toUpperCase().padStart(4, '0');
    return `(${groupHex},${elementHex})`;
  });

/**
 * Arbitrary for generating a pair of distinct DICOM tags:
 * - conditionTag: the tag referenced in the tag_present condition
 * - attributeTag: the 1C/2C attribute tag being validated
 */
const distinctTagPairArb: fc.Arbitrary<{ conditionTag: string; attributeTag: string }> = fc
  .tuple(dicomTagArb, dicomTagArb)
  .filter(([a, b]) => a !== b)
  .map(([conditionTag, attributeTag]) => ({ conditionTag, attributeTag }));

/**
 * Arbitrary for generating a non-empty string value for a DICOM element.
 */
const nonEmptyValueArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 64 });

/**
 * Arbitrary for generating a module name.
 */
const moduleNameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 50 });

/**
 * Arbitrary for generating an attribute name.
 */
const attrNameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 50 });

// Shared instances
const validator = new ModuleValidator();
const conditionEvaluator = new ConditionEvaluator();

function makeModuleDef(moduleName: string, attributes: ModuleAttribute[]): ModuleDefinition {
  return {
    moduleId: 'test-module',
    moduleName,
    attributes,
  };
}

function makeDatasetFromElements(entries: Array<[string, DicomElement]>): DicomDataset {
  const map = new Map<string, DicomElement>(entries);
  return new DicomDataset(map);
}

// --- Type 1C: condition true + missing → error ---

test.prop(
  [distinctTagPairArb, nonEmptyValueArb, moduleNameArb, attrNameArb],
  { numRuns: 100 },
)(
  'Property 5.1: Type 1C with condition true and attribute missing produces error',
  ({ conditionTag, attributeTag }, conditionValue, moduleName, attrName) => {
    // Condition: tag_present on conditionTag
    const condition: TagPresent = { type: 'tag_present', tag: conditionTag };

    const attr: ModuleAttribute = {
      tag: attributeTag,
      name: attrName,
      type: '1C',
      condition,
    };

    // Dataset has the condition tag present (making condition true),
    // but the 1C attribute is missing
    const dataset = makeDatasetFromElements([
      [conditionTag, { tag: conditionTag, vr: 'LO', value: conditionValue }],
    ]);

    const moduleDef = makeModuleDef(moduleName, [attr]);
    const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

    // Should produce exactly one error finding
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(1);
    expect(errors[0].tag).toBe(attributeTag);
    expect(errors[0].rule).toBe('type1-missing');
  },
);

// --- Type 1C: condition true + empty → error ---

test.prop(
  [distinctTagPairArb, nonEmptyValueArb, moduleNameArb, attrNameArb],
  { numRuns: 100 },
)(
  'Property 5.2: Type 1C with condition true and attribute present but empty produces error',
  ({ conditionTag, attributeTag }, conditionValue, moduleName, attrName) => {
    const condition: TagPresent = { type: 'tag_present', tag: conditionTag };

    const attr: ModuleAttribute = {
      tag: attributeTag,
      name: attrName,
      type: '1C',
      condition,
    };

    // Dataset has condition tag present (condition true) and 1C attribute present but empty
    const dataset = makeDatasetFromElements([
      [conditionTag, { tag: conditionTag, vr: 'LO', value: conditionValue }],
      [attributeTag, { tag: attributeTag, vr: 'LO', value: '' }],
    ]);

    const moduleDef = makeModuleDef(moduleName, [attr]);
    const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

    // Should produce exactly one error finding for empty value
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(1);
    expect(errors[0].tag).toBe(attributeTag);
    expect(errors[0].rule).toBe('type1-empty');
  },
);

// --- Type 2C: condition true + missing → warning ---

test.prop(
  [distinctTagPairArb, nonEmptyValueArb, moduleNameArb, attrNameArb],
  { numRuns: 100 },
)(
  'Property 5.3: Type 2C with condition true and attribute missing produces warning',
  ({ conditionTag, attributeTag }, conditionValue, moduleName, attrName) => {
    const condition: TagPresent = { type: 'tag_present', tag: conditionTag };

    const attr: ModuleAttribute = {
      tag: attributeTag,
      name: attrName,
      type: '2C',
      condition,
    };

    // Dataset has condition tag present (condition true), but 2C attribute is missing
    const dataset = makeDatasetFromElements([
      [conditionTag, { tag: conditionTag, vr: 'LO', value: conditionValue }],
    ]);

    const moduleDef = makeModuleDef(moduleName, [attr]);
    const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

    // Should produce exactly one warning finding
    const warnings = findings.filter((f) => f.severity === 'warning');
    expect(warnings.length).toBe(1);
    expect(warnings[0].tag).toBe(attributeTag);
    expect(warnings[0].rule).toBe('type2-missing');
  },
);

// --- Type 2C: condition true + empty → no error/warning ---

test.prop(
  [distinctTagPairArb, nonEmptyValueArb, moduleNameArb, attrNameArb],
  { numRuns: 100 },
)(
  'Property 5.4: Type 2C with condition true and attribute present but empty produces no error or warning',
  ({ conditionTag, attributeTag }, conditionValue, moduleName, attrName) => {
    const condition: TagPresent = { type: 'tag_present', tag: conditionTag };

    const attr: ModuleAttribute = {
      tag: attributeTag,
      name: attrName,
      type: '2C',
      condition,
    };

    // Dataset has condition tag present (condition true) and 2C attribute present but empty
    const dataset = makeDatasetFromElements([
      [conditionTag, { tag: conditionTag, vr: 'LO', value: conditionValue }],
      [attributeTag, { tag: attributeTag, vr: 'LO', value: '' }],
    ]);

    const moduleDef = makeModuleDef(moduleName, [attr]);
    const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

    // Should produce zero error or warning findings
    const errorsAndWarnings = findings.filter(
      (f) => f.severity === 'error' || f.severity === 'warning',
    );
    expect(errorsAndWarnings.length).toBe(0);
  },
);

// --- Type 1C: condition false → no findings ---

test.prop(
  [distinctTagPairArb, moduleNameArb, attrNameArb],
  { numRuns: 100 },
)(
  'Property 5.5: Type 1C with condition false produces no error or warning',
  ({ conditionTag, attributeTag }, moduleName, attrName) => {
    // Condition: tag_present on conditionTag
    const condition: TagPresent = { type: 'tag_present', tag: conditionTag };

    const attr: ModuleAttribute = {
      tag: attributeTag,
      name: attrName,
      type: '1C',
      condition,
    };

    // Dataset does NOT have the condition tag (making condition false),
    // and the 1C attribute is also missing
    const dataset = makeDatasetFromElements([]);

    const moduleDef = makeModuleDef(moduleName, [attr]);
    const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

    // Should produce zero error or warning findings
    const errorsAndWarnings = findings.filter(
      (f) => f.severity === 'error' || f.severity === 'warning',
    );
    expect(errorsAndWarnings.length).toBe(0);
  },
);

// --- Type 2C: condition false → no findings ---

test.prop(
  [distinctTagPairArb, moduleNameArb, attrNameArb],
  { numRuns: 100 },
)(
  'Property 5.6: Type 2C with condition false produces no error or warning',
  ({ conditionTag, attributeTag }, moduleName, attrName) => {
    // Condition: tag_present on conditionTag
    const condition: TagPresent = { type: 'tag_present', tag: conditionTag };

    const attr: ModuleAttribute = {
      tag: attributeTag,
      name: attrName,
      type: '2C',
      condition,
    };

    // Dataset does NOT have the condition tag (making condition false),
    // and the 2C attribute is also missing
    const dataset = makeDatasetFromElements([]);

    const moduleDef = makeModuleDef(moduleName, [attr]);
    const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

    // Should produce zero error or warning findings
    const errorsAndWarnings = findings.filter(
      (f) => f.severity === 'error' || f.severity === 'warning',
    );
    expect(errorsAndWarnings.length).toBe(0);
  },
);
