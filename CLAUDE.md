# Project Guidelines

## IMPORTANT: Read Before Any Implementation

Before writing any code, you MUST read the following documentation:

1. [*AGENTS.md*](AGENTS.md) - Project structure, commands, and coding rules

## SQL Migrations

Whenever a SQL script is created or modified, always save it as a numbered file in the `migrations/` folder using the format:

```
migrations/<NNN>_<description>.sql
```

Example: `migrations/001_initial_schema.sql`, `migrations/002_add_rls_policies.sql`

Increment the number sequentially based on the last existing migration file.

## Ask Before Assuming

If there is any doubt about what needs to be done, always ask the user before proceeding. Do not guess requirements or make assumptions about intended behavior. It is always better to ask a quick question than to implement the wrong thing.

## Verification Steps

After every implementation, always provide the user with a simple, concise checklist of steps to verify the changes work correctly. Keep it short and actionable — the user should be able to follow it quickly.
