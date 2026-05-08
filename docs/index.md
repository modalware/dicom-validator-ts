---
layout: home

hero:
  name: dicom-validator-ts
  text: DICOM Validation for TypeScript
  tagline: A lightweight validation library that comprehensively checks VR, VM, and IOD structure
  actions:
    - theme: brand
      text: Getting Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api/functions
    - theme: alt
      text: Error Reference
      link: /errors/validation-rules

features:
  - icon: 🔍
    title: VR Format Validation
    details: Validates 15 Value Representation types including AE, DA, UI, and more to ensure DICOM standard compliance.
  - icon: 📊
    title: VM Constraint Validation
    details: Checks that value counts conform to Value Multiplicity constraints such as 1, 1-n, and 2-2n.
  - icon: 🏗️
    title: IOD Structure Validation
    details: Validates module composition based on SOP Class and detects missing required attributes or invalid structures.
  - icon: ⚡
    title: Conditional Attribute Evaluation
    details: Parses and evaluates condition expressions for conditional attributes, performing presence checks accordingly.
  - icon: 📁
    title: Multiple Input Formats
    details: Accepts file paths, Buffers, and ArrayBuffers as input, making it usable across different environments.
  - icon: 💻
    title: CLI Tool Included
    details: Run validation directly from the command line with support for JSON output and filtering options.
---

## Installation

```bash
npm install dicom-validator-ts
```

## Quick Start

```typescript
import { validate } from 'dicom-validator-ts'

const result = await validate('path/to/dicom-file.dcm')

if (result.passed) {
  console.log('Validation passed')
} else {
  console.log(`Errors: ${result.summary.errors}`)
  result.findings.forEach(f => console.log(`  [${f.rule}] ${f.message}`))
}
```
