/**
 * VR (Value Representation) validator registry.
 * Maps VR codes to their validator functions that check format/length constraints
 * per the DICOM standard.
 */

import { ValidationFinding } from '../../result/validation-result.js';
import { validateTM } from './tm.js';
import { validatePN } from './pn.js';
import { validateUI } from './ui.js';
import { validateDA } from './da.js';

/**
 * A VR validator function that checks a tag value against VR format constraints.
 * @param value - The string value to validate
 * @param tagId - The tag identifier in "(GGGG,EEEE)" format
 * @returns Array of validation findings (empty if valid)
 */
export type VRValidatorFn = (value: string, tagId: string) => ValidationFinding[];

/** @deprecated Use VRValidatorFn instead */
export type VRValidator = VRValidatorFn;

/**
 * Helper to create an error finding for a VR format violation.
 */
function vrError(tagId: string, vr: string, message: string): ValidationFinding {
  return {
    severity: 'error',
    tag: tagId,
    module: '',
    message,
    rule: `vr-format-${vr}`,
  };
}

/**
 * AE - Application Entity
 * Max 16 chars, no backslash, no control characters except ESC.
 */
function validateAE(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];
  if (value.length > 16) {
    findings.push(vrError(tagId, 'AE', `AE value exceeds maximum length of 16 characters (got ${value.length})`));
  }
  if (value.includes('\\')) {
    findings.push(vrError(tagId, 'AE', 'AE value must not contain backslash characters'));
  }
  // Control characters (0x00-0x1F) except ESC (0x1B) are not allowed
  if (/[\x00-\x1a\x1c-\x1f]/.test(value)) {
    findings.push(vrError(tagId, 'AE', 'AE value contains invalid control characters'));
  }
  return findings;
}

/**
 * AS - Age String
 * Exactly 4 characters, format NNNx where x is D, W, M, or Y.
 */
function validateAS(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];
  if (value.length !== 4) {
    findings.push(vrError(tagId, 'AS', `AS value must be exactly 4 characters (got ${value.length})`));
    return findings;
  }
  if (!/^\d{3}[DWMY]$/.test(value)) {
    findings.push(vrError(tagId, 'AS', `AS value must match format NNNx where x is D, W, M, or Y (got "${value}")`));
  }
  return findings;
}

/**
 * CS - Code String
 * Max 16 chars, uppercase letters, digits, space, and underscore only.
 */
function validateCS(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];
  if (value.length > 16) {
    findings.push(vrError(tagId, 'CS', `CS value exceeds maximum length of 16 characters (got ${value.length})`));
  }
  if (!/^[A-Z0-9 _]*$/.test(value)) {
    findings.push(vrError(tagId, 'CS', 'CS value must contain only uppercase letters, digits, spaces, and underscores'));
  }
  return findings;
}

/**
 * DS - Decimal String
 * Max 16 chars, valid decimal string (optional sign, digits, optional decimal point, optional exponent).
 */
function validateDS(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];
  const trimmed = value.trim();
  if (trimmed.length > 16) {
    findings.push(vrError(tagId, 'DS', `DS value exceeds maximum length of 16 characters (got ${trimmed.length})`));
  }
  // DS format: optional leading/trailing spaces, optional sign, digits, optional decimal, optional exponent
  if (!/^[+-]?(\d+\.?\d*|\d*\.?\d+)([eE][+-]?\d+)?$/.test(trimmed)) {
    findings.push(vrError(tagId, 'DS', `DS value is not a valid decimal string (got "${value}")`));
  }
  return findings;
}

/**
 * IS - Integer String
 * Max 12 chars, valid integer string (optional sign, digits).
 */
function validateIS(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];
  const trimmed = value.trim();
  if (trimmed.length > 12) {
    findings.push(vrError(tagId, 'IS', `IS value exceeds maximum length of 12 characters (got ${trimmed.length})`));
  }
  if (!/^[+-]?\d+$/.test(trimmed)) {
    findings.push(vrError(tagId, 'IS', `IS value is not a valid integer string (got "${value}")`));
  }
  return findings;
}

/**
 * LO - Long String
 * Max 64 chars, no backslash or control characters.
 */
