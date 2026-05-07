/**
 * Condition AST type definitions for DICOM conditional attribute evaluation.
 *
 * The condition expression format for Type 1C/2C attributes uses a JSON-based AST.
 * This approach provides:
 * - Deterministic evaluation (no parsing ambiguity)
 * - Serializable and cacheable structure
 * - Easy testing of individual nodes
 * - Clean mapping to DICOM standard condition patterns
 */

/** Tag exists in the dataset */
export interface TagPresent {
  type: 'tag_present';
  /** Tag in "(GGGG,EEEE)" format */
  tag: string;
}

/** Tag does not exist in the dataset */
export interface TagAbsent {
  type: 'tag_absent';
  /** Tag in "(GGGG,EEEE)" format */
  tag: string;
}

/** Tag value equals a specific value */
export interface TagEquals {
  type: 'tag_equals';
  /** Tag in "(GGGG,EEEE)" format */
  tag: string;
  value: string | number;
}

/** Tag value does not equal a specific value */
export interface TagNotEquals {
  type: 'tag_not_equals';
  /** Tag in "(GGGG,EEEE)" format */
  tag: string;
  value: string | number;
}

/** Tag value contains a substring (for multi-valued or string tags) */
export interface TagContains {
  type: 'tag_contains';
  /** Tag in "(GGGG,EEEE)" format */
  tag: string;
  value: string;
}

/** Tag value is greater than a threshold */
export interface TagGreaterThan {
  type: 'tag_greater_than';
  /** Tag in "(GGGG,EEEE)" format */
  tag: string;
  value: number;
}

/** Tag value is less than a threshold */
export interface TagLessThan {
  type: 'tag_less_than';
  /** Tag in "(GGGG,EEEE)" format */
  tag: string;
  value: number;
}

/** Logical AND of multiple conditions */
export interface AndCondition {
  type: 'and';
  conditions: ConditionNode[];
}

/** Logical OR of multiple conditions */
export interface OrCondition {
  type: 'or';
  conditions: ConditionNode[];
}

/** Logical NOT of a condition */
export interface NotCondition {
  type: 'not';
  condition: ConditionNode;
}

/** Union type for all condition expression nodes */
export type ConditionNode =
  | TagPresent
  | TagAbsent
  | TagEquals
  | TagNotEquals
  | TagContains
  | TagGreaterThan
  | TagLessThan
  | AndCondition
  | OrCondition
  | NotCondition;
