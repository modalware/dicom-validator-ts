import { describe, it, expect } from 'vitest';
import { ConditionEvaluator, type ConditionResult } from './evaluator.js';
import { DicomDataset, type DicomElement } from '../types/dataset.js';
import type { ConditionNode } from './types.js';

/** Helper to create a dataset with given elements */
function makeDataset(entries: Array<{ tag: string; vr: string; value: string | number | null }>): DicomDataset {
  const elements = new Map<string, DicomElement>();
  for (const entry of entries) {
    elements.set(entry.tag, {
      tag: entry.tag,
      vr: entry.vr,
      value: entry.value,
    });
  }
  return new DicomDataset(elements);
}

describe('ConditionEvaluator', () => {
  const evaluator = new ConditionEvaluator();

  describe('tag_present', () => {
    it('returns true when tag exists in dataset', () => {
      const dataset = makeDataset([{ tag: '(0008,0060)', vr: 'CS', value: 'CT' }]);
      const condition: ConditionNode = { type: 'tag_present', tag: '(0008,0060)' };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });

    it('returns false when tag does not exist in dataset', () => {
      const dataset = makeDataset([]);
      const condition: ConditionNode = { type: 'tag_present', tag: '(0008,0060)' };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });
  });

  describe('tag_absent', () => {
    it('returns true when tag does not exist in dataset', () => {
      const dataset = makeDataset([]);
      const condition: ConditionNode = { type: 'tag_absent', tag: '(0008,0060)' };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });

    it('returns false when tag exists in dataset', () => {
      const dataset = makeDataset([{ tag: '(0008,0060)', vr: 'CS', value: 'CT' }]);
      const condition: ConditionNode = { type: 'tag_absent', tag: '(0008,0060)' };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });
  });

  describe('tag_equals', () => {
    it('returns true when tag value matches', () => {
      const dataset = makeDataset([{ tag: '(0008,0060)', vr: 'CS', value: 'CT' }]);
      const condition: ConditionNode = { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });

    it('returns false when tag value does not match', () => {
      const dataset = makeDataset([{ tag: '(0008,0060)', vr: 'CS', value: 'MR' }]);
      const condition: ConditionNode = { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });

    it('returns indeterminate when tag is missing', () => {
      const dataset = makeDataset([]);
      const condition: ConditionNode = { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' };
      expect(evaluator.evaluate(condition, dataset)).toBe('indeterminate');
    });

    it('compares numeric values as strings', () => {
      const dataset = makeDataset([{ tag: '(0028,0010)', vr: 'US', value: 512 }]);
      const condition: ConditionNode = { type: 'tag_equals', tag: '(0028,0010)', value: 512 };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });
  });

  describe('tag_not_equals', () => {
    it('returns true when tag value does not match', () => {
      const dataset = makeDataset([{ tag: '(0008,0060)', vr: 'CS', value: 'MR' }]);
      const condition: ConditionNode = { type: 'tag_not_equals', tag: '(0008,0060)', value: 'CT' };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });

    it('returns false when tag value matches', () => {
      const dataset = makeDataset([{ tag: '(0008,0060)', vr: 'CS', value: 'CT' }]);
      const condition: ConditionNode = { type: 'tag_not_equals', tag: '(0008,0060)', value: 'CT' };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });

    it('returns indeterminate when tag is missing', () => {
      const dataset = makeDataset([]);
      const condition: ConditionNode = { type: 'tag_not_equals', tag: '(0008,0060)', value: 'CT' };
      expect(evaluator.evaluate(condition, dataset)).toBe('indeterminate');
    });
  });

  describe('tag_contains', () => {
    it('returns true when tag value contains substring', () => {
      const dataset = makeDataset([{ tag: '(0008,0008)', vr: 'CS', value: 'ORIGINAL\\PRIMARY\\LOCALIZER' }]);
      const condition: ConditionNode = { type: 'tag_contains', tag: '(0008,0008)', value: 'LOCALIZER' };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });

    it('returns false when tag value does not contain substring', () => {
      const dataset = makeDataset([{ tag: '(0008,0008)', vr: 'CS', value: 'ORIGINAL\\PRIMARY' }]);
      const condition: ConditionNode = { type: 'tag_contains', tag: '(0008,0008)', value: 'LOCALIZER' };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });

    it('returns indeterminate when tag is missing', () => {
      const dataset = makeDataset([]);
      const condition: ConditionNode = { type: 'tag_contains', tag: '(0008,0008)', value: 'LOCALIZER' };
      expect(evaluator.evaluate(condition, dataset)).toBe('indeterminate');
    });

    it('returns false when tag value is null', () => {
      const dataset = makeDataset([{ tag: '(0008,0008)', vr: 'CS', value: null }]);
      const condition: ConditionNode = { type: 'tag_contains', tag: '(0008,0008)', value: 'LOCALIZER' };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });
  });

  describe('tag_greater_than', () => {
    it('returns true when tag value is greater than threshold', () => {
      const dataset = makeDataset([{ tag: '(0028,0010)', vr: 'IS', value: '512' }]);
      const condition: ConditionNode = { type: 'tag_greater_than', tag: '(0028,0010)', value: 256 };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });

    it('returns false when tag value is equal to threshold', () => {
      const dataset = makeDataset([{ tag: '(0028,0010)', vr: 'IS', value: '256' }]);
      const condition: ConditionNode = { type: 'tag_greater_than', tag: '(0028,0010)', value: 256 };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });

    it('returns false when tag value is less than threshold', () => {
      const dataset = makeDataset([{ tag: '(0028,0010)', vr: 'IS', value: '100' }]);
      const condition: ConditionNode = { type: 'tag_greater_than', tag: '(0028,0010)', value: 256 };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });

    it('returns indeterminate when tag is missing', () => {
      const dataset = makeDataset([]);
      const condition: ConditionNode = { type: 'tag_greater_than', tag: '(0028,0010)', value: 256 };
      expect(evaluator.evaluate(condition, dataset)).toBe('indeterminate');
    });

    it('returns false when tag value is null', () => {
      const dataset = makeDataset([{ tag: '(0028,0010)', vr: 'IS', value: null }]);
      const condition: ConditionNode = { type: 'tag_greater_than', tag: '(0028,0010)', value: 256 };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });
  });

  describe('tag_less_than', () => {
    it('returns true when tag value is less than threshold', () => {
      const dataset = makeDataset([{ tag: '(0028,0010)', vr: 'IS', value: '100' }]);
      const condition: ConditionNode = { type: 'tag_less_than', tag: '(0028,0010)', value: 256 };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });

    it('returns false when tag value is equal to threshold', () => {
      const dataset = makeDataset([{ tag: '(0028,0010)', vr: 'IS', value: '256' }]);
      const condition: ConditionNode = { type: 'tag_less_than', tag: '(0028,0010)', value: 256 };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });

    it('returns false when tag value is greater than threshold', () => {
      const dataset = makeDataset([{ tag: '(0028,0010)', vr: 'IS', value: '512' }]);
      const condition: ConditionNode = { type: 'tag_less_than', tag: '(0028,0010)', value: 256 };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });

    it('returns indeterminate when tag is missing', () => {
      const dataset = makeDataset([]);
      const condition: ConditionNode = { type: 'tag_less_than', tag: '(0028,0010)', value: 256 };
      expect(evaluator.evaluate(condition, dataset)).toBe('indeterminate');
    });
  });

  describe('and', () => {
    it('returns true when all conditions are true', () => {
      const dataset = makeDataset([
        { tag: '(0008,0060)', vr: 'CS', value: 'CT' },
        { tag: '(0028,0010)', vr: 'IS', value: '512' },
      ]);
      const condition: ConditionNode = {
        type: 'and',
        conditions: [
          { type: 'tag_present', tag: '(0008,0060)' },
          { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' },
        ],
      };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });

    it('returns false when any condition is false', () => {
      const dataset = makeDataset([
        { tag: '(0008,0060)', vr: 'CS', value: 'MR' },
      ]);
      const condition: ConditionNode = {
        type: 'and',
        conditions: [
          { type: 'tag_present', tag: '(0008,0060)' },
          { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' },
        ],
      };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });

    it('returns indeterminate when no condition is false but one is indeterminate', () => {
      const dataset = makeDataset([
        { tag: '(0008,0060)', vr: 'CS', value: 'CT' },
      ]);
      const condition: ConditionNode = {
        type: 'and',
        conditions: [
          { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' },
          { type: 'tag_equals', tag: '(0028,0010)', value: '512' }, // missing tag
        ],
      };
      expect(evaluator.evaluate(condition, dataset)).toBe('indeterminate');
    });

    it('returns false when one is false and another is indeterminate', () => {
      const dataset = makeDataset([
        { tag: '(0008,0060)', vr: 'CS', value: 'MR' },
      ]);
      const condition: ConditionNode = {
        type: 'and',
        conditions: [
          { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' }, // false
          { type: 'tag_equals', tag: '(0028,0010)', value: '512' }, // indeterminate
        ],
      };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });

    it('returns true for empty conditions list', () => {
      const dataset = makeDataset([]);
      const condition: ConditionNode = { type: 'and', conditions: [] };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });
  });

  describe('or', () => {
    it('returns true when any condition is true', () => {
      const dataset = makeDataset([
        { tag: '(0008,0060)', vr: 'CS', value: 'CT' },
      ]);
      const condition: ConditionNode = {
        type: 'or',
        conditions: [
          { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' },
          { type: 'tag_equals', tag: '(0008,0060)', value: 'MR' },
        ],
      };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });

    it('returns false when all conditions are false', () => {
      const dataset = makeDataset([
        { tag: '(0008,0060)', vr: 'CS', value: 'US' },
      ]);
      const condition: ConditionNode = {
        type: 'or',
        conditions: [
          { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' },
          { type: 'tag_equals', tag: '(0008,0060)', value: 'MR' },
        ],
      };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });

    it('returns indeterminate when none is true and one is indeterminate', () => {
      const dataset = makeDataset([
        { tag: '(0008,0060)', vr: 'CS', value: 'US' },
      ]);
      const condition: ConditionNode = {
        type: 'or',
        conditions: [
          { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' }, // false
          { type: 'tag_equals', tag: '(0028,0010)', value: '512' }, // indeterminate
        ],
      };
      expect(evaluator.evaluate(condition, dataset)).toBe('indeterminate');
    });

    it('returns true when one is true and another is indeterminate', () => {
      const dataset = makeDataset([
        { tag: '(0008,0060)', vr: 'CS', value: 'CT' },
      ]);
      const condition: ConditionNode = {
        type: 'or',
        conditions: [
          { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' }, // true
          { type: 'tag_equals', tag: '(0028,0010)', value: '512' }, // indeterminate
        ],
      };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });

    it('returns false for empty conditions list', () => {
      const dataset = makeDataset([]);
      const condition: ConditionNode = { type: 'or', conditions: [] };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });
  });

  describe('not', () => {
    it('inverts true to false', () => {
      const dataset = makeDataset([{ tag: '(0008,0060)', vr: 'CS', value: 'CT' }]);
      const condition: ConditionNode = {
        type: 'not',
        condition: { type: 'tag_present', tag: '(0008,0060)' },
      };
      expect(evaluator.evaluate(condition, dataset)).toBe('false');
    });

    it('inverts false to true', () => {
      const dataset = makeDataset([]);
      const condition: ConditionNode = {
        type: 'not',
        condition: { type: 'tag_present', tag: '(0008,0060)' },
      };
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });

    it('keeps indeterminate as indeterminate', () => {
      const dataset = makeDataset([]);
      const condition: ConditionNode = {
        type: 'not',
        condition: { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' },
      };
      expect(evaluator.evaluate(condition, dataset)).toBe('indeterminate');
    });
  });

  describe('nested conditions', () => {
    it('evaluates complex nested conditions', () => {
      const dataset = makeDataset([
        { tag: '(0008,0060)', vr: 'CS', value: 'CT' },
        { tag: '(0008,0008)', vr: 'CS', value: 'ORIGINAL\\PRIMARY' },
      ]);

      // (Modality == CT) AND (ImageType contains PRIMARY OR PixelData present)
      const condition: ConditionNode = {
        type: 'and',
        conditions: [
          { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' },
          {
            type: 'or',
            conditions: [
              { type: 'tag_contains', tag: '(0008,0008)', value: 'PRIMARY' },
              { type: 'tag_present', tag: '(7FE0,0010)' },
            ],
          },
        ],
      };

      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });

    it('evaluates NOT(AND(...)) correctly', () => {
      const dataset = makeDataset([
        { tag: '(0008,0060)', vr: 'CS', value: 'MR' },
      ]);

      const condition: ConditionNode = {
        type: 'not',
        condition: {
          type: 'and',
          conditions: [
            { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' },
            { type: 'tag_present', tag: '(0008,0060)' },
          ],
        },
      };

      // AND is false (first child is false), NOT(false) = true
      expect(evaluator.evaluate(condition, dataset)).toBe('true');
    });
  });
});
