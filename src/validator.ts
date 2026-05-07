/**
 * Orchestrator module for DICOM validation.
 *
 * Provides the top-level validate() and validateDataset() functions that
 * wire together: Parser → Dictionary → IODValidator → TagValidator → ValidationResult.
 */

import { DicomParser } from './parser/dicom-parser.js';
import { DictionaryLoader } from './dictionary/loader.js';
import { IODValidator } from './validators/iod-validator.js';
import { TagValidator } from './validators/tag-validator.js';
import { ConditionEvaluator } from './condition/evaluator.js';
import { ValidationResult } from './result/validation-result.js';
import type { ValidateOptions } from './types/options.js';
import type { IDicomDataset } from './types/dataset.js';

/**
 * Validate a DICOM file or buffer.
 *
 * @param input - File path (string), Buffer, or ArrayBuffer containing DICOM data
 * @param options - Optional validation configuration
 * @returns Promise resolving to a ValidationResult
 * @throws Rejects with an error if input type is invalid
 */
export async function validate(
  input: string | Buffer | ArrayBuffer,
  options?: ValidateOptions
): Promise<ValidationResult> {
  const parser = new DicomParser();

  if (typeof input === 'string') {
    const { dataset } = await parser.parseFile(input);
    return validateDataset(dataset, options);
  }

  if (Buffer.isBuffer(input) || input instanceof ArrayBuffer) {
    const { dataset } = parser.parseBuffer(input);
    return validateDataset(dataset, options);
  }

  return Promise.reject(
    new Error('Expected file path, Buffer, or ArrayBuffer')
  );
}

/**
 * Validate a pre-parsed DICOM Dataset.
 *
 * @param dataset - A parsed DICOM dataset implementing IDicomDataset
 * @param options - Optional validation configuration
 * @returns Promise resolving to a ValidationResult
 */
export async function validateDataset(
  dataset: IDicomDataset,
  options?: ValidateOptions
): Promise<ValidationResult> {
  const result = new ValidationResult();
  const loader = DictionaryLoader.getInstance();

  // Apply default options
  const checks = {
    vr: options?.checks?.vr !== false,
    vm: options?.checks?.vm !== false,
    iod: options?.checks?.iod !== false,
  };
  const verbosity = options?.verbosity ?? 'normal';

  // If sopClassUID override is provided, set it on the dataset
  if (options?.sopClassUID) {
    const sopClassTag = '(0008,0016)';
    const element = dataset.elements.get(sopClassTag);
    if (element) {
      element.value = options.sopClassUID;
    } else {
      dataset.elements.set(sopClassTag, {
        tag: sopClassTag,
        vr: 'UI',
        value: options.sopClassUID,
      });
    }
  }

  // Run IOD validation if enabled
  if (checks.iod) {
    const iodValidator = new IODValidator();
    const conditionEvaluator = new ConditionEvaluator();
    const iodRegistry = loader.getIODRegistry();
    const moduleRegistry = loader.getModuleRegistry();

    const iodFindings = iodValidator.validate(
      dataset,
      iodRegistry,
      moduleRegistry,
      conditionEvaluator
    );

    for (const finding of iodFindings) {
      result.addFinding(finding);
    }
  }

  // Run Tag (VR/VM) validation if either VR or VM checks are enabled
  if (checks.vr || checks.vm) {
    const tagValidator = new TagValidator();
    const tagDictionary = loader.getTagDictionary();

    const tagFindings = tagValidator.validateAllTags(dataset, tagDictionary);

    for (const finding of tagFindings) {
      // Filter findings based on which checks are enabled
      if (!checks.vr && isVRFinding(finding.rule)) {
        continue;
      }
      if (!checks.vm && isVMFinding(finding.rule)) {
        continue;
      }
      result.addFinding(finding);
    }
  }

  // Apply verbosity filter
  return applyVerbosityFilter(result, verbosity);
}

/**
 * Check if a finding rule is a VR-related rule.
 */
function isVRFinding(rule: string): boolean {
  return rule.startsWith('vr-') || rule === 'retired-tag';
}

/**
 * Check if a finding rule is a VM-related rule.
 */
function isVMFinding(rule: string): boolean {
  return rule === 'vm-constraint';
}

/**
 * Apply verbosity filter to a ValidationResult.
 *
 * - 'errors-only': only include error findings
 * - 'normal': include error and warning findings
 * - 'verbose': include all findings (errors, warnings, info)
 */
function applyVerbosityFilter(
  result: ValidationResult,
  verbosity: 'errors-only' | 'normal' | 'verbose'
): ValidationResult {
  if (verbosity === 'verbose') {
    return result;
  }

  const filtered = new ValidationResult();

  for (const finding of result.findings) {
    if (verbosity === 'errors-only' && finding.severity !== 'error') {
      continue;
    }
    if (verbosity === 'normal' && finding.severity === 'info') {
      continue;
    }
    filtered.addFinding(finding);
  }

  return filtered;
}
