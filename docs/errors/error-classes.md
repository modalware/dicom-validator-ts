---
title: Error Classes Reference
description: Reference for exceptions thrown before or during validation (I/O errors, parse errors)
---

# Error Classes Reference

A complete reference of all error classes that may be thrown when validation cannot proceed. These are thrown when file I/O or parsing encounters a problem, indicating that validation itself could not be performed.

## DicomValidatorError (Base Class)

The base class for all error classes. Provides a machine-readable `code` property for programmatic error identification.

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable error message |
| `code` | `string` | Machine-readable error code |
| `name` | `string` | Class name (`'DicomValidatorError'`) |

### Catch-All Pattern

A pattern for handling all `DicomValidatorError` subclasses in a single catch block. Use the `code` field to determine the specific error type:

```typescript
import { validate, DicomValidatorError } from 'dicom-validator-ts';

try {
  const result = await validate('/path/to/file.dcm');
  console.log(result.toString());
} catch (error) {
  if (error instanceof DicomValidatorError) {
    switch (error.code) {
      case 'FILE_NOT_FOUND':
        console.error(`File not found: ${error.message}`);
        break;
      case 'FILE_NOT_READABLE':
        console.error(`File not readable: ${error.message}`);
        break;
      case 'INVALID_DICOM':
        console.error(`Not a valid DICOM file: ${error.message}`);
        break;
      case 'EMPTY_INPUT':
        console.error(`Input is empty: ${error.message}`);
        break;
      case 'TRUNCATED_FILE':
        console.error(`File is truncated: ${error.message}`);
        break;
      default:
        console.error(`Unexpected error [${error.code}]: ${error.message}`);
    }
  } else {
    throw error; // Re-throw non-DicomValidatorError errors
  }
}
```

## FileNotFoundError

Thrown when the specified file path does not exist.

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'FILE_NOT_FOUND'` | Error code |
| `filePath` | `string` | Path to the file that was not found |
| `name` | `string` | `'FileNotFoundError'` |
| `message` | `string` | `File not found: <filePath>` |

**Trigger condition:** A file path is passed to `validate()` but no file exists at that path.

**Example scenario:** A user calls `validate('/data/patient001.dcm')` but `/data/patient001.dcm` has been deleted or the path contains a typo.

```typescript
import { validate, FileNotFoundError } from 'dicom-validator-ts';

try {
  const result = await validate('/data/patient001.dcm');
} catch (error) {
  if (error instanceof FileNotFoundError) {
    console.error(`File not found: ${error.filePath}`);
    // Recovery: prompt the user to verify the file path
    console.error('Please check that the file path is correct.');
  }
}
```

## FileNotReadableError

Thrown when the file exists but the process lacks read permissions.

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'FILE_NOT_READABLE'` | Error code |
| `filePath` | `string` | Path to the unreadable file |
| `name` | `string` | `'FileNotReadableError'` |
| `message` | `string` | `File not readable: <filePath>` |

**Trigger condition:** A file path is passed to `validate()` but the process does not have read permission for that file.

**Example scenario:** A DICOM file is owned by root with permissions set to `600`, and a non-root process calls `validate('/restricted/scan.dcm')`.

```typescript
import { validate, FileNotReadableError } from 'dicom-validator-ts';

try {
  const result = await validate('/restricted/scan.dcm');
} catch (error) {
  if (error instanceof FileNotReadableError) {
    console.error(`Cannot read file: ${error.filePath}`);
    // Recovery: suggest checking file permissions
    console.error('Please verify the file has appropriate read permissions.');
  }
}
```

## InvalidDicomError

Thrown when the input data cannot be recognized as valid DICOM format.

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'INVALID_DICOM'` | Error code |
| `name` | `string` | `'InvalidDicomError'` |
| `message` | `string` | Detailed error message |

**Trigger condition:** The file or buffer content does not contain the DICOM magic number (`DICM` preamble) or has an unparseable structure.

**Example scenario:** A JPEG image file is mistakenly passed to `validate('/images/photo.jpg')`. The file exists and is readable, but it is not in DICOM format.

```typescript
import { validate, InvalidDicomError } from 'dicom-validator-ts';

try {
  const result = await validate('/images/photo.jpg');
} catch (error) {
  if (error instanceof InvalidDicomError) {
    console.error(`Not a valid DICOM file: ${error.message}`);
    // Recovery: prompt the user to verify the input file format
    console.error('Please ensure the input file is a valid DICOM file.');
  }
}
```

## EmptyInputError

Thrown when the input data is empty (0 bytes).

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'EMPTY_INPUT'` | Error code |
| `name` | `string` | `'EmptyInputError'` |
| `message` | `string` | `Input data is empty` |

**Trigger condition:** An empty file is passed to `validate()`, or an empty Buffer/ArrayBuffer is passed to `validateDataset()`.

**Example scenario:** A file transfer was interrupted, leaving a 0-byte file on disk. That file is then passed to `validate('/uploads/incomplete.dcm')`.

```typescript
import { validate, EmptyInputError } from 'dicom-validator-ts';

try {
  const result = await validate('/uploads/incomplete.dcm');
} catch (error) {
  if (error instanceof EmptyInputError) {
    console.error('Input data is empty.');
    // Recovery: suggest re-fetching the file
    console.error('Please verify the file was transferred completely.');
  }
}
```

## TruncatedFileError

Thrown when data ends unexpectedly during DICOM file parsing.

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'TRUNCATED_FILE'` | Error code |
| `byteOffset` | `number` | Byte offset where parsing failed |
| `tagAtFailure` | `string` | Tag being parsed when the data ended |
| `name` | `string` | `'TruncatedFileError'` |
| `message` | `string` | `File truncated at byte offset <offset> while parsing tag <tag>` |

**Trigger condition:** While parsing a DICOM file, the data stream ends before a tag's value can be fully read. This typically indicates an incomplete file copy or disk corruption.

**Example scenario:** A DICOM transfer over the network was interrupted, and the file was saved with its latter half missing. The parser reached byte offset 4096 while attempting to read the `(7FE0,0010)` PixelData tag, but the data ended.

```typescript
import { validate, TruncatedFileError } from 'dicom-validator-ts';

try {
  const result = await validate('/transfers/partial_scan.dcm');
} catch (error) {
  if (error instanceof TruncatedFileError) {
    console.error(
      `File is truncated (offset: ${error.byteOffset}, tag: ${error.tagAtFailure})`
    );
    // Recovery: suggest re-transferring the file
    console.error('Please verify the file was transferred completely and consider re-fetching it.');
  }
}
```

## Error Code Summary

| Error Code | Class | Description |
|------------|-------|-------------|
| `FILE_NOT_FOUND` | `FileNotFoundError` | File does not exist at the specified path |
| `FILE_NOT_READABLE` | `FileNotReadableError` | File exists but cannot be read (permission denied) |
| `INVALID_DICOM` | `InvalidDicomError` | Input is not recognized as valid DICOM format |
| `EMPTY_INPUT` | `EmptyInputError` | Input data is empty (0 bytes) |
| `TRUNCATED_FILE` | `TruncatedFileError` | File data ends unexpectedly during parsing |
