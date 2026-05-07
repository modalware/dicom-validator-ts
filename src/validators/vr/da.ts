/**
 * DA (Date) VR Validator.
 * Validates YYYYMMDD format with correct month (01-12) and day ranges
 * including leap year rules.
 */

import { ValidationFinding } from '../../result/validation-result.js';

/**
 * Check if a year is a leap year.
 * A year is a leap year if divisible by 4, except centuries not divisible by 400.
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Get the maximum number of days in a given month/year.
 */
function maxDaysInMonth(month: number, year: number): number {
  switch (month) {
    case 1: case 3: case 5: case 7: case 8: case 10: case 12:
      return 31;
    case 4: case 6: case 9: case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

/**
 * Validate a DA (Date) value.
 * Format: YYYYMMDD where month is 01-12 and day is valid for the given month/year.
 *
 * @param value - The string value to validate
 * @param tagId - The tag identifier in "(GGGG,EEEE)" format
 * @returns Array of validation findings (empty if valid)
 */
export function validateDA(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];

  // Check format: exactly 8 digits
  if (!/^\d{8}$/.test(value)) {
    findings.push({
      severity: 'error',
      tag: tagId,
      module: '',
      message: `DA value must be exactly 8 digits in YYYYMMDD format (got "${value}")`,
      rule: 'vr-format-DA',
    });
    return findings;
  }

  const year = parseInt(value.substring(0, 4), 10);
  const month = parseInt(value.substring(4, 6), 10);
  const day = parseInt(value.substring(6, 8), 10);

  // Validate month: 01-12
  if (month < 1 || month > 12) {
    findings.push({
      severity: 'error',
      tag: tagId,
      module: '',
      message: `DA value has invalid month ${month.toString().padStart(2, '0')} (must be 01-12)`,
      rule: 'vr-format-DA',
    });
    return findings;
  }

  // Validate day: 01 to max days for the given month/year
  const maxDays = maxDaysInMonth(month, year);
  if (day < 1 || day > maxDays) {
    findings.push({
      severity: 'error',
      tag: tagId,
      module: '',
      message: `DA value has invalid day ${day.toString().padStart(2, '0')} for month ${month.toString().padStart(2, '0')} (max ${maxDays} days)`,
      rule: 'vr-format-DA',
    });
  }

  return findings;
}
