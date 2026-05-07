/**
 * UI (Unique Identifier) VR validator.
 * Validates DICOM UID values per PS3.5 Section 9.1.
 *
 * Rules:
 * - Contains only digits (0-9) and periods (.)
 * - Does not start with a period
 * - Does not end with a period
 * - Total length <= 64 characters
 * - No empty components (no consecutive periods "..")
 */

import { ValidationFinding } from '../../result/validation-result.js';

/**
 * Validate a UI (Unique Identifier) value.
 * Trailing null characters are trimmed before validation (DICOM padding).
 *
 * @param value - The string value to validate
 * @param tagId - The tag identifier in "(GGGG,EEEE)" format
 * @returns Array of validation findings (empty if valid)
 */
export function validateUI(value: string, tagId: string): ValidationFinding[] {
  // Trim trailing null characters (DICOM padding)
  const trimmed = value.replace(/\0+$/, '');

  // Skip validation for empty values (handled by IOD validator)
  if (trimmed.length === 0) {
    return [];
  }

  const findings: ValidationFinding[] = [];

  // Check total length <= 64 characters
  if (trimmed.length > 64) {
    findings.push({
      severity: 'error',
      tag: tagId,
      module: '',
      message: `UI value exceeds maximum length of 64 characters (got ${trimmed.length})`,
      rule: 'vr-format-UI',
    });
  }

  // Check contains only digits and periods
  if (!/^[0-9.]+$/.test(trimmed)) {
    findings.push({
      severity: 'error',
      tag: tagId,
      module: '',
      message: 'UI value must contain only digits (0-9) and periods (.)',
      rule: 'vr-format-UI',
    });
    return findings;
  }

  // Check does not start with a period
  if (trimmed.startsWith('.')) {
    findings.push({
      severity: 'error',
      tag: tagId,
      module: '',
      message: 'UI value must not start with a period',
      rule: 'vr-format-UI',
    });
  }

  // Check does not end with a period
  if (trimmed.endsWith('.')) {
    findings.push({
      severity: 'error',
      tag: tagId,
      module: '',
      message: 'UI value must not end with a period',
      rule: 'vr-format-UI',
    });
  }

  // Check no empty components (consecutive periods)
  if (trimmed.includes('..')) {
    findings.push({
      severity: 'error',
      tag: tagId,
      module: '',
      message: 'UI value must not contain empty components (consecutive periods)',
      rule: 'vr-format-UI',
    });
  }

  return findings;
}
