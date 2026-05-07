/**
 * Integration tests for dicom-validator-ts.
 *
 * Tests the full validation pipeline end-to-end using:
 * - Real DICOM fixture files
 * - Programmatically created DICOM buffers (via dcmjs)
 * - CLI process spawning
 *
 * Validates: Requirements 11.4
 */

import { describe, it, expect } from 'vitest';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import dcmjs from 'dcmjs';
import { validate } from '../src/validator.js';
import { FileNotFoundError, EmptyInputError } from '../src/errors.js';

const execFileAsync = promisify(execFile);

const FIXTURES_DIR = join(__dirname, 'fixtures');
const VALID_CT_FILE = join(FIXTURES_DIR, 'minimal-ct.dcm');
const CLI_PATH = resolve(__dirname, '../dist/cli/index.mjs');

/**
 * Build a minimal valid DICOM ArrayBuffer using dcmjs.
 */
function buildValidDicomBuffer(): ArrayBuffer {
  const { DicomDict, DicomMetaDictionary } = dcmjs.data;

  const dataset: Record<string, unknown> = {
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.2', // CT Image Storage
    SOPInstanceUID: '1.2.3.4.5.6.7.8.9',
    StudyDate: '20240101',
    Modality: 'CT',
    PatientName: 'Test^Patient',
    PatientID: 'TEST001',
    StudyInstanceUID: '1.2.3.4.5.6.7.8',
    SeriesInstanceUID: '1.2.3.4.5.6.7.8.1',
  };

  const dicomDict = new DicomDict({
    TransferSyntaxUID: '1.2.840.10008.1.2.1', // Explicit VR Little Endian
  });

  dicomDict.dict = DicomMetaDictionary.denaturalizeDataset(dataset);
  return dicomDict.write();
}

/**
 * Build a DICOM buffer that is missing required Type 1 attributes
 * for CT Image Storage (e.g., missing PatientID, StudyInstanceUID).
 * This should produce validation error findings.
 */
function buildDicomBufferWithMissingAttributes(): ArrayBuffer {
  const { DicomDict, DicomMetaDictionary } = dcmjs.data;

  // Only include SOP Class UID and Modality — missing many required attributes
  const dataset: Record<string, unknown> = {
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.2', // CT Image Storage
    SOPInstanceUID: '1.2.3.4.5.6.7.8.9',
    Modality: 'CT',
  };

  const dicomDict = new DicomDict({
    TransferSyntaxUID: '1.2.840.10008.1.2.1',
  });

  dicomDict.dict = DicomMetaDictionary.denaturalizeDataset(dataset);
  return dicomDict.write();
}

describe('Integration: validate with fixture files', () => {
  it('should validate a valid DICOM file without parse errors', async () => {
    const result = await validate(VALID_CT_FILE);

    expect(result).toBeDefined();
    expect(result.findings).toBeDefined();
    expect(result.summary).toBeDefined();
    // The file should parse successfully — no parse-level errors
    // There may be validation findings (missing attributes etc.) but no crash
    expect(typeof result.passed).toBe('boolean');
  });

  it('should produce zero findings when all checks are disabled', async () => {
    const result = await validate(VALID_CT_FILE, {
      checks: { iod: false, vr: false, vm: false },
    });

    expect(result.findings).toHaveLength(0);
    expect(result.summary.errors).toBe(0);
    expect(result.summary.warnings).toBe(0);
    expect(result.summary.infos).toBe(0);
    expect(result.passed).toBe(true);
  });
});

describe('Integration: validate with programmatic DICOM buffers', () => {
  it('should produce error findings for DICOM with missing required attributes', async () => {
    const buffer = buildDicomBufferWithMissingAttributes();
    const result = await validate(Buffer.from(buffer));

    // CT Image Storage has many mandatory modules with Type 1/2 attributes.
    // With only SOPClassUID, SOPInstanceUID, and Modality present,
    // there should be errors for missing Type 1 attributes.
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.passed).toBe(false);

    // Verify findings have proper structure
    for (const finding of result.findings) {
      expect(finding.severity).toMatch(/^(error|warning|info)$/);
      expect(finding.message.length).toBeGreaterThan(0);
      expect(finding.message.length).toBeLessThanOrEqual(500);
      expect(finding.rule).toBeDefined();
    }
  });

  it('should validate a complete programmatic DICOM buffer', async () => {
    const buffer = buildValidDicomBuffer();
    const result = await validate(Buffer.from(buffer));

    // Should parse and validate without crashing
    expect(result).toBeDefined();
    expect(result.findings).toBeDefined();
    expect(result.summary).toBeDefined();
  });
});

describe('Integration: validate error handling', () => {
  it('should reject with FileNotFoundError for invalid file path', async () => {
    await expect(
      validate('/nonexistent/path/to/file.dcm')
    ).rejects.toThrow(FileNotFoundError);

    try {
      await validate('/nonexistent/path/to/file.dcm');
    } catch (err) {
      expect(err).toBeInstanceOf(FileNotFoundError);
      expect((err as FileNotFoundError).filePath).toBe('/nonexistent/path/to/file.dcm');
      expect((err as FileNotFoundError).code).toBe('FILE_NOT_FOUND');
    }
  });

  it('should reject with EmptyInputError for empty buffer', async () => {
    await expect(
      validate(Buffer.alloc(0))
    ).rejects.toThrow(EmptyInputError);

    try {
      await validate(Buffer.alloc(0));
    } catch (err) {
      expect(err).toBeInstanceOf(EmptyInputError);
      expect((err as EmptyInputError).code).toBe('EMPTY_INPUT');
    }
  });
});

describe('Integration: CLI end-to-end', () => {
  it('should exit with code 0 or 1 when given a valid DICOM file', async () => {
    try {
      const { stdout } = await execFileAsync('node', [CLI_PATH, VALID_CT_FILE]);
      // Exit code 0 means validation passed
      expect(stdout).toBeDefined();
    } catch (err: unknown) {
      // Exit code 1 means validation found errors (still a valid run)
      const error = err as { code?: number; stdout?: string; stderr?: string };
      expect(error.code).toBe(1);
      expect(error.stdout || error.stderr).toBeDefined();
    }
  });

  it('should produce valid JSON output with --format json', async () => {
    let stdout: string;

    try {
      const result = await execFileAsync('node', [CLI_PATH, '--format', 'json', VALID_CT_FILE]);
      stdout = result.stdout;
    } catch (err: unknown) {
      // Exit code 1 is acceptable (validation errors found)
      const error = err as { code?: number; stdout?: string };
      expect(error.code).toBe(1);
      stdout = error.stdout || '';
    }

    // Output should be valid JSON
    expect(stdout.length).toBeGreaterThan(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toBeDefined();

    // JSON output should have expected structure
    if (parsed.error) {
      // Error case: has file and error fields
      expect(parsed.file).toBeDefined();
    } else {
      // Success case: has findings and summary
      expect(parsed.findings).toBeDefined();
      expect(Array.isArray(parsed.findings)).toBe(true);
      expect(parsed.summary).toBeDefined();
      expect(typeof parsed.summary.errors).toBe('number');
      expect(typeof parsed.summary.warnings).toBe('number');
      expect(typeof parsed.summary.infos).toBe('number');
    }
  });
});
