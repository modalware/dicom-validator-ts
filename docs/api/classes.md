---
title: Classes
description: Reference for all classes exported by dicom-validator-ts
---

# Classes

Reference for the classes exported by dicom-validator-ts.

## ValidationResult

A class that collects validation results and provides summary and query functionality. Findings are maintained in insertion order.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `findings` | `readonly ValidationFinding[]` | All findings (in insertion order) |
| `summary` | `ValidationSummary` | Count summary by severity |
| `passed` | `boolean` | `true` if error count is 0 |

### Methods

```typescript
addFinding(finding: ValidationFinding): void
```

Adds a finding to the result.

```typescript
getFindings(severity: Severity): ValidationFinding[]
```

Returns only findings matching the specified severity.

```typescript
toJSON(): { findings: ValidationFinding[]; summary: ValidationSummary }
```

Returns a JSON-serializable object.

### Example

```typescript
import { validate, ValidationResult } from 'dicom-validator-ts'

// Obtained as the return value of validate()
const result: ValidationResult = await validate('./image.dcm')

// Check results
console.log(`Passed: ${result.passed}`)
console.log(`Errors: ${result.summary.errors}`)
console.log(`Warnings: ${result.summary.warnings}`)
console.log(`Infos: ${result.summary.infos}`)

// Get errors only
const errors = result.getFindings('error')
for (const finding of errors) {
  console.log(`[${finding.rule}] ${finding.tag}: ${finding.message}`)
}

// JSON output
const json = result.toJSON()
console.log(JSON.stringify(json, null, 2))
```

---

## DicomDataset

Concrete implementation class for a DICOM dataset. Implements the `IDicomDataset` interface and provides element access by tag.

### Constructor

```typescript
constructor(elements?: Map<string, DicomElement>)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `elements` | `Map<string, DicomElement>` (optional) | Element map keyed by tag string. Defaults to an empty Map |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `elements` | `Map<string, DicomElement>` | All DICOM elements (keyed by tag string `"(GGGG,EEEE)"`) |

### Methods

```typescript
getElement(tag: string): DicomElement | undefined
```

Retrieves an element by tag string. Returns `undefined` if not found.

```typescript
hasTag(tag: string): boolean
```

Returns whether the specified tag exists in the dataset.

```typescript
getString(tag: string): string | undefined
```

Retrieves the string value for a tag. Returns the first value for multi-valued elements. Converts numbers to strings. Returns `undefined` for `null`, `Buffer`, or `SequenceItem[]` values.

### Example

```typescript
import { DicomDataset, type DicomElement } from 'dicom-validator-ts'

// Build a dataset
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
elements.set('(0010,0020)', {
  tag: '(0010,0020)',
  vr: 'LO',
  value: 'PATIENT-001',
})

const dataset = new DicomDataset(elements)

// Access elements
console.log(dataset.hasTag('(0010,0010)'))  // true
console.log(dataset.getString('(0010,0010)'))  // "Yamada^Taro"

const element = dataset.getElement('(0008,0016)')
if (element) {
  console.log(`VR: ${element.vr}, Value: ${element.value}`)
}

// Non-existent tag
console.log(dataset.hasTag('(0008,0060)'))  // false
console.log(dataset.getString('(0008,0060)'))  // undefined
```

---

## Error classes

Class hierarchy for I/O errors and parse errors that occur before validation. All extend `DicomValidatorError` and have a machine-readable `code` field.

### DicomValidatorError

Base class for all error classes.

```typescript
class DicomValidatorError extends Error {
  constructor(message: string, code: string)
}
```

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Error message |
| `code` | `string` | Machine-readable error code |
| `name` | `string` | `'DicomValidatorError'` |

#### Example

```typescript
import { validate, DicomValidatorError } from 'dicom-validator-ts'

try {
  await validate('./file.dcm')
} catch (error) {
  if (error instanceof DicomValidatorError) {
    // Catches all subclasses
    console.error(`Error code: ${error.code}`)
    console.error(`Message: ${error.message}`)
  }
}
```

---

### FileNotFoundError

Thrown when the specified file path does not exist.

```typescript
class FileNotFoundError extends DicomValidatorError {
  constructor(filePath: string)
}
```

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'FILE_NOT_FOUND'` | Error code |
| `filePath` | `string` | The file path that was not found |
| `name` | `string` | `'FileNotFoundError'` |

#### Example

```typescript
import { validate, FileNotFoundError } from 'dicom-validator-ts'

try {
  await validate('/data/missing-image.dcm')
} catch (error) {
  if (error instanceof FileNotFoundError) {
    console.error(`File not found: ${error.filePath}`)
    // error.code === 'FILE_NOT_FOUND'
  }
}
```

---

### FileNotReadableError

Thrown when the file exists but lacks read permissions.

```typescript
class FileNotReadableError extends DicomValidatorError {
  constructor(filePath: string)
}
```

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'FILE_NOT_READABLE'` | Error code |
| `filePath` | `string` | The file path that could not be read |
| `name` | `string` | `'FileNotReadableError'` |

#### Example

```typescript
import { validate, FileNotReadableError } from 'dicom-validator-ts'

try {
  await validate('/data/protected-image.dcm')
} catch (error) {
  if (error instanceof FileNotReadableError) {
    console.error(`No read permission: ${error.filePath}`)
    // error.code === 'FILE_NOT_READABLE'
  }
}
```

---

### InvalidDicomError

Thrown when the input data is not valid DICOM format.

```typescript
class InvalidDicomError extends DicomValidatorError {
  constructor(message: string)
}
```

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'INVALID_DICOM'` | Error code |
| `name` | `string` | `'InvalidDicomError'` |

#### Example

```typescript
import { validate, InvalidDicomError } from 'dicom-validator-ts'

try {
  await validate('./not-a-dicom-file.txt')
} catch (error) {
  if (error instanceof InvalidDicomError) {
    console.error(`Not a DICOM file: ${error.message}`)
    // error.code === 'INVALID_DICOM'
  }
}
```

---

### EmptyInputError

Thrown when the input data is empty (0 bytes).

```typescript
class EmptyInputError extends DicomValidatorError {
  constructor()
}
```

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'EMPTY_INPUT'` | Error code |
| `name` | `string` | `'EmptyInputError'` |

#### Example

```typescript
import { validate, EmptyInputError } from 'dicom-validator-ts'

try {
  await validate('./empty-file.dcm')
} catch (error) {
  if (error instanceof EmptyInputError) {
    console.error('Input data is empty')
    // error.code === 'EMPTY_INPUT'
  }
}
```

---

### TruncatedFileError

Thrown when the file data is cut off midway.

```typescript
class TruncatedFileError extends DicomValidatorError {
  constructor(byteOffset: number, tagAtFailure: string)
}
```

| Property | Type | Description |
|----------|------|-------------|
| `code` | `'TRUNCATED_FILE'` | Error code |
| `byteOffset` | `number` | Byte offset where data was truncated |
| `tagAtFailure` | `string` | Tag being processed when parsing failed |
| `name` | `string` | `'TruncatedFileError'` |

#### Example

```typescript
import { validate, TruncatedFileError } from 'dicom-validator-ts'

try {
  await validate('./corrupted-image.dcm')
} catch (error) {
  if (error instanceof TruncatedFileError) {
    console.error(
      `File is truncated (offset: ${error.byteOffset}, tag: ${error.tagAtFailure})`
    )
    // error.code === 'TRUNCATED_FILE'
  }
}
```
