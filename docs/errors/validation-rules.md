---
title: Validation Rules Reference
description: Complete reference of all validation rule identifiers produced by dicom-validator-ts
---

# Validation Rules Reference

A complete list of all validation rule identifiers that dicom-validator-ts can produce. Each rule includes its severity, a description of the violation, and a suggested resolution.

## Severity Levels

| Level | Meaning |
|-------|---------|
| error | DICOM standard conformance violation. Data correction is required |
| warning | Potential issue. Review recommended |
| info | Informational. No action required |

## VR Validation

Validation rules for Value Representation (VR) format constraints.

| Rule | Severity | Description | Resolution |
|------|----------|-------------|------------|
| `vr-format-AE` | error | Application Entity format violation (exceeds 16 chars, contains backslash, or contains control characters) | Limit the value to 16 characters and remove backslashes and control characters |
| `vr-format-AS` | error | Age String format violation (not 4 characters, not in NNN[DWMY] format) | Correct the value to NNN[DWMY] format (e.g., 045Y) with exactly 4 characters |
| `vr-format-CS` | error | Code String format violation (exceeds 16 chars or contains disallowed characters) | Limit the value to 16 characters using only uppercase letters, digits, spaces, and underscores |
| `vr-format-DA` | error | Date format violation (not in YYYYMMDD format or invalid month/day) | Correct the value to a valid date in YYYYMMDD format (e.g., 20240101) |
| `vr-format-DS` | error | Decimal String format violation (exceeds 16 chars or not a valid numeric format) | Correct the value to a valid decimal string of 16 characters or fewer (e.g., 3.14, -1.0e2) |
| `vr-format-IS` | error | Integer String format violation (exceeds 12 chars or not a valid integer format) | Correct the value to a valid integer string of 12 characters or fewer (e.g., 42, -100) |
| `vr-format-LO` | error | Long String format violation (exceeds 64 characters) | Shorten the value to 64 characters or fewer |
| `vr-format-LT` | error | Long Text format violation (exceeds 10240 characters) | Shorten the value to 10240 characters or fewer |
| `vr-format-PN` | error | Person Name format violation (too many component groups, group too long, or too many components) | Limit to 3 groups max, 64 characters per group, and 5 components per group |
| `vr-format-SH` | error | Short String format violation (exceeds 16 characters) | Shorten the value to 16 characters or fewer |
| `vr-format-ST` | error | Short Text format violation (exceeds 1024 characters) | Shorten the value to 1024 characters or fewer |
| `vr-format-TM` | error | Time format violation (not in HHMMSS.FFFFFF format or invalid hour/minute/second) | Correct the value to a valid time in HH, HHMM, HHMMSS, or HHMMSS.FFFFFF format |
| `vr-format-UI` | error | Unique Identifier format violation (exceeds 64 chars or invalid format) | Limit to 64 characters and use only digits and periods to form a valid UID |
| `vr-format-UR` | error | URI format violation (contains trailing spaces) | Remove trailing spaces from the value |
| `vr-format-UT` | error | Unlimited Text format violation (exceeds maximum length) | Shorten the value to the maximum length (2^32-2 characters) or fewer |

## VM Validation

Validation rules for Value Multiplicity (VM) constraints.

| Rule | Severity | Description | Resolution |
|------|----------|-------------|------------|
| `vm-constraint` | error | Value Multiplicity constraint violation (number of values does not match the tag's VM definition) | Set the number of values to match the VM constraint specified in the tag definition |

## Module Validation

Validation rules for attribute presence and value constraints within DICOM modules.

| Rule | Severity | Description | Resolution |
|------|----------|-------------|------------|
| `type1-missing` | error | Type 1 (required) attribute is missing from the dataset | Add the required attribute to the dataset |
| `type1-empty` | error | Type 1 attribute has an empty value (Type 1 attributes must not be empty) | Set a valid value for the attribute |
| `type2-missing` | warning | Type 2 attribute is missing (empty values are allowed but the attribute itself is required) | Add the attribute to the dataset (value may be empty) |
| `condition-indeterminate` | info | Condition for a conditional attribute (Type 1C/2C) cannot be evaluated | Verify that the related attributes needed for condition evaluation are present in the dataset |

## IOD Validation

Validation rules for Information Object Definition (IOD) structure.

| Rule | Severity | Description | Resolution |
|------|----------|-------------|------------|
| `iod-sop-class-missing` | error | SOP Class UID tag (0008,0016) is missing from the dataset | Add the SOP Class UID tag to the dataset |
| `iod-sop-class-unknown` | error | SOP Class UID is not recognized (not found in the dictionary) | Set a valid SOP Class UID or specify one via the sopClassUID option |
| `iod-module-not-found` | warning | Module definition referenced by the IOD is not found in the dictionary | Verify that the module dictionary is up to date |
| `iod-module-condition-indeterminate` | info | Inclusion condition for a conditional module cannot be evaluated | Verify that the related attributes needed for condition evaluation are present in the dataset |

## Tag Validation

Validation rules for individual tag inspection.

| Rule | Severity | Description | Resolution |
|------|----------|-------------|------------|
| `vr-unknown` | warning | No validator is registered for the specified VR | Verify the VR is correct. If the VR is unsupported, this can be safely ignored |
| `vr-undetermined` | warning | The tag's VR cannot be determined (not in dictionary and no explicit VR) | Verify the tag is correct and consider using an explicit VR transfer syntax |
| `private-tag-skipped` | info | Validation of a private tag was skipped | No action needed. Private tags are excluded from standard validation |
| `retired-tag` | info | A retired tag is being used | Consider replacing with the current equivalent tag if available |

## Using Rule Identifiers

You can use the `rule` field from validation findings to filter and categorize results:

```typescript
import { validate } from 'dicom-validator-ts';

const result = await validate('path/to/file.dcm');

// Get errors only
const errors = result.findings.filter(f => f.severity === 'error');

// Filter by specific rules
const vrErrors = result.findings.filter(f => f.rule.startsWith('vr-format-'));
const moduleErrors = result.findings.filter(f =>
  ['type1-missing', 'type1-empty', 'type2-missing'].includes(f.rule)
);

// Count findings by rule
const ruleCount = result.findings.reduce((acc, f) => {
  acc[f.rule] = (acc[f.rule] || 0) + 1;
  return acc;
}, {} as Record<string, number>);
```
