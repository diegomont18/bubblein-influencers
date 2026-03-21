# AGENTS.md

## Core Principle

*Never modify tests to make the build pass.* Always fix the production code first. Tests should only be changed when the business rule or requirement has changed — never to accommodate a broken implementation.

---

## TDD — Red/Green/Refactor

All development follows the strict TDD cycle:

### 1. Red — Write a failing test

- Write a test that describes the expected behavior *before* writing production code.
- Run the test and confirm it *fails* for the right reason.
- If the test already passes without new code, it is not testing anything useful — rewrite it.

### 2. Green — Write the minimum code to pass

- Implement *only* what is necessary for the test to pass.
- Do not anticipate features. Do not generalize. Do not optimize.
- Run the test and confirm it *passes*.

### 3. Refactor — Improve without changing behavior

- Remove duplication, improve naming, simplify structure.
- All tests must continue passing after the refactor.
- If any test breaks during refactor, *fix the code, not the test*.

### Applying TDD to Behavior Changes

The classic Red/Green/Refactor cycle applies to *new features*: write a failing test first, then implement.

For *behavior changes* (requirement changes, strategy redesigns), the workflow is different:

1. *Implement* the production code changes first.
2. *Run all tests.* Evaluate what breaks.
3. *If a test fails* — first assume the implementation is wrong. Fix the production code.
4. *Only if the business requirement explicitly changed* — update the test to match the new behavior.
5. *Add new tests* for genuinely new behavior that wasn't covered before.

Never start by modifying existing tests — always start by changing the production code and letting the test suite tell you what broke.

### Golden Rule for Test Modification

Existing tests may *only* be changed when:

- The business requirement has explicitly changed.
- The test validates obsolete behavior that no longer exists.
- The test has a proven bug in itself (asserting against a wrong value).

Tests must *never* be changed when:

- Production code changed and tests broke — fix the code.
- A refactor caused failures — the refactor introduced a regression, undo it.
- "It's easier to adjust the test" — this is a code smell. Investigate the root cause.

---

## Verification Pipeline

Before considering any task complete, run *all* steps below, in order:

### 1. Lint / Formatting

- Run the linter and formatter configured in the project.
- Fix *all* lint errors before proceeding.
- Do not disable lint rules to work around problems. Fix the code.
- Warnings should also be resolved unless they are documented false positives.

### 2. Unit Tests

- Run the full unit test suite.
- *All* tests must pass. Zero failures tolerated.
- If a test fails, investigate and fix the *production code* first.
- Never skip tests with skip/pending/xfail to make the build pass.

### 3. Evaluation

- Run the ADK evaluation suite.
- All evaluations must pass before considering the task done.

### Mandatory Order

Lint → Unit Tests → Evaluation

Do not advance to the next step if the previous one is not 100% green.

---

## Best Practices — Unit Tests

### Structure

- *One concept per test.* Each test validates a single rule or behavior.
- *Arrange / Act / Assert.* Organize every test in these three clear sections.
- *Descriptive names.* Test names must describe the scenario and expected outcome, e.g., should return empty list when no items match filter.

### Isolation

- Unit tests must *not* access databases, network, filesystem, or external services.
- Use mocks/stubs/fakes only for external dependencies, never for the module under test.
- Each test must be independent — execution order must not affect the result.

### Quality

- Test behavior, not implementation. Do not couple tests to internal details.
- Cover the paths: happy path, edge cases, expected errors.
- Avoid conditional logic inside tests (if/else, loops). Tests must be linear.
- Do not use magic values. Use named constants or builders for test data.
- Do not test trivial getters/setters or generated code — test real behavior.

### Maintenance

- Moderate DRY: prefer clarity over reuse. Duplication in tests is acceptable if it improves readability.
- Use factories/fixtures to create complex test objects. Avoid massive setup.
- Keep tests fast. If a unit test takes more than 1 second, something is wrong.

---

## General Rules

- *Do not comment out code.* Delete what is not needed.
- *Do not add TODOs.* Fix it now or create an issue.
- *Small, atomic commits.* Each commit represents a single functional unit of change.
- *Descriptive commit messages.* Explain the "why", not the "what".
