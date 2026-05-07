# Contributing to dicom-validator-ts

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (included with Node.js)

## Development Setup

1. Clone the repository:

```bash
git clone https://github.com/your-org/dicom-validator-ts.git
cd dicom-validator-ts
```

2. Install dependencies:

```bash
npm install
```

3. Verify the setup:

```bash
npm test
npm run build
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run the test suite with Vitest |
| `npm run build` | Build ESM + CJS bundles with tsup |
| `npm run lint` | Type-check with TypeScript (no emit) |

## Project Structure

```
src/
├── index.ts              # Public API exports
├── validator.ts          # Top-level validate functions
├── errors.ts             # Error class hierarchy
├── parser/               # DICOM file/buffer parsing (dcmjs)
├── dictionary/           # DICOM standard data (tags, IODs, modules)
├── validators/           # VR, VM, IOD, module validation
│   └── vr/              # Per-VR-type validators
├── condition/            # Condition AST types, parser, evaluator
├── result/               # ValidationResult class
├── types/                # Shared type definitions
└── cli/                  # CLI entry point (yargs)
tests/
└── fixtures/             # Sample DICOM files for integration tests
```

## Running Tests

Run the full test suite:

```bash
npm test
```

Run tests in watch mode during development:

```bash
npx vitest
```

Run a specific test file:

```bash
npx vitest run src/validators/tag-validator.test.ts
```

The project uses [Vitest](https://vitest.dev/) as the test framework and [fast-check](https://github.com/dubzzz/fast-check) for property-based tests.

## Code Style and Conventions

- **TypeScript strict mode** is enabled — all code must pass strict type checking.
- Use **ES module** syntax (`import`/`export`).
- Co-locate unit tests with source files using the `.test.ts` suffix.
- Property-based tests use the `.prop.test.ts` suffix.
- Use descriptive names for test cases that explain what is being tested.
- Keep functions focused and small. Prefer composition over inheritance.
- Use `readonly` for properties that should not be mutated after construction.
- Error classes extend `DicomValidatorError` with a machine-readable `code` field.

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`.
2. **Write tests** for any new functionality or bug fixes.
3. **Ensure all tests pass** (`npm test`) and the project builds (`npm run build`).
4. **Ensure type checking passes** (`npm run lint`).
5. **Keep commits focused** — one logical change per commit.
6. **Write a clear PR description** explaining what changed and why.
7. **Link related issues** if applicable.

## Reporting Bugs

- Open a GitHub issue with a clear description of the problem.
- Include the DICOM file (or a minimal reproduction) if possible.
- Include the Node.js version and OS.

## Suggesting Features

- Open a GitHub issue describing the feature and its use case.
- Discuss the approach before starting implementation.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
