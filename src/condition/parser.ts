import type { ConditionNode } from './types.js';

/**
 * Parses DICOM condition description strings from the standard
 * into machine-evaluable ConditionNode AST nodes.
 *
 * Uses regex-based pattern matching for common DICOM condition patterns.
 * Falls back to an indeterminate node (non-existent tag) for unparseable conditions.
 */
export class ConditionParser {
  /** Tag pattern matching "(GGGG,EEEE)" format */
  private static readonly TAG_PATTERN = '\\(([0-9A-Fa-f]{4},[0-9A-Fa-f]{4})\\)';

  /** Name pattern matching any text before the tag */
  private static readonly NAME_PATTERN = '[\\w\\s\\/\\-\\.\']+?';

  /**
   * Pattern: "Required if <Name> (GGGG,EEEE) is present"
   * Result: { type: 'tag_present', tag: '(GGGG,EEEE)' }
   */
  private static readonly PRESENT_REGEX = new RegExp(
    `${ConditionParser.NAME_PATTERN}\\s*${ConditionParser.TAG_PATTERN}\\s+is\\s+present`,
    'i'
  );

  /**
   * Pattern: "Required if <Name> (GGGG,EEEE) is absent"
   * Result: { type: 'tag_absent', tag: '(GGGG,EEEE)' }
   */
  private static readonly ABSENT_REGEX = new RegExp(
    `${ConditionParser.NAME_PATTERN}\\s*${ConditionParser.TAG_PATTERN}\\s+is\\s+absent`,
    'i'
  );

  /**
   * Pattern: "Required if <Name> (GGGG,EEEE) is not <value>"
   * Result: { type: 'tag_not_equals', tag: '(GGGG,EEEE)', value: '<value>' }
   */
  private static readonly NOT_EQUALS_REGEX = new RegExp(
    `${ConditionParser.NAME_PATTERN}\\s*${ConditionParser.TAG_PATTERN}\\s+is\\s+not\\s+(.+?)\\s*\\.?$`,
    'i'
  );

  /**
   * Pattern: "Required if <Name> (GGGG,EEEE) has a value of <value>"
   * Result: { type: 'tag_equals', tag: '(GGGG,EEEE)', value: '<value>' }
   */
  private static readonly HAS_VALUE_REGEX = new RegExp(
    `${ConditionParser.NAME_PATTERN}\\s*${ConditionParser.TAG_PATTERN}\\s+has\\s+a\\s+value\\s+of\\s+(.+?)\\s*\\.?$`,
    'i'
  );

  /**
   * Pattern: "Required if <Name> (GGGG,EEEE) is <value>"
   * Result: { type: 'tag_equals', tag: '(GGGG,EEEE)', value: '<value>' }
   */
  private static readonly EQUALS_REGEX = new RegExp(
    `${ConditionParser.NAME_PATTERN}\\s*${ConditionParser.TAG_PATTERN}\\s+is\\s+(.+?)\\s*\\.?$`,
    'i'
  );

  /**
   * Parse a condition description string from the DICOM standard
   * into a machine-evaluable ConditionNode AST.
   *
   * Falls back to a non-existent tag node for unparseable conditions,
   * which will evaluate to indeterminate in practice.
   */
  parse(conditionText: string): ConditionNode {
    if (!conditionText || conditionText.trim().length === 0) {
      return this.indeterminateNode();
    }

    const text = conditionText.trim();

    // Try "is present" pattern
    const presentMatch = text.match(ConditionParser.PRESENT_REGEX);
    if (presentMatch) {
      return { type: 'tag_present', tag: `(${presentMatch[1]})` };
    }

    // Try "is absent" pattern
    const absentMatch = text.match(ConditionParser.ABSENT_REGEX);
    if (absentMatch) {
      return { type: 'tag_absent', tag: `(${absentMatch[1]})` };
    }

    // Try "has a value of <value>" pattern (before equals, since it's more specific)
    const hasValueMatch = text.match(ConditionParser.HAS_VALUE_REGEX);
    if (hasValueMatch) {
      return { type: 'tag_equals', tag: `(${hasValueMatch[1]})`, value: hasValueMatch[2].trim() };
    }

    // Try "is not <value>" pattern (before equals, since "is not" contains "is")
    const notEqualsMatch = text.match(ConditionParser.NOT_EQUALS_REGEX);
    if (notEqualsMatch) {
      return { type: 'tag_not_equals', tag: `(${notEqualsMatch[1]})`, value: notEqualsMatch[2].trim() };
    }

    // Try "is <value>" pattern (most general, must be last)
    const equalsMatch = text.match(ConditionParser.EQUALS_REGEX);
    if (equalsMatch) {
      return { type: 'tag_equals', tag: `(${equalsMatch[1]})`, value: equalsMatch[2].trim() };
    }

    // Fallback: return indeterminate node
    return this.indeterminateNode();
  }

  /**
   * Returns a node referencing a non-existent tag (FFFF,FFFF).
   * This will evaluate to 'false' or 'indeterminate' depending on context,
   * ensuring the validator never crashes on unknown conditions.
   */
  private indeterminateNode(): ConditionNode {
    return { type: 'tag_present', tag: '(FFFF,FFFF)' };
  }
}
