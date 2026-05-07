import { expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { ConditionEvaluator } from './evaluator.js';
import { ConditionNode } from './types.js';
import { DicomDataset, DicomElement } from '../types/dataset.js';

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
 * Arbitrary for generating a comparison value (string or number).
 */
const comparisonValueArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.integer({ min: -1000, max: 1000 }),
);

/**
 * Arbitrary for generating leaf ConditionNode (no children).
 */
const leafConditionNodeArb: fc.Arbitrary<ConditionNode> = fc.oneof(
  dicomTagArb.map((tag): ConditionNode => ({ type: 'tag_present', tag })),
  dicomTagArb.map((tag): ConditionNode => ({ type: 'tag_absent', tag })),
  fc.tuple(dicomTagArb, comparisonValueArb).map(
    ([tag, value]): ConditionNode => ({ type: 'tag_equals', tag, value }),
  ),
  fc.tuple(dicomTagArb, comparisonValueArb).map(
    ([tag, value]): ConditionNode => ({ type: 'tag_not_equals', tag, value }),
  ),
  fc.tuple(dicomTagArb, fc.string({ minLength: 1, maxLength: 10 })).map(
    ([tag, value]): ConditionNode => ({ type: 'tag_contains', tag, value }),
  ),
  fc.tuple(dicomTagArb, fc.integer({ min: -1000, max: 1000 })).map(
    ([tag, value]): ConditionNode => ({ type: 'tag_greater_than', tag, value }),
  ),
  fc.tuple(dicomTagArb, fc.integer({ min: -1000, max: 1000 })).map(
    ([tag, value]): ConditionNode => ({ type: 'tag_less_than', tag, value }),
  ),
);

/**
 * Arbitrary for generating a ConditionNode AST with compositions (and/or/not)
 * using leaf nodes as children (depth 2).
 */
const conditionNodeArb: fc.Arbitrary<ConditionNode> = fc.oneof(
  leafConditionNodeArb,
  fc
    .array(leafConditionNodeArb, { minLength: 1, maxLength: 3 })
    .map((conditions): ConditionNode => ({ type: 'and', conditions })),
  fc
    .array(leafConditionNodeArb, { minLength: 1, maxLength: 3 })
    .map((conditions): ConditionNode => ({ type: 'or', conditions })),
  leafConditionNodeArb.map(
    (condition): ConditionNode => ({ type: 'not', condition }),
  ),
);

/**
 * Arbitrary for generating a DicomElement with a string value.
 */
const dicomElementArb: fc.Arbitrary<DicomElement> = fc
  .tuple(dicomTagArb, fc.string({ minLength: 0, maxLength: 30 }))
  .map(([tag, value]) => ({
    tag,
    vr: 'LO',
    value,
  }));

/**
 * Arbitrary for generating a DicomDataset with random elements.
 */
const dicomDatasetArb: fc.Arbitrary<DicomDataset> = fc
  .array(dicomElementArb, { minLength: 0, maxLength: 10 })
  .map((elements) => {
    const map = new Map<string, DicomElement>();
    for (const el of elements) {
      map.set(el.tag, el);
    }
    return new DicomDataset(map);
  });

/**
 * The set of valid ConditionResult values.
 */
const VALID_RESULTS: ReadonlySet<string> = new Set(['true', 'false', 'indeterminate']);

/**
 * Feature: dicom-validator-ts
 * Property 6: Condition Evaluation Determinism
 *
 * For any condition AST node and dataset, the Condition_Evaluator SHALL produce
 * a deterministic result (true, false, or indeterminate). If the condition
 * references a tag's value and that tag is absent from the dataset, the result
 * SHALL be indeterminate.
 *
 * **Validates: Requirements 6.1, 6.8**
 */
test.prop([conditionNodeArb, dicomDatasetArb], { numRuns: 100 })(
  'Property 6: evaluate() always returns one of true, false, or indeterminate (deterministic)',
  (condition, dataset) => {
    const evaluator = new ConditionEvaluator();

    const result1 = evaluator.evaluate(condition, dataset);
    const result2 = evaluator.evaluate(condition, dataset);

    // Result must be one of the three valid values
    expect(VALID_RESULTS.has(result1)).toBe(true);

    // Determinism: same input always produces same output
    expect(result1).toBe(result2);
  },
);

/**
 * Arbitrary for generating a value-comparison ConditionNode.
 */
const valueComparisonNodeArb: fc.Arbitrary<ConditionNode> = fc.oneof(
  fc.tuple(dicomTagArb, comparisonValueArb).map(
    ([tag, value]): ConditionNode => ({ type: 'tag_equals', tag, value }),
  ),
  fc.tuple(dicomTagArb, comparisonValueArb).map(
    ([tag, value]): ConditionNode => ({ type: 'tag_not_equals', tag, value }),
  ),
  fc.tuple(dicomTagArb, fc.string({ minLength: 1, maxLength: 10 })).map(
    ([tag, value]): ConditionNode => ({ type: 'tag_contains', tag, value }),
  ),
  fc.tuple(dicomTagArb, fc.integer({ min: -1000, max: 1000 })).map(
    ([tag, value]): ConditionNode => ({ type: 'tag_greater_than', tag, value }),
  ),
  fc.tuple(dicomTagArb, fc.integer({ min: -1000, max: 1000 })).map(
    ([tag, value]): ConditionNode => ({ type: 'tag_less_than', tag, value }),
  ),
);

test.prop([valueComparisonNodeArb], { numRuns: 100 })(
  'Property 6: value-comparison nodes with missing tag yield indeterminate',
  (condition) => {
    const evaluator = new ConditionEvaluator();

    // Create an empty dataset — the referenced tag is guaranteed to be missing
    const emptyDataset = new DicomDataset(new Map());

    const result = evaluator.evaluate(condition, emptyDataset);

    // When the referenced tag is missing, value-comparison must be indeterminate
    expect(result).toBe('indeterminate');
  },
);
