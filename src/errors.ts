/**
 * Error type hierarchy for dicom-validator-ts.
 *
 * All errors extend DicomValidatorError with a machine-readable `code` field.
 * These are used for I/O and parse errors that prevent validation from proceeding.
 */

export class DicomValidatorError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'DicomValidatorError';
  }
}

export class FileNotFoundError extends DicomValidatorError {
  constructor(public readonly filePath: string) {
    super(`File not found: ${filePath}`, 'FILE_NOT_FOUND');
    this.name = 'FileNotFoundError';
  }
}

export class FileNotReadableError extends DicomValidatorError {
  constructor(public readonly filePath: string) {
    super(`File not readable: ${filePath}`, 'FILE_NOT_READABLE');
    this.name = 'FileNotReadableError';
  }
}

export class InvalidDicomError extends DicomValidatorError {
  constructor(message: string) {
    super(message, 'INVALID_DICOM');
    this.name = 'InvalidDicomError';
  }
}

export class EmptyInputError extends DicomValidatorError {
  constructor() {
    super('Input data is empty', 'EMPTY_INPUT');
    this.name = 'EmptyInputError';
  }
}

export class TruncatedFileError extends DicomValidatorError {
  constructor(
    public readonly byteOffset: number,
    public readonly tagAtFailure: string
  ) {
    super(
      `File truncated at byte offset ${byteOffset} while parsing tag ${tagAtFailure}`,
      'TRUNCATED_FILE'
    );
    this.name = 'TruncatedFileError';
  }
}
