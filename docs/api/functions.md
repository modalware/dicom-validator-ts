---
title: Functions
description: Reference for the validation functions exported by dicom-validator-ts
---

# Functions

Reference for the two validation functions exported by dicom-validator-ts.

## validate

Validates a DICOM file or buffer. Accepts a file path, `Buffer`, or `ArrayBuffer` as input and performs parsing through validation in a single call.

### Signature

```typescript
function validate(
  input: string | Buffer | ArrayBuffer,
  options?: ValidateOptions
): Promise<ValidationResult>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string \| Buffer \| ArrayBuffer` | DICOM data input. A file path (string), Node.js Buffer, or ArrayBuffer |
| `options` | `ValidateOptions \| undefined` | Validation options (optional). Controls which checks to enable/disable, SOP Class UID override, and output verbosity |

### Return value

`Promise<ValidationResult>` — A Promise that resolves with a `ValidationResult` instance containing the validation results.

### Thrown errors

| Error class | Code | Trigger condition |
|-------------|------|-------------------|
| `FileNotFoundError` | `FILE_NOT_FOUND` | The specified file path does not exist |
| `FileNotReadableError` | `FILE_NOT_READABLE` | The file lacks read permissions |
| `InvalidDicomError` | `INVALID_DICOM` | The input data is not valid DICOM format |
| `EmptyInputError` | `EMPTY_INPUT` | The input data is empty |
| `TruncatedFileError` | `TRUNCATED_FILE` | The file is truncated |

If `input` is not a `string`, `Buffer`, or `ArrayBuffer`, the Promise rejects with `Error('Expected file path, Buffer, or ArrayBuffer')`.

### Examples

```typescript
import { validate } from 'dicom-validator-ts'

// Validate by file path
const result = await validate('./study/CT001.dcm')

if (result.passed) {
  console.log('Validation passed')
} else {
  console.log(`Error count: ${result.summary.errors}`)
  for (const finding of result.findings) {
    console.log(`[${finding.severity}] ${finding.rule}: ${finding.message}`)
  }
}
```

```typescript
import { validate } from 'dicom-validator-ts'
import { readFile } from 'node:fs/promises'

// Validate a Buffer with options
const buffer = await readFile('./study/MR001.dcm')
const result = await validate(buffer, {
  checks: { vr: true, vm: true, iod: false },
  verbosity: 'errors-only',
})

console.log(JSON.stringify(result.toJSON(), null, 2))
```

---

## validateDataset

Validates a pre-parsed DICOM dataset. Use this when you have a dataset parsed by your own parser or an external library like dcmjs.

### Signature

```typescript
function validateDataset(
  dataset: IDicomDataset,
  options?: ValidateOptions
): Promise<ValidationResult>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `dataset` | `IDicomDataset` | A pre-parsed DICOM dataset. An object with an `elements` map and `getElement`, `hasTag`, `getString` methods |
| `options` | `ValidateOptions \| undefined` | Validation options (optional). Controls which checks to enable/disable, SOP Class UID override, and output verbosity |

### Return value

`Promise<ValidationResult>` — A Promise that resolves with a `ValidationResult` instance containing the validation results.

### Thrown errors

Since `validateDataset` receives pre-parsed data, it does not throw I/O-related errors (such as `FileNotFoundError`). IOD validation and tag validation results are stored in the `ValidationResult`.

### Example

```typescript
import { validateDataset, DicomDataset } from 'dicom-validator-ts'
import type { DicomElement } from 'dicom-validator-ts'

// Build a DicomDataset manually and validate
const elements = new Map<string, DicomElement>()
elements.set('(0008,0016)', {
  tag: '(0008,0016)',
  vr: 'UI',
  value: '1.2.840.10008.5.1.4.1.1.2', // CT Image Storage
})
elements.set('(0010,0010)', {
  tag: '(0010,0010)',
  vr: 'PN',
  value: 'Yamada^Taro',
})

const dataset = new DicomDataset(elements)
const result = await validateDataset(dataset, {
  checks: { vr: true, vm: true, iod: true },
  verbosity: 'verbose',
})

console.log(`Result: ${result.passed ? 'passed' : 'failed'}`)
console.log(`Errors: ${result.summary.errors}, Warnings: ${result.summary.warnings}, Infos: ${result.summary.infos}`)

for (const finding of result.getFindings('error')) {
  console.log(`  ${finding.tag} [${finding.rule}] ${finding.message}`)
}
```
