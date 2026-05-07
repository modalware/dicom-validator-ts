# dicom-validator-ts

A TypeScript library for validating DICOM files against the DICOM standard (PS3.3, PS3.6). Provides both a programmatic API and a CLI tool.

## Features

- Validates VR (Value Representation) format compliance
- Validates VM (Value Multiplicity) constraints
- Validates IOD (Information Object Definition) compliance
- Evaluates conditional attributes (Type 1C/2C)
- Supports file path, Buffer, and ArrayBuffer inputs
- CLI tool for scripting and CI/CD pipelines
- Dual ESM + CommonJS output
- Full TypeScript type definitions

## Installation

```bash
npm install dicom-validator-ts
```

## API Usage

### Validate a file

```typescript
import { validate } from 'dicom-validator-ts';

const result = await validate('/path/to/file.dcm');

if (result.passed) {
  console.log('Validation passed');
} else {
  console.log(`Found ${result.summary.errors} errors`);
  for (const finding of result.findings) {
    console.log(`[${finding.severity}] ${finding.tag}: ${finding.message}`);
  }
}
```

### Validate a Buffer

```typescript
import { validate } from 'dicom-validator-ts';
import { readFileSync } from 'node:fs';

const buffer = readFileSync('/path/to/file.dcm');
const result = await validate(buffer);
```

### Validate with options

```typescript
import { validate } from 'dicom-validator-ts';

const result = await validate('/path/to/file.dcm', {
  checks: {
    vr: true,   // Enable VR validation (default: true)
    vm: true,   // Enable VM validation (default: true)
    iod: true,  // Enable IOD validation (default: true)
  },
  sopClassUID: '1.2.840.10008.5.1.4.1.1.2', // Override SOP Class auto-detection
  verbosity: 'verbose', // 'errors-only' | 'normal' | 'verbose'
});
```

### Validate a pre-parsed Dataset

```typescript
import { validateDataset, DicomDataset } from 'dicom-validator-ts';

const dataset = new DicomDataset();
// ... populate dataset ...

const result = await validateDataset(dataset);
```

### Working with results

```typescript
const result = await validate('/path/to/file.dcm');

// Check pass/fail
console.log(result.passed); // true if zero errors

// Get summary counts
console.log(result.summary); // { errors: 0, warnings: 2, infos: 5 }

// Filter findings by severity
const errors = result.getFindings('error');
const warnings = result.getFindings('warning');

// Serialize to JSON
const json = result.toJSON();
```

## CLI Usage

```bash
npx dicom-validator <files...> [options]
```

### Examples

```bash
# Validate a single file
npx dicom-validator scan.dcm

# Validate multiple files
npx dicom-validator *.dcm

# Output as JSON
npx dicom-validator scan.dcm --format json

# Only show errors (suppress warnings and info)
npx dicom-validator scan.dcm --quiet

# Override SOP Class
npx dicom-validator scan.dcm --sop-class 1.2.840.10008.5.1.4.1.1.2
```

### Options

| Option | Description |
|--------|-------------|
| `--format <text\|json>` | Output format (default: text) |
| `--quiet` | Suppress all output except errors |
| `--sop-class <uid>` | Override SOP Class UID auto-detection |
| `--version` | Print version and exit |
| `--help` | Print usage information and exit |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All files passed validation |
| 1 | One or more files had validation errors |
| 2 | Usage error (no files specified) |

## API Reference

### Functions

- **`validate(input, options?)`** — Validate a DICOM file path, Buffer, or ArrayBuffer. Returns `Promise<ValidationResult>`.
- **`validateDataset(dataset, options?)`** — Validate a pre-parsed `DicomDataset`. Returns `Promise<ValidationResult>`.

### Classes

- **`ValidationResult`** — Contains validation findings with `passed`, `findings`, `summary`, `getFindings(severity)`, and `toJSON()`.
- **`DicomDataset`** — Represents a parsed DICOM dataset with `getElement(tag)`, `hasTag(tag)`, and `getString(tag)`.

### Types

- **`ValidateOptions`** — Configuration for validation (checks, sopClassUID, verbosity).
- **`ValidationFinding`** — A single finding with severity, tag, module, message, and rule.
- **`ValidationSummary`** — Counts of errors, warnings, and infos.
- **`Severity`** — `'error' | 'warning' | 'info'`
- **`DicomElement`** — A single DICOM element with tag, vr, value, and rawValue.
- **`DicomValue`** — Union type for DICOM values.

### Error Classes

- **`DicomValidatorError`** — Base error class with a `code` field.
- **`FileNotFoundError`** — File does not exist.
- **`FileNotReadableError`** — File cannot be read (permissions).
- **`InvalidDicomError`** — Input is not valid DICOM.
- **`EmptyInputError`** — Input data is empty.
- **`TruncatedFileError`** — File is truncated mid-parse.

## Requirements

- Node.js 18 or later

## License

[MIT](./LICENSE)
