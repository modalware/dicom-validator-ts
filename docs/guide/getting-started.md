---
title: Getting Started
description: Installation and basic usage of dicom-validator-ts
---

# Getting Started

Learn how to install dicom-validator-ts and start validating DICOM files.

## Installation

Install via npm:

```bash
npm install dicom-validator-ts
```

## Imports

Import using ES Modules:

```typescript
import { validate, validateDataset } from 'dicom-validator-ts'
```

You can also import types as needed:

```typescript
import {
  validate,
  validateDataset,
  ValidationResult,
  DicomDataset,
  type ValidateOptions,
  type ValidationFinding,
} from 'dicom-validator-ts'
```

## Validating from a file path — `validate()`

The `validate()` function accepts a file path, `Buffer`, or `ArrayBuffer`, parses the DICOM data, and runs validation.

```typescript
import { validate } from 'dicom-validator-ts'

const result = await validate('./path/to/dicom-file.dcm')

// Check validation result
if (result.passed) {
  console.log('Validation passed: no errors found')
} else {
  console.log('Validation errors found:')
  for (const finding of result.findings) {
    console.log(`  [${finding.severity}] ${finding.rule}: ${finding.message}`)
  }
}

// Check summary
const summary = result.summary
console.log(`Errors: ${summary.errors}, Warnings: ${summary.warnings}, Infos: ${summary.infos}`)
```

### Validation with options

Pass a `ValidateOptions` object to customize validation behavior.

```typescript
import { validate, type ValidateOptions } from 'dicom-validator-ts'

const options: ValidateOptions = {
  checks: {
    vr: true,   // VR format validation (default: true)
    vm: true,   // VM constraint validation (default: true)
    iod: false, // Disable IOD structure validation
  },
  verbosity: 'errors-only', // Show errors only
}

const result = await validate('./study/image001.dcm', options)
```

## Validating a pre-parsed dataset — `validateDataset()`

If you already have a parsed DICOM dataset, use `validateDataset()` to skip file I/O and validate directly.

```typescript
import { validateDataset, DicomDataset } from 'dicom-validator-ts'

// Build a pre-parsed dataset
const elements = new Map()
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

// Run validation
const result = await validateDataset(dataset)

// Get errors only
const errors = result.getFindings('error')
if (errors.length > 0) {
  console.log('Errors:')
  for (const error of errors) {
    console.log(`  Tag ${error.tag}: ${error.message}`)
  }
}
```

### Specifying a SOP Class UID

If the dataset does not contain a SOP Class UID or you want to validate against a specific IOD, use the `sopClassUID` option.

```typescript
import { validateDataset, DicomDataset, type ValidateOptions } from 'dicom-validator-ts'

const dataset = new DicomDataset(elements)

const options: ValidateOptions = {
  sopClassUID: '1.2.840.10008.5.1.4.1.1.2', // Validate as CT Image Storage
}

const result = await validateDataset(dataset, options)
console.log(`Result: ${result.passed ? 'passed' : 'failed'}`)
```

## Error handling

`validate()` throws specific error classes when file reading or parsing fails.

```typescript
import {
  validate,
  FileNotFoundError,
  InvalidDicomError,
  DicomValidatorError,
} from 'dicom-validator-ts'

try {
  const result = await validate('./missing-file.dcm')
} catch (error) {
  if (error instanceof FileNotFoundError) {
    console.error(`File not found: ${error.filePath}`)
  } else if (error instanceof InvalidDicomError) {
    console.error('Not a valid DICOM file')
  } else if (error instanceof DicomValidatorError) {
    console.error(`Validation error [${error.code}]: ${error.message}`)
  }
}
```

## Next steps

- [CLI Usage](/guide/cli-usage) — Validate from the command line
- [Configuration](/guide/configuration) — Details on `ValidateOptions`
