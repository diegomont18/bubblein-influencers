# Project Guidelines

## SQL Migrations

Whenever a SQL script is created or modified, always save it as a numbered file in the `migrations/` folder using the format:

```
migrations/<NNN>_<description>.sql
```

Example: `migrations/001_initial_schema.sql`, `migrations/002_add_rls_policies.sql`

Increment the number sequentially based on the last existing migration file.
