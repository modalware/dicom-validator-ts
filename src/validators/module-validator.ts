/**
 * ModuleValidator validates a DICOM dataset against a module definition.
 *
 * Responsibilities:
 * - Check Type 1 attributes: missing → error, empty → error
 * - Check Type 2 attributes: missing → warning, empty → ok
 * - Check Type 3 attributes: missing → no finding
 * - Check Type 1C/2C: evaluate condition, apply appropriate checks
 * - Handle recursive sequence validation (presence-only for now)
 */

import type { ConditionEvaluator, ConditionResult } from '../condition/evaluator.js';
import type { ModuleDefinition, ModuleAttribute } from '../dictionary/module-registry.js';
import type { IDicomDataset, DicomElement, SequenceItem } from '../types/dataset.js';
import type { ValidationFinding } from '../result/validation-result.js';

export class ModuleValidator {
  /**
   * Validate a dataset against a single module definition.
   *
   * Iterates each attribute in the module and applies type-specific checks:
   * - Type 1: must be present and non-empty
   * - Type 2: must be present, may be empty
   * - Type 3: optional, no checks
   * - Type 1C: evaluate condition; if true, apply Type 1 rules
   * - Type 2C: evaluate condition; if true, apply Type 2 rules
   *
   * @param dataset - The DICOM dataset to validate
   * @param moduleDef - The module definition containing attribute requirements
   * @param conditionEvaluator - Evaluator for conditional attribute conditions
   * @returns Array of validation findings
   */
  validateModule(
    dataset: IDicomDataset,
    moduleDef: ModuleDefinition,
    conditionEvaluator: ConditionEvaluator
  ): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    for (const attr of moduleDef.attributes) {
      const attrFindings = this.validateAttribute(
        dataset,
        attr,
        moduleDef.moduleName,
        conditionEvaluator
      );
      findings.push(...attrFindings);
    }

    return findings;
  }

  /**
   * Validate a single attribute against its type rules.
   */
  private validateAttribute(
    dataset: IDicomDataset,
    attr: ModuleAttribute,
    moduleName: string,
    conditionEvaluator: ConditionEvaluator
  ): ValidationFinding[] {
    switch (attr.type) {
      case '1':
        return this.validateType1(dataset, attr, moduleName);
      case '2':
        return this.validateType2(dataset, attr, moduleName);
      case '3':
        return [];
      case '1C':
        return this.validateType1C(dataset, attr, moduleName, conditionEvaluator);
      case '2C':
        return this.validateType2C(dataset, attr, moduleName, conditionEvaluator);
    }
  }

  /**
   * Type 1: Required attribute. Must be present and non-empty.
   */
  private validateType1(
    dataset: IDicomDataset,
    attr: ModuleAttribute,
    moduleName: string
  ): ValidationFinding[] {
    if (!dataset.hasTag(attr.tag)) {
      return [
        {
          severity: 'error',
          tag: attr.tag,
          module: moduleName,
          message: `Missing required attribute "${attr.name}"`,
          rule: 'type1-missing',
        },
      ];
    }

    if (this.isValueEmpty(dataset.getElement(attr.tag)!)) {
      return [
        {
          severity: 'error',
          tag: attr.tag,
          module: moduleName,
          message: `Required attribute "${attr.name}" must not be empty`,
          rule: 'type1-empty',
        },
      ];
    }

    return [];
  }

  /**
   * Type 2: Required attribute, but empty value is allowed.
   */
  private validateType2(
    dataset: IDicomDataset,
    attr: ModuleAttribute,
    moduleName: string
  ): ValidationFinding[] {
    if (!dataset.hasTag(attr.tag)) {
      return [
        {
          severity: 'warning',
          tag: attr.tag,
          module: moduleName,
          message: `Missing required-but-empty-allowed attribute "${attr.name}"`,
          rule: 'type2-missing',
        },
      ];
    }

    // Type 2: present but empty is ok — no finding
    return [];
  }

  /**
   * Type 1C: Conditionally required. If condition is true, apply Type 1 rules.
   */
  private validateType1C(
    dataset: IDicomDataset,
    attr: ModuleAttribute,
    moduleName: string,
    conditionEvaluator: ConditionEvaluator
  ): ValidationFinding[] {
    if (!attr.condition) {
      // No condition defined — treat as indeterminate
      return [
        {
          severity: 'info',
          tag: attr.tag,
          module: moduleName,
          message: `Type 1C attribute "${attr.name}" has no evaluable condition`,
          rule: 'condition-indeterminate',
        },
      ];
    }

    const result: ConditionResult = conditionEvaluator.evaluate(attr.condition, dataset);

    switch (result) {
      case 'true':
        return this.validateType1(dataset, attr, moduleName);
      case 'false':
        return [];
      case 'indeterminate':
        return [
          {
            severity: 'info',
            tag: attr.tag,
            module: moduleName,
            message: `Condition for Type 1C attribute "${attr.name}" could not be fully evaluated`,
            rule: 'condition-indeterminate',
          },
        ];
    }
  }

  /**
   * Type 2C: Conditionally required, empty allowed. If condition is true, apply Type 2 rules.
   */
  private validateType2C(
    dataset: IDicomDataset,
    attr: ModuleAttribute,
    moduleName: string,
    conditionEvaluator: ConditionEvaluator
  ): ValidationFinding[] {
    if (!attr.condition) {
      // No condition defined — treat as indeterminate
      return [
        {
          severity: 'info',
          tag: attr.tag,
          module: moduleName,
          message: `Type 2C attribute "${attr.name}" has no evaluable condition`,
          rule: 'condition-indeterminate',
        },
      ];
    }

    const result: ConditionResult = conditionEvaluator.evaluate(attr.condition, dataset);

    switch (result) {
      case 'true':
        return this.validateType2(dataset, attr, moduleName);
      case 'false':
        return [];
      case 'indeterminate':
        return [
          {
            severity: 'info',
            tag: attr.tag,
            module: moduleName,
            message: `Condition for Type 2C attribute "${attr.name}" could not be fully evaluated`,
            rule: 'condition-indeterminate',
          },
        ];
    }
  }

  /**
   * Determine if an element's value is empty (zero-length).
   *
   * An element is considered empty if:
   * - value is null
   * - value is an empty string
   * - value is an empty array
   * - value is a zero-length Buffer
   */
  private isValueEmpty(element: DicomElement): boolean {
    const { value } = element;

    if (value === null) {
      return true;
    }

    if (typeof value === 'string') {
      return value.length === 0;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    if (Buffer.isBuffer(value)) {
      return value.length === 0;
    }

    // Numbers are never empty
    if (typeof value === 'number') {
      return false;
    }

    return false;
  }
}
