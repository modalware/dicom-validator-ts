import { describe, test, expect, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:util')>();
  return {
    ...actual,
    promisify: vi.fn((fn: unknown) => fn),
  };
});

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
}));

const { validateFile, isAvailable } = await import('./python-bridge.js');

const mockExecFile = vi.mocked(execFile) as unknown as ReturnType<typeof vi.fn>;
const mockAccess = vi.mocked(access) as unknown as ReturnType<typeof vi.fn>;

describe('python-bridge', () => {
  describe('isAvailable', () => {
    test('returns true when validate_iods exists and runs', async () => {
      mockAccess.mockResolvedValueOnce(undefined);
      mockExecFile.mockResolvedValueOnce({ stdout: 'usage: validate_iods', stderr: '' });

      const result = await isAvailable();
      expect(result).toBe(true);
    });

    test('returns false when validate_iods does not exist', async () => {
      mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('validateFile', () => {
    test('parses structured output with Errors section', async () => {
      mockAccess.mockResolvedValueOnce(undefined);
      mockExecFile.mockResolvedValueOnce({
        stdout: [
          'Using DICOM edition 2026b',
          'Validating DICOM file test.dcm',
          'SOP class is "1.2.840.10008.5.1.4.1.1.2" (CT Image IOD)',
          'Errors',
          '======',
          'Module "General Study":',
          'Tag (0008,0020) (Study Date) has invalid value \'2024-01-01\' for VR DA',
          'Tag (0008,0050) (Accession Number) is missing',
          '======',
        ].join('\n'),
        stderr: '',
      });

      const result = await validateFile('/path/to/test.dcm');

      expect(result.filePath).toBe('/path/to/test.dcm');
      expect(result.findings).toHaveLength(2);
      expect(result.findings[0]).toEqual({
        severity: 'Error',
        message: "[General Study] Tag (0008,0020) (Study Date) has invalid value '2024-01-01' for VR DA",
      });
      expect(result.findings[1]).toEqual({
        severity: 'Error',
        message: '[General Study] Tag (0008,0050) (Accession Number) is missing',
      });
      expect(result.error).toBeUndefined();
    });

    test('parses both Errors and Warnings sections', async () => {
      mockAccess.mockResolvedValueOnce(undefined);
      mockExecFile.mockResolvedValueOnce({
        stdout: [
          'Errors',
          '======',
          'Module "Patient":',
          'Tag (0010,0030) (Patient\'s Birth Date) is missing',
          'Warnings',
          '========',
          'Module "General":',
          'Tag (0009,0010) is unexpected',
          '======',
        ].join('\n'),
        stderr: '',
      });

      const result = await validateFile('/path/to/test.dcm');

      expect(result.findings).toHaveLength(2);
      expect(result.findings[0].severity).toBe('Error');
      expect(result.findings[1].severity).toBe('Warning');
    });

    test('returns error when validate_iods is not found', async () => {
      mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await validateFile('/path/to/test.dcm');

      expect(result.findings).toHaveLength(0);
      expect(result.error).toEqual({
        exitCode: -1,
        rawOutput: 'validate_iods not found in .venv/bin/',
      });
    });

    test('returns findings from non-zero exit when output is parseable', async () => {
      mockAccess.mockResolvedValueOnce(undefined);
      mockExecFile.mockRejectedValueOnce({
        code: 'ERR',
        killed: false,
        stdout: 'Errors\n======\nModule "CT Image":\nTag (0028,0010) (Rows) is missing\n======\n',
        stderr: '',
        status: 1,
      });

      const result = await validateFile('/path/to/test.dcm');

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toEqual({
        severity: 'Error',
        message: '[CT Image] Tag (0028,0010) (Rows) is missing',
      });
      expect(result.error).toBeUndefined();
    });

    test('returns error when subprocess fails with no parseable output', async () => {
      mockAccess.mockResolvedValueOnce(undefined);
      mockExecFile.mockRejectedValueOnce({
        code: 'ERR',
        killed: false,
        stdout: '',
        stderr: 'Traceback: some python error',
        status: 1,
      });

      const result = await validateFile('/path/to/test.dcm');

      expect(result.findings).toHaveLength(0);
      expect(result.error).toEqual({
        exitCode: 1,
        rawOutput: 'Traceback: some python error',
      });
    });

    test('returns timeout error when process is killed', async () => {
      mockAccess.mockResolvedValueOnce(undefined);
      mockExecFile.mockRejectedValueOnce({
        code: 'ETIMEDOUT',
        killed: true,
        stdout: '',
        stderr: '',
        status: null,
      });

      const result = await validateFile('/path/to/test.dcm');

      expect(result.findings).toHaveLength(0);
      expect(result.error).toEqual({
        exitCode: -1,
        rawOutput: 'Process timed out after 30 seconds',
      });
    });

    test('handles empty output from successful subprocess', async () => {
      mockAccess.mockResolvedValueOnce(undefined);
      mockExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await validateFile('/path/to/test.dcm');

      expect(result.filePath).toBe('/path/to/test.dcm');
      expect(result.findings).toHaveLength(0);
      expect(result.error).toBeUndefined();
    });
  });
});
