/**
 * TagValidator validates VR format and VM constraints for DICOM dataset elements.
 *
 * Responsibilities:
 * - Validate individual tag values against their expected VR format
 * - Validate value multiplicity against VM constraints
 * - Iterate all tags in a dataset and validate against the dictionary
 * - Skip validation for empty values (Type 2/3 responsibility)
 * - Skip validation for private tags with informational finding
 * - Handle retired tags with informational message
 * - Handle unknown VR with warning
 */

import { getVRValidator } from './vr/index.js';
import { parseVMConstraint, satisfiesVM } from '../types/vm-constraint.js';
import { TagDictionary } from '../dictionary/tag-dictionary.js';
import type { DicomDataset, DicomElement } from '../types/dataset.js';
import type { ValidationFinding } from '../result/validation-result.js';

export class TagValidator {
  /**
   * Validate a tag value against its expected VR format.
   *
   * @param tagId - Tag identifier in "(GGGG,EEEE)" format
   * @param value - The string value to validate
   * @param expectedVR - The expected VR code (e.g., "DA", "UI")
   * @returns Array of validation findings (empty if valid)
   */
  validateVR(tagId: string, value: string, expectedVR: string): ValidationFinding[] {
    const validator = getVRValidator(expectedVR);

    if (!validator) {
      return [
        {
          severity: 'warning',
          tag: tagId,
          module: '',
          message: `No validator registered for VR "${expectedVR}"`,
          rule: 'vr-unknown',
        },
      ];
    }

    return validator(value, tagId);
  }

  /**
   * Validate a tag value's multiplicity against a VM constraint.
   *
   * Values are separated by backslash "\". The count of values is checked
   * against the parsed VM constraint.
   *
   * @param tagId - Tag identifier in "(GGGG,EEEE)" format
   * @param value - The string value (backslash-delimited for multi-valued)
   * @param vmConstraint - VM constraint string (e.g., "1", "1-3", "1-n", "2-2n")
   * @returns Array of validation findings (empty if valid)
   */
  validateVM(tagId: string, value: string, vmConstraint: string): ValidationFinding[] {
    const valueCount = value.split('\\').length;
    const constraint = parseVMConstraint(vmConstraint);

    if (!satisfiesVM(valueCount, constraint)) {
      return [
        {
          severity: 'error',
          tag: tagId,
          module: '',
          message: `VM violation: expected ${vmConstraint} values but got ${valueCount}`,
          rule: 'vm-constraint',
        },
      ];
    }

    return [];
  }

  /**
   * Validate all tags in a dataset against the dictionary.
   *
   * For each element in the dataset:
   * - Private tags (odd group): skip VR/VM, add info finding
   * - Empty values: skip VR/VM validation
   * - Unknown tags (not in dictionary): skip
   * - Retired tags: add info finding, still validate
   * - Validate VR and VM using dictionary definition
   * - Unknown VR (no VR on element and not in dictionary): add warning
   *
   * @param dataset - The DICOM dataset to validate
   * @param dictionary - The tag dictionary to look up definitions
   * @returns Array of all validation findings
   */
  validateAllTags(dataset: DicomDataset, dictionary: TagDictionary): ValidationFinding[] {
    const findings: ValidationFinding[] = [];

    for (const [tagId, element] of dataset.elements) {
      // Skip private tags with informational finding
      if (dictionary.isPrivateTag(tagId)) {
        findings.push({
          severity: 'info',
          tag: tagId,
          module: '',
          message: `Private tag skipped: VR/VM validation not performed`,
          rule: 'private-tag-skipped',
        });
        continue;
      }

      // Get the string representation of the value for validation
      const valueStr = this.getValueString(element);

      // Skip VR/VM validation for empty values
      if (valueStr === null || valueStr.length === 0) {
        continue;
      }

      // Look up tag in dictionary
      const tagDef = dictionary.getTag(tagId);

      if (!tagDef) {
        // Unknown tag - skip validation
        continue;
      }

      // Retired tag: add info finding, still validate
      if (tagDef.retired) {
        findings.push({
          severity: 'info',
          tag: tagId,
          module: '',
          message: `Tag "${tagDef.name}" is retired`,
          rule: 'retired-tag',
        });
      }

      // Determine VR to validate against
      const vr = element.vr || tagDef.vr;

      if (!vr) {
        // Cannot determine VR - add warning
        findings.push({
          severity: 'warning',
          tag: tagId,
          module: '',
          message: `VR could not be determined for tag`,
          rule: 'vr-undetermined',
        });
        continue;
      }

      // Validate VR format
      const vrFindings = this.validateVR(tagId, valueStr, vr);
      findings.push(...vrFindings);

      // Validate VM constraint
      if (tagDef.vm) {
        const vmFindings = this.validateVM(tagId, valueStr, tagDef.vm);
        findings.push(...vmFindings);
      }
    }

    return findings;
  }

  /**
   * Extract a string representation of an element's value for validation.
   * Returns null if the value cannot be represented as a string.
   */
  private getValueString(element: DicomElement): string | null {
    const { value, rawValue } = element;

    // Prefer rawValue if available (original string for VR validation)
    if (rawValue !== undefined) {
      return rawValue;
    }

    if (value === null) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return null;
      }
      const first = value[0];
      if (typeof first === 'string') {
        return (value as string[]).join('\\');
      }
      if (typeof first === 'number') {
        return (value as number[]).map(String).join('\\');
      }
      // SequenceItem[] — no string representation
      return null;
    }

    // Buffer — no string representation
    if (Buffer.isBuffer(value)) {
      return null;
    }

    return null;
  }
}
