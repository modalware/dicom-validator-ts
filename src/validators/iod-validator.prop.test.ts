import { expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { IODValidator } from './iod-validator.js';
import { IODRegistry } from '../dictionary/iod-registry.js';
import type { IODDefinition } from '../dictionary/iod-registry.js';
import { ModuleRegistry } from '../dictionary/module-registry.js';
import type { ModuleDefinition } from '../dictionary/module-registry.js';
import { ConditionEvaluator } from '../condition/evaluator.js';
import { DicomDataset } from '../types/dataset.js';
import type { DicomElement } from '../types/dataset.js';

/**
 * Feature: dicom-validator-ts
 * Property 12: Conditional Module Evaluation
 *
 * For any IOD with a Conditional (C) module, if the module's condition evaluates
 * to true, the module SHALL be validated as if Mandatory (Type 1/2 checks applied);
 * if the condition evaluates to false, no findings SHALL be produced for that
 * module's attributes.
 *
 * **Validates: Requirements 5.7, 5.8**
 */

/** SOP Class UID tag */
const SOP_CLASS_UID_TAG = '(0008,0016)';

/**
 * Arbitrary for generating a valid SOP Class UID string.
 */
const sopClassUIDArb: fc.Arbitrary<string> = fc
  .array(fc.integer({ min: 0, max: 999 }), { minLength: 4, maxLength: 8 })
  .map((parts) => `1.2.${parts.join('.')}`);

/**
 * Arbitrary for generating a valid DICOM tag string "(GGGG,EEEE)" with even group number.
 * Avoids (0008,0016) to not conflict with SOP Class UID tag.
 */
const dicomTagArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 1, max: 0x7fff }).map((n) => n * 2), // even group number
    fc.integer({ min: 0, max: 0xffff }),
  )
  .filter(([group, element]) => !(group === 0x0008 && element === 0x0016)) // avoid SOP Class UID tag
  .map(([group, element]) => {
    const groupHex = group.toString(16).toUpperCase().padStart(4, '0');
    const elementHex = element.toString(16).toUpperCase().padStart(4, '0');
    return `(${groupHex},${elementHex})`;
  });

/**
 * Arbitrary for generating a pair of distinct DICOM tags:
 * - conditionTag: the tag referenced in the tag_present condition
 * - attributeTag: the Type 1 attribute tag in the conditional module
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
const validator = new IODValidator();
const conditionEvaluator = new ConditionEvaluator();

function makeDatasetFromElements(entries: Array<[string, DicomElement]>): DicomDataset {
  const map = new Map<string, DicomElement>(entries);
  return new DicomDataset(map);
}

// --- Property 12.1: Condition true → validate as Mandatory ---

test.prop(
  [distinctTagPairArb, sopClassUIDArb, nonEmptyValueArb, moduleNameArb, attrNameArb],
  { numRuns: 100 },
)(
  'Property 12.1: Conditional module with condition true validates as Mandatory (missing Type 1 → error)',
  ({ conditionTag, attributeTag }, sopClassUID, conditionValue, moduleName, attrName) => {
    // IOD with a Conditional module whose condition is tag_present on conditionTag
    const iodDef: IODDefinition = {
      sopClassUID,
      sopClassName: 'Test SOP Class',
      modules: [
        {
          moduleId: 'test-conditional-module',
          moduleName,
          usage: 'C',
          condition: { type: 'tag_present', tag: conditionTag },
        },
      ],
    };

    // Module has a Type 1 attribute
    const moduleDef: ModuleDefinition = {
      moduleId: 'test-conditional-module',
      moduleName,
      attributes: [
        { tag: attributeTag, name: attrName, type: '1' },
      ],
    };

    const iodRegistry = new IODRegistry([iodDef]);
    const moduleRegistry = new ModuleRegistry([moduleDef]);

    // Dataset has:
    // - SOP Class UID (so IOD can be looked up)
    // - The condition tag present (making condition true)
    // - The module's Type 1 attribute is MISSING
    const dataset = makeDatasetFromElements([
      [SOP_CLASS_UID_TAG, { tag: SOP_CLASS_UID_TAG, vr: 'UI', value: sopClassUID }],
      [conditionTag, { tag: conditionTag, vr: 'LO', value: conditionValue }],
    ]);

    const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

    // Condition is true → module validated as Mandatory → Type 1 missing → error
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBeGreaterThanOrEqual(1);

    // At least one error should reference the missing attribute tag
    const attrErrors = errors.filter((f) => f.tag === attributeTag);
    expect(attrErrors.length).toBe(1);
    expect(attrErrors[0].rule).toBe('type1-missing');
  },
);

// --- Property 12.2: Condition false → no findings for that module ---

test.prop(
  [distinctTagPairArb, sopClassUIDArb, moduleNameArb, attrNameArb],
  { numRuns: 100 },
)(
  'Property 12.2: Conditional module with condition false produces zero findings for that module',
  ({ conditionTag, attributeTag }, sopClassUID, moduleName, attrName) => {
    // IOD with a Conditional module whose condition is tag_present on conditionTag
    const iodDef: IODDefinition = {
      sopClassUID,
      sopClassName: 'Test SOP Class',
      modules: [
        {
          moduleId: 'test-conditional-module',
          moduleName,
          usage: 'C',
          condition: { type: 'tag_present', tag: conditionTag },
        },
      ],
    };

    // Module has a Type 1 attribute
    const moduleDef: ModuleDefinition = {
      moduleId: 'test-conditional-module',
      moduleName,
      attributes: [
        { tag: attributeTag, name: attrName, type: '1' },
      ],
    };

    const iodRegistry = new IODRegistry([iodDef]);
    const moduleRegistry = new ModuleRegistry([moduleDef]);

    // Dataset has:
    // - SOP Class UID (so IOD can be looked up)
    // - The condition tag is NOT present (making condition false)
    // - The module's Type 1 attribute is also missing
    const dataset = makeDatasetFromElements([
      [SOP_CLASS_UID_TAG, { tag: SOP_CLASS_UID_TAG, vr: 'UI', value: sopClassUID }],
    ]);

    const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

    // Condition is false → module skipped → zero findings
    expect(findings).toHaveLength(0);
  },
);
