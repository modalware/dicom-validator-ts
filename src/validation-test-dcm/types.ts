/**
 * Type definitions for the validation test DCM file generation and comparison system.
 */

import type { ValidationFinding } from '../result/validation-result.js';

/**
 * Specification for a single test DCM file.
 * Describes what validation rule the file is designed to trigger.
 */
export interface TestFileSpec {
  /** Output path relative to tests/fixtures/dcm/ */
  relativePath: string;
  /** The validation rule this file is designed to trigger */
  targetRule: string;
  /** Expected severity of the triggered finding */
  expectedSeverity: 'error' | 'warning' | 'info';
  /** Human-readable description of the test scenario */
  description: string;
  /** The tag that should appear in the finding (if applicable) */
  expectedTag?: string;
}

/**
 * Result of validating a test DCM file with dicom-validator-ts.
 */
export interface TSValidationResult {
  filePath: string;
  targetRule: string;
  findings: ValidationFinding[];
  error?: { name: string; code?: string; message: string };
}

/**
 * Result of validating a test DCM file with pydicom/dicom-validator.
 */
export interface PyValidationResult {
  filePath: string;
  findings: { severity: string; message: string }[];
  error?: { exitCode: number; rawOutput: string };
}

/**
 * Comparison result for a single test DCM file between both validators.
 */
export interface ComparisonResult {
  filePath: string;
  targetRule: string;
  category: 'agree' | 'ts-only' | 'python-only';
  tsFindings: ValidationFinding[];
  pyFindings: { severity: string; message: string }[];
}

/**
 * Aggregated comparison report across all test DCM files.
 */
export interface ComparisonReport {
  totalFiles: number;
  agree: number;
  tsOnly: number;
  pythonOnly: number;
  results: ComparisonResult[];
}

/**
 * Manifest describing all generated test DCM files.
 * Written to tests/fixtures/dcm/manifest.json.
 */
export interface TestFileManifest {
  generatedAt: string; // ISO 8601 timestamp
  generatorVersion: string;
  files: TestFileSpec[];
}
