---
title: Types & Interfaces
description: Reference for all type definitions and interfaces exported by dicom-validator-ts
---

# Types & Interfaces

Reference for the type definitions and interfaces exported by dicom-validator-ts.

## ValidateOptions

Options interface that controls validation behavior. Passed as the second argument to `validate()` and `validateDataset()`.

```typescript
interface ValidateOptions {
  checks?: {
    vr?: boolean
    vm?: boolean
    iod?: boolean
  }
  sopClassUID?: string
  verbosity?: 'errors-only' | 'normal' | 'verbose'
}
```

| Field | Type | Description |
|-------|------|-------------|
| `checks` | `{ vr?: boolean; vm?: boolean; iod?: boolean }` | Enable/disable settings per validation category |
| `checks.vr` | `boolean` | Enable/disable VR format validation (default: `true`) |
| `checks.vm` | `boolean` | Enable/disable VM constraint validation (default: `true`) |
| `checks.iod` | `boolean` | Enable/disable IOD structure validation (default: `true`) |
| `sopClassUID` | `string` | Explicitly specify SOP Class UID, skipping auto-detection |
| `verbosity` | `'errors-only' \| 'normal' \| 'verbose'` | Result filtering level (default: `'normal'`) |

## ValidationFinding

Interface representing an individual finding detected during validation.

```typescript
interface ValidationFinding {
  severity: Severity
  tag: string
  module: string
  message: string
  rule: string
}
```

| Field | Type | Description |
|-------|------|-------------|
| `severity` | `Severity` | Severity level of the finding |
| `tag` | `string` | Tag identifier in `"(GGGG,EEEE)"` format. Empty string if not tag-specific |
| `module` | `string` | Module name. Empty string if not module-specific |
| `message` | `string` | Human-readable description (1–500 characters) |
| `rule` | `string` | Identifier of the violated validation rule |

## ValidationSummary

Interface that aggregates finding counts by severity.

```typescript
interface ValidationSummary {
  errors: number
  warnings: number
  infos: number
}
```

| Field | Type | Description |
|-------|------|-------------|
| `errors` | `number` | Number of errors |
| `warnings` | `number` | Number of warnings |
| `infos` | `number` | Number of informational findings |

## Severity

Type alias representing the severity level of a validation finding.

```typescript
type Severity = 'error' | 'warning' | 'info'
```

| Value | Description |
|-------|-------------|
| `'error'` | Critical violation of the DICOM standard, such as missing required attributes or format violations |
| `'warning'` | Issues requiring attention, such as missing Type 2 attributes or undetermined VR |
| `'info'` | Informational notices, such as private tag skipping or retired tag usage |

## DicomElement

Interface representing a single DICOM data element.

```typescript
interface DicomElement {
  tag: string
  vr: string
  value: DicomValue
  rawValue?: string
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tag` | `string` | Tag in `"(GGGG,EEEE)"` format |
| `vr` | `string` | Value Representation (e.g., `"DA"`, `"UI"`, `"PN"`) |
| `value` | `DicomValue` | Parsed value |
| `rawValue` | `string \| undefined` | Original string representation for VR validation (optional) |

## DicomValue

Union type representing the possible values a DICOM element can hold.

```typescript
type DicomValue =
  | string
  | number
  | string[]
  | number[]
  | SequenceItem[]
  | Buffer
  | null
```

| Type | Description |
|------|-------------|
| `string` | Single string value (DA, UI, PN, and many other string VRs) |
| `number` | Single numeric value (US, UL, FL, FD, etc.) |
| `string[]` | Multi-valued string array (string VRs with VM > 1) |
| `number[]` | Multi-valued numeric array (numeric VRs with VM > 1) |
| `SequenceItem[]` | Array of items for sequence (SQ) elements |
| `Buffer` | Binary data (OB, OW, OD, OF, etc.) |
| `null` | No value (empty element) |

## IDicomDataset

Interface for accessing elements in a DICOM dataset.

```typescript
interface IDicomDataset {
  elements: Map<string, DicomElement>
  getElement(tag: string): DicomElement | undefined
  hasTag(tag: string): boolean
  getString(tag: string): string | undefined
}
```

| Member | Type | Description |
|--------|------|-------------|
| `elements` | `Map<string, DicomElement>` | Map of all elements keyed by tag string `"(GGGG,EEEE)"` |
| `getElement(tag)` | `(tag: string) => DicomElement \| undefined` | Retrieves the element for the given tag |
| `hasTag(tag)` | `(tag: string) => boolean` | Checks whether the given tag exists in the dataset |
| `getString(tag)` | `(tag: string) => string \| undefined` | Retrieves the string value for the given tag (first value if multi-valued) |

## SequenceItem

Interface representing a single item within a DICOM sequence (SQ) element.

```typescript
interface SequenceItem {
  elements: Map<string, DicomElement>
}
```

| Field | Type | Description |
|-------|------|-------------|
| `elements` | `Map<string, DicomElement>` | Map of elements within the sequence item |

## Usage examples

### Working with validation result types

```typescript
import {
  validate,
  type ValidationFinding,
  type ValidationSummary,
  type Severity,
} from 'dicom-validator-ts'

const result = await validate('path/to/dicom-file.dcm', {
  verbosity: 'verbose',
})

// Check counts via ValidationSummary
const summary: ValidationSummary = result.summary
console.log(`errors: ${summary.errors}, warnings: ${summary.warnings}, infos: ${summary.infos}`)

// Filter ValidationFindings by severity
const errors: ValidationFinding[] = result.findings.filter(
  (f): f is ValidationFinding => f.severity === 'error'
)

for (const finding of errors) {
  console.log(`[${finding.rule}] ${finding.tag}: ${finding.message}`)
}
```

### Building a DicomDataset for validation

```typescript
import {
  validateDataset,
  DicomDataset,
  type DicomElement,
  type IDicomDataset,
  type SequenceItem,
} from 'dicom-validator-ts'

// Create DicomElements
const elements = new Map<string, DicomElement>()
elements.set('(0008,0016)', {
  tag: '(0008,0016)',
  vr: 'UI',
  value: '1.2.840.10008.5.1.4.1.1.2',
})
elements.set('(0010,0010)', {
  tag: '(0010,0010)',
  vr: 'PN',
  value: 'Yamada^Taro',
})

// Create an object satisfying the IDicomDataset interface
const dataset: IDicomDataset = new DicomDataset(elements)

// Run validation
const result = await validateDataset(dataset)
console.log(`passed: ${result.passed}`)
```
