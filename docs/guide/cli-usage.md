---
title: CLI Usage
description: Options, exit codes, and usage examples for the dicom-validator CLI
---

# CLI Usage

Use the `dicom-validator` command to validate DICOM files from the terminal.

## Basic syntax

```bash
dicom-validator [options] <files...>
```

File paths support glob patterns (`*.dcm`, `scan?.dcm`, etc.).

## Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--format` | `-f` | `text` \| `json` | `text` | Output format |
| `--quiet` | `-q` | boolean | `false` | Suppress output for files with no errors |
| `--sop-class` | `-s` | string | — | Override the SOP Class UID used for validation |
| `--version` | — | — | — | Print version number |
| `--help` | — | — | — | Print help message |

### --format

Specifies the output format. `text` (default) produces human-readable output; `json` produces machine-readable JSON output.

### --quiet

When `--quiet` is specified, output is suppressed for files that pass validation. Only files with errors are shown.

### --sop-class

Normally the validator reads the SOP Class UID tag from the DICOM file to determine which IOD to apply. With `--sop-class`, the file's value is ignored and validation is performed using the specified SOP Class UID.

### --version

Prints the installed version of `dicom-validator` and exits.

### --help

Prints usage information and the list of options, then exits.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | All files are valid DICOM (no validation errors) |
| `1` | Validation errors were detected |
| `2` | Runtime error (file not found, parse error, invalid arguments, etc.) |

Exit codes can be used in CI/CD pipelines and shell scripts to determine validation results.

## Examples

### Single file validation

```bash
dicom-validator scan.dcm
```

Example output:

```text
File: scan.dcm
  ERROR: (0008,0060) [General Series] Type 1 attribute is missing
  WARNING: (0010,0020) [Patient] Type 2 attribute is missing
```

### JSON output

```bash
dicom-validator --format json scan.dcm
```

Example output:

```json
{
  "file": "scan.dcm",
  "findings": [
    {
      "severity": "error",
      "rule": "type1-missing",
      "tag": "(0008,0060)",
      "module": "General Series",
      "message": "Type 1 attribute is missing"
    }
  ],
  "summary": {
    "errors": 1,
    "warnings": 0,
    "infos": 0
  },
  "passed": false
}
```

### Multiple file validation

```bash
dicom-validator images/*.dcm
```

### Specifying a SOP Class

```bash
dicom-validator --sop-class 1.2.840.10008.5.1.4.1.1.2 scan.dcm
```

### CI/CD usage

```bash
dicom-validator --quiet output/*.dcm
if [ $? -ne 0 ]; then
  echo "DICOM validation failed"
  exit 1
fi
```