function validateLO(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];
  if (value.length > 64) {
    findings.push(vrError(tagId, 'LO', `LO value exceeds maximum length of 64 characters (got ${value.length})`));
  }
  if (value.includes('\\')) {
    findings.push(vrError(tagId, 'LO', 'LO value must not contain backslash characters'));
  }
  if (/[\x00-\x1f]/.test(value) && !/^[\x1b]$/.test(value.replace(/[^\x00-\x1f]/g, ''))) {
    // Check for control chars except ESC
    if (/[\x00-\x1a\x1c-\x1f]/.test(value)) {
      findings.push(vrError(tagId, 'LO', 'LO value contains invalid control characters'));
    }
  }
  return findings;
}

/**
 * LT - Long Text
 * Max 10240 chars.
 */
function validateLT(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];
  if (value.length > 10240) {
    findings.push(vrError(tagId, 'LT', `LT value exceeds maximum length of 10240 characters (got ${value.length})`));
  }
  return findings;
}

/**
 * SH - Short String
 * Max 16 chars, no backslash or control characters.
 */
function validateSH(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];
  if (value.length > 16) {
    findings.push(vrError(tagId, 'SH', `SH value exceeds maximum length of 16 characters (got ${value.length})`));
  }
  if (value.includes('\\')) {
    findings.push(vrError(tagId, 'SH', 'SH value must not contain backslash characters'));
  }
  // Control characters except ESC (0x1B) are not allowed
  if (/[\x00-\x1a\x1c-\x1f]/.test(value)) {
    findings.push(vrError(tagId, 'SH', 'SH value contains invalid control characters'));
  }
  return findings;
}

/**
 * ST - Short Text
 * Max 1024 chars.
 */
function validateST(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];
  if (value.length > 1024) {
    findings.push(vrError(tagId, 'ST', `ST value exceeds maximum length of 1024 characters (got ${value.length})`));
  }
  return findings;
}

/**
 * UC - Unlimited Characters
 * Unlimited length, no specific format constraints.
 */
function validateUC(_value: string, _tagId: string): ValidationFinding[] {
  return [];
}

/**
 * UR - Universal Resource Identifier
 * Max 2^32-2 chars, no trailing spaces.
 */
function validateUR(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];
  const maxLength = 4294967294; // 2^32 - 2
  if (value.length > maxLength) {
    findings.push(vrError(tagId, 'UR', `UR value exceeds maximum length of ${maxLength} characters`));
  }
  if (value !== value.trimEnd()) {
    findings.push(vrError(tagId, 'UR', 'UR value must not have trailing spaces'));
  }
  return findings;
}

/**
 * UT - Unlimited Text
 * Max 2^32-2 chars.
 */
function validateUT(value: string, tagId: string): ValidationFinding[] {
  if (value.length === 0) return [];
  const findings: ValidationFinding[] = [];
  const maxLength = 4294967294; // 2^32 - 2
  if (value.length > maxLength) {
    findings.push(vrError(tagId, 'UT', `UT value exceeds maximum length of ${maxLength} characters`));
  }
  return findings;
}

/**
 * OB - Other Byte
 * Binary data — no string validation.
 */
function validateOB(_value: string, _tagId: string): ValidationFinding[] {
  return [];
}

/**
 * OW - Other Word
 * Binary data — no string validation.
 */
function validateOW(_value: string, _tagId: string): ValidationFinding[] {
  return [];
}

/**
 * Registry mapping VR codes to their validator functions.
 */
export const vrValidatorRegistry: Map<string, VRValidatorFn> = new Map<string, VRValidatorFn>([
  ['AE', validateAE],
  ['AS', validateAS],
  ['CS', validateCS],
  ['DA', validateDA],
  ['DS', validateDS],
  ['IS', validateIS],
  ['LO', validateLO],
  ['LT', validateLT],
  ['SH', validateSH],
  ['ST', validateST],
  ['UC', validateUC],
  ['UR', validateUR],
  ['UT', validateUT],
  ['OB', validateOB],
  ['OW', validateOW],
  ['TM', validateTM],
  ['UI', validateUI],
  ['PN', validatePN],
]);

/**
 * Get the validator function for a given VR code.
 * @param vr - The VR code (e.g., "AE", "DS", "OB")
 * @returns The validator function, or undefined if no validator is registered for the VR
 */
export function getVRValidator(vr: string): VRValidatorFn | undefined {
  return vrValidatorRegistry.get(vr);
}
