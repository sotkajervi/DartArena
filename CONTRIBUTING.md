# Contributing to DartArena

DartArena should stay simple, explicit and easy to maintain.

## Default rules

- New application code should be TypeScript unless there is a concrete reason not to use it.
- Prefer small functions and modules with one clear responsibility.
- Prefer browser/platform APIs and existing project utilities before adding a dependency.
- Do not add a package for functionality that can be expressed clearly in a few lines of TypeScript.
- Keep UI rendering, game rules, database calls and WebRTC concerns separated where practical.
- Prefer readable code over compressed or clever code.
- Avoid global state in new code when a module-local value or explicit parameter is sufficient.
- Validate untrusted input at the server/database boundary as described in `SECURITY.md`.

## Source structure

New and migrated code belongs under `src/`:

- `src/components/` — reusable UI components and rendering helpers.
- `src/pages/` — page-level orchestration. Pages connect components, data and browser lifecycle.
- `src/lib/` — reusable domain logic, Supabase helpers, WebRTC helpers and pure utilities.
- `src/hooks/` — reusable browser/event lifecycle helpers when they are actually needed.
- `src/types/` — shared TypeScript types.

Do not create a new abstraction or directory unless more than one call site benefits from it.

## Legacy migration

The current root-level JavaScript is production code and remains in place while DartArena is migrated gradually.

Do not move or rewrite a working subsystem solely to make the directory tree prettier. When a legacy file needs meaningful work, extract reusable logic into `src/` only when that reduces duplication or makes the code safer.

The working X01/WebRTC path is especially sensitive: refactor it only with a backup and a two-account test plan.

## Quality checks

Install development tools once:

```bash
npm install
```

Before committing new TypeScript code:

```bash
npm run check
```

Useful individual commands:

```bash
npm run typecheck
npm run lint
npm run format
npm run format:check
```

## Dependencies

Runtime dependencies require a clear reason. Before adding one, check whether:

1. the browser already provides the capability,
2. DartArena already has a helper for it,
3. a small local module is simpler,
4. the dependency meaningfully reduces risk or maintenance.

Development-only tooling is acceptable when it directly improves correctness or consistency.

## Change discipline

For risky changes:

1. take a backup branch,
2. inspect the existing flow before editing,
3. make the smallest coherent change,
4. keep old behavior compatible where possible,
5. test with ordinary player accounts rather than only admin accounts.
