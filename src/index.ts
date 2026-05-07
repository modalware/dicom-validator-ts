/**
 * dicom-validator-ts public API
 *
 * Exports all public functions, types, interfaces, and error classes
 * for programmatic DICOM validation.
 */

// Core validation functions
export { validate, validateDataset } from './validator.js';

// Validation result types
export {
  ValidationResult,
  type ValidationFinding,
  type ValidationSummary,
  type Severity,
} from './result/validation-result.js';

// Validation options
export { type ValidateOptions } from './types/options.js';

// Dataset types
export {
  DicomDataset,
  type IDicomDataset,
  type DicomElement,
  type DicomValue,
  type SequenceItem,
} from './types/dataset.js';

// Error classes
export {
  DicomValidatorError,
  FileNotFoundError,
  FileNotReadableError,
  InvalidDicomError,
  EmptyInputError,
  TruncatedFileError,
} from './errors.js';
