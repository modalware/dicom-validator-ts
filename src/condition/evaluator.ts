/**
 * Condition AST evaluator for DICOM conditional attribute evaluation.
 *
 * Evaluates condition nodes against a DicomDataset, producing a three-valued
 * result: 'true', 'false', or 'indeterminate' (when a referenced tag is
 * missing and a value comparison is needed).
 */

import type { ConditionNode } from './types.js';
import type { IDicomDataset } from '../types/dataset.js';

/** Three-valued evaluation result */
export type ConditionResult = 'true' | 'false' | 'indeterminate';

/**
 * Evaluates condition AST nodes against a DICOM dataset.
 *
 * Evaluation rules:
 * - tag_present / tag_absent: deterministic based on tag existence
 * - Value comparisons (equals, not_equals, contains, greater_than, less_than):
 *   return 'indeterminate' if the referenced tag is missing
 * - Logical operators (and, or, not): compose results with three-valued logic
 */
export class ConditionEvaluator {
  /**
   * Evaluate a condition AST node against a dataset.
   */
  evaluate(condition: ConditionNode, dataset: IDicomDataset): ConditionResult {
    switch (condition.type) {
      case 'tag_present':
        return dataset.hasTag(condition.tag) ? 'true' : 'false';

      case 'tag_absent':
        return dataset.hasTag(condition.tag) ? 'false' : 'true';

      case 'tag_equals': {
        if (!dataset.hasTag(condition.tag)) {
          return 'indeterminate';
        }
        const value = dataset.getString(condition.tag);
        return value === String(condition.value) ? 'true' : 'false';
      }

      case 'tag_not_equals': {
        if (!dataset.hasTag(condition.tag)) {
          return 'indeterminate';
        }
        const value = dataset.getString(condition.tag);
        return value !== String(condition.value) ? 'true' : 'false';
      }

      case 'tag_contains': {
        if (!dataset.hasTag(condition.tag)) {
          return 'indeterminate';
        }
        const value = dataset.getString(condition.tag);
        if (value === undefined) {
          return 'false';
        }
        return value.includes(condition.value) ? 'true' : 'false';
      }

      case 'tag_greater_than': {
        if (!dataset.hasTag(condition.tag)) {
          return 'indeterminate';
        }
        const value = dataset.getString(condition.tag);
        if (value === undefined) {
          return 'false';
        }
        return parseFloat(value) > condition.value ? 'true' : 'false';
      }

      case 'tag_less_than': {
        if (!dataset.hasTag(condition.tag)) {
          return 'indeterminate';
        }
        const value = dataset.getString(condition.tag);
        if (value === undefined) {
          return 'false';
        }
        return parseFloat(value) < condition.value ? 'true' : 'false';
      }

      case 'and': {
        let hasIndeterminate = false;
        for (const child of condition.conditions) {
          const result = this.evaluate(child, dataset);
          if (result === 'false') {
            return 'false';
          }
          if (result === 'indeterminate') {
            hasIndeterminate = true;
          }
        }
        return hasIndeterminate ? 'indeterminate' : 'true';
      }

      case 'or': {
        let hasIndeterminate = false;
        for (const child of condition.conditions) {
          const result = this.evaluate(child, dataset);
          if (result === 'true') {
            return 'true';
          }
          if (result === 'indeterminate') {
            hasIndeterminate = true;
          }
        }
        return hasIndeterminate ? 'indeterminate' : 'false';
      }

      case 'not': {
        const result = this.evaluate(condition.condition, dataset);
        if (result === 'true') return 'false';
        if (result === 'false') return 'true';
        return 'indeterminate';
      }
    }
  }
}
