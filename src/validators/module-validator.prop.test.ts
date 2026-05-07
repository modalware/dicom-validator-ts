import { expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { ModuleValidator } from './module-validator.js';
import { ConditionEvaluator } from '../condition/evaluator.js';
import { DicomDataset, DicomElement } from '../types/dataset.js';
import type { ModuleDefinition, ModuleAttribute } from '../dictionary/module-registry.js';

/**
 * Arbitrary for generating a DICOM tag in "(GGGG,EEEE)" format.
 */
const dicomTagArb = fc
  .tuple(
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
  )
  .map(([group, element]) => `(${group},${element})`);

/**
 * Arbitrary for generating a non-empty attribute name.
 */
const attrNameArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);

/**
 * Arbitrary for generating a module name.
 */
const moduleNameArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);

/**
 * Helper to create a ModuleDefinition with a single attribute.
 */
function makeModuleDef(
  moduleName: string,
  attr: ModuleAttribute,
): ModuleDefinition {
  return {
    moduleId: 'test-module',
    moduleName,
    attributes: [attr],
  };
}

/**
 * Feature: dicom-validator-ts
 * Property 4: Attribute Type Enforcement
 *
 * For any dataset and mandatory module definition:
 * - If a Type 1 attribute is absent, an error finding SHALL be produced
 * - If a Type 1 attribute is present with zero-length value, an error finding SHALL be produced
 * - If a Type 2 attribute is absent, a warning finding SHALL be produced
 * - If a Type 2 attribute is present with zero-length value, no error or warning SHALL be produced
 * - If a Type 3 attribute is absent, no error or warning SHALL be produced
 *
 * **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6**
 */

test.prop([dicomTagArb, attrNameArb, moduleNameArb], { numRuns: 100 })(
  'Property 4a: Type 1 missing attribute produces error with rule type1-missing',
  (tag, attrName, moduleName) => {
    const validator = new ModuleValidator();
    const conditionEvaluator = new ConditionEvaluator();

    // Empty dataset — attribute is missing
    const dataset = new DicomDataset(new Map());

    const attr: ModuleAttribute = { tag, name: attrName, type: '1' };
    const moduleDef = makeModuleDef(moduleName, attr);

    const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

    // Must produce exactly one error finding with rule 'type1-missing'
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(1);
    expect(errors[0].rule).toBe('type1-missing');
    expect(errors[0].tag).toBe(tag);
    expect(errors[0].module).toBe(moduleName);
  },
);

test.prop([dicomTagArb, attrNameArb, moduleNameArb], { numRuns: 100 })(
  'Property 4b: Type 1 empty attribute produces error with rule type1-empty',
  (tag, attrName, moduleName) => {
    const validator = new ModuleValidator();
    const conditionEvaluator = new ConditionEvaluator();

    // Dataset with tag present but empty value
    const elements = new Map<string, DicomElement>();
    elements.set(tag, { tag, vr: 'LO', value: '' });
    const dataset = new DicomDataset(elements);

    const attr: ModuleAttribute = { tag, name: attrName, type: '1' };
    const moduleDef = makeModuleDef(moduleName, attr);

    const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

    // Must produce exactly one error finding with rule 'type1-empty'
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(1);
    expect(errors[0].rule).toBe('type1-empty');
    expect(errors[0].tag).toBe(tag);
    expect(errors[0].module).toBe(moduleName);
  },
);

test.prop([dicomTagArb, attrNameArb, moduleNameArb], { numRuns: 100 })(
  'Property 4c: Type 2 missing attribute produces warning with rule type2-missing',
  (tag, attrName, moduleName) => {
    const validator = new ModuleValidator();
    const conditionEvaluator = new ConditionEvaluator();

    // Empty dataset — attribute is missing
    const dataset = new DicomDataset(new Map());

    const attr: ModuleAttribute = { tag, name: attrName, type: '2' };
    const moduleDef = makeModuleDef(moduleName, attr);

    const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

    // Must produce exactly one warning finding with rule 'type2-missing'
    const warnings = findings.filter((f) => f.severity === 'warning');
    expect(warnings.length).toBe(1);
    expect(warnings[0].rule).toBe('type2-missing');
    expect(warnings[0].tag).toBe(tag);
    expect(warnings[0].module).toBe(moduleName);

    // No errors should be produced
    const errors = findings.filter((f) => f.severity === 'error');
    expect(errors.length).toBe(0);
  },
);

test.prop([dicomTagArb, attrNameArb, moduleNameArb], { numRuns: 100 })(
  'Property 4d: Type 2 empty attribute produces zero error/warning findings',
  (tag, attrName, moduleName) => {
    const validator = new ModuleValidator();
    const conditionEvaluator = new ConditionEvaluator();

    // Dataset with tag present but empty value
    const elements = new Map<string, DicomElement>();
    elements.set(tag, { tag, vr: 'LO', value: '' });
    const dataset = new DicomDataset(elements);

    const attr: ModuleAttribute = { tag, name: attrName, type: '2' };
    const moduleDef = makeModuleDef(moduleName, attr);

    const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

    // No errors or warnings should be produced
    const errorsAndWarnings = findings.filter(
      (f) => f.severity === 'error' || f.severity === 'warning',
    );
    expect(errorsAndWarnings.length).toBe(0);
  },
);

test.prop([dicomTagArb, attrNameArb, moduleNameArb], { numRuns: 100 })(
  'Property 4e: Type 3 missing attribute produces zero findings',
  (tag, attrName, moduleName) => {
    const validator = new ModuleValidator();
    const conditionEvaluator = new ConditionEvaluator();

    // Empty dataset — attribute is missing
    const dataset = new DicomDataset(new Map());

    const attr: ModuleAttribute = { tag, name: attrName, type: '3' };
    const moduleDef = makeModuleDef(moduleName, attr);

    const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

    // No findings at all should be produced
    expect(findings.length).toBe(0);
  },
);
