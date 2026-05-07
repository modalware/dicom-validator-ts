/**
 * TM (Time) VR validator.
 * Validates DICOM Time values against the allowed truncated forms:
 * HH, HHMM, HHMMSS, or HHMMSS.FFFFFF
 *
 * Per DICOM PS3.5, trailing spaces are allowed and should be trimmed before validation.
 */

import { ValidationFinding } from '../../result/validation-result.js';

/**
 * Validate a TM (Time) value.
 * Valid formats (after trimming trailing spaces):
 * - HH (2 digits): hours 00-23
 * - HHMM (4 digits): hours 00-23, minutes 00-59
 * - HHMMSS (6 digits): hours 00-23, minutes 00-59, seconds 00-59
 * - HHMMSS.FFFFFF (6 digits + dot + 1-6 fractional digits): same ranges
 *
 * @param value - The string value to validate
 * @param tagId - The tag identifier in "(GGGG,EEEE)" format
 * @returns Array of validation findings (empty if valid)
 */
export function validateTM(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];
  const trimmed = value.replace(/\s+$/, '');

  // Match the overall structure: 2, 4, or 6 digits optionally followed by .1-6 digits
  const match = trimmed.match(/^(\d{2})(\d{2})?(\d{2})?(\.\d{1,6})?$/);
  if (!match) {
    findings.push({
      severity: 'error',
      tag: tagId,
      module: '',
      message: `TM value does not match any valid format (HH, HHMM, HHMMSS, or HHMMSS.FFFFFF) (got "${value}")`,
      rule: 'vr-format-TM',
    });
    return findings;
  }

  const [, hhStr, mmStr, ssStr, fracStr] = match;

  // Fractional part is only valid with full HHMMSS
  if (fracStr && (!mmStr || !ssStr)) {
    findings.push({
      severity: 'error',
      tag: tagId,
      module: '',
      message: `TM value has fractional seconds without full HHMMSS prefix (got "${value}")`,
      rule: 'vr-format-TM',
    });
    return findings;
  }

  // Validate HH range: 00-23
  const hh = parseInt(hhStr, 10);
  if (hh > 23) {
    findings.push({
      severity: 'error',
      tag: tagId,
      module: '',
      message: `TM value has invalid hour ${hhStr} (must be 00-23) (got "${value}")`,
      rule: 'vr-format-TM',
    });
    return findings;
  }

  // Validate MM range: 00-59
  if (mmStr) {
    const mm = parseInt(mmStr, 10);
    if (mm > 59) {
      findings.push({
        severity: 'error',
        tag: tagId,
        module: '',
        message: `TM value has invalid minute ${mmStr} (must be 00-59) (got "${value}")`,
        rule: 'vr-format-TM',
      });
      return findings;
    }
  }

  // Validate SS range: 00-59
  if (ssStr) {
    const ss = parseInt(ssStr, 10);
    if (ss > 59) {
      findings.push({
        severity: 'error',
        tag: tagId,
        module: '',
        message: `TM value has invalid second ${ssStr} (must be 00-59) (got "${value}")`,
        rule: 'vr-format-TM',
      });
      return findings;
    }
  }

  return findings;
}
