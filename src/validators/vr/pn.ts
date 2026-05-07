/**
 * PN (Person Name) VR validator.
 *
 * DICOM PN format:
 * - Component groups separated by "=" (up to 3: alphabetic, ideographic, phonetic)
 * - Components within each group separated by "^" (up to 5: family, given, middle, prefix, suffix)
 * - Each component group has a maximum of 64 characters
 */

import { ValidationFinding } from '../../result/validation-result.js';

/**
 * Validate a PN (Person Name) value.
 * @param value - The string value to validate
 * @param tagId - The tag identifier in "(GGGG,EEEE)" format
 * @returns Array of validation findings (empty if valid)
 */
export function validatePN(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];

  const groups = value.split('=');

  if (groups.length > 3) {
    findings.push({
      severity: 'error',
      tag: tagId,
      module: '',
      message: `PN value has too many component groups (got ${groups.length}, max 3)`,
      rule: 'vr-format-PN',
    });
  }

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    if (group.length > 64) {
      findings.push({
        severity: 'error',
        tag: tagId,
        module: '',
        message: `PN component group ${i + 1} exceeds maximum length of 64 characters (got ${group.length})`,
        rule: 'vr-format-PN',
      });
    }

    const components = group.split('^');
    if (components.length > 5) {
      findings.push({
        severity: 'error',
        tag: tagId,
        module: '',
        message: `PN component group ${i + 1} has too many components (got ${components.length}, max 5)`,
        rule: 'vr-format-PN',
      });
    }
  }

  return findings;
}
