---
title: Configuration
description: ValidateOptions interface fields and how to configure validation behavior
---

# Configuration

The `validate()` and `validateDataset()` functions accept a `ValidateOptions` object as their second argument. This allows fine-grained control over validation behavior.

## ValidateOptions interface

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

## checks — Validation category control

The `checks` object lets you enable or disable each validation category individually. All fields are optional and default to `true` (enabled).

### checks.vr

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |

Controls VR (Value Representation) format validation. When `true`, validates that each VR (AE, DA, UI, etc.) conforms to the DICOM standard format.

### checks.vm

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |

Controls VM (Value Multiplicity) constraint validation. When `true`, validates that the number of values for each tag conforms to the defined VM constraint (e.g., `1`, `1-n`, `2-2n`).

### checks.iod

| Property | Value |
|----------|-------|
| Type | `boolean` |
| Default | `true` |

Controls IOD (Information Object Definition) structure validation. When `true`, validates module composition based on SOP Class and detects missing required attributes (Type 1/Type 2).

## sopClassUID

| Property | Value |
|----------|-------|
| Type | `string` |
| Default | `undefined` (auto-detected) |

Explicitly specifies the SOP Class UID to use for validation. Normally the SOP Class UID is auto-detected from tag `(0008,0016)` in the DICOM dataset. When this option is set, auto-detection is skipped and IOD validation is performed based on the specified UID.

Useful for testing or when you want to force validation against a specific SOP Class.

## verbosity

| Property | Value |
|----------|-------|
| Type | `'errors-only' \| 'normal' \| 'verbose'` |
| Default | `'normal'` |

Controls the filtering level of validation results.

| Value | Included results |
|-------|-----------------|
| `'errors-only'` | errors only |
| `'normal'` | errors + warnings |
| `'verbose'` | errors + warnings + infos |

Use `'errors-only'` to focus on critical issues. Use `'verbose'` to include informational notices such as private tag skipping and retired tag usage.

## Examples

### Default configuration

```typescript
import { validate } from 'dicom-validator-ts'

// No options — all checks enabled, verbosity is 'normal'
const result = await validate('path/to/dicom-file.dcm')
```

### Disable VR checks only

```typescript
import { validate } from 'dicom-validator-ts'

const result = await validate('path/to/dicom-file.dcm', {
  checks: {
    vr: false, // Disable VR format checks
    // vm: true (default)
    // iod: true (default)
  },
})
```

### Run IOD structure checks only

```typescript
import { validate } from 'dicom-validator-ts'

const result = await validate('path/to/dicom-file.dcm', {
  checks: {
    vr: false,
    vm: false,
    iod: true,
  },
})
```

### Explicitly specify SOP Class UID

```typescript
import { validate } from 'dicom-validator-ts'

// Force validation as CT Image Storage
const result = await validate('path/to/dicom-file.dcm', {
  sopClassUID: '1.2.840.10008.5.1.4.1.1.2',
})
```

### Switching verbosity

```typescript
import { validate } from 'dicom-validator-ts'

// Show errors only (exclude warnings and infos)
const errorsOnly = await validate('path/to/dicom-file.dcm', {
  verbosity: 'errors-only',
})

// Show all results (including info level)
const verbose = await validate('path/to/dicom-file.dcm', {
  verbosity: 'verbose',
})
```

### Combining multiple options

```typescript
import { validate } from 'dicom-validator-ts'

const result = await validate('path/to/dicom-file.dcm', {
  checks: {
    vr: true,
    vm: true,
    iod: false, // Skip IOD checks
  },
  sopClassUID: '1.2.840.10008.5.1.4.1.1.2',
  verbosity: 'errors-only',
})

if (!result.passed) {
  console.log(`${result.summary.errors} error(s) found`)
  for (const finding of result.findings) {
    console.log(`  [${finding.severity}] ${finding.rule}: ${finding.message}`)
  }
}
```
