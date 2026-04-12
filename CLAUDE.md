# Project Guidelines

## Plan Mode: ONLY PLAN, NEVER EXECUTE — CRITICAL RULE

**THIS IS THE MOST IMPORTANT RULE IN THIS PROJECT.**

When Plan Mode is active, you are STRICTLY FORBIDDEN from:
- Creating, editing, or writing ANY file (except the plan file itself)
- Running any non-read-only commands (no builds, no commits, no installs)
- Making any changes to the codebase whatsoever

What you CAN do in Plan Mode:
- Read files (Read, Glob, Grep)
- Launch Explore agents for research
- Write/edit the plan file at `~/.claude/plans/`
- Ask the user questions via AskUserQuestion
- Call ExitPlanMode when the plan is ready

**The workflow is: Plan → ExitPlanMode → User approves → THEN implement.**

If the user enters Plan Mode (even via the system), you MUST wait for their explicit approval before writing any code. There are NO exceptions. Even if the fix seems trivial or obvious, you MUST write it in the plan first and get approval. Executing without approval is dangerous because:
1. The user may want a different approach
2. The change may conflict with other ongoing work
3. It wastes effort if the plan is rejected

**If you catch yourself about to edit a file while in Plan Mode, STOP immediately.**

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

## API Cost Tracking

Whenever you create or modify code that calls external APIs (ScrapingDog, Apify, OpenRouter), you MUST add cost logging using `logApiCost()` from `src/lib/api-costs.ts`. This feeds the dashboard cost monitoring.

```typescript
import { logApiCost, API_COSTS } from "@/lib/api-costs";

logApiCost({
  userId,           // optional: who triggered it
  source: "casting", // 'casting' | 'leads' | 'enrichment'
  searchId,          // optional: casting_list.id or leads_scan.id
  provider: "apify", // 'scrapingdog' | 'apify' | 'openrouter'
  operation: "searchLinkedInProfiles",
  estimatedCost: API_COSTS.apify.searchLinkedInProfiles,
  metadata: { resultsCount: 50 }, // optional extra info
});
```

Estimated costs are defined in `API_COSTS` constant in `src/lib/api-costs.ts`. Update them if pricing changes.

## Verification Steps

After every implementation, always provide the user with a simple, concise checklist of steps to verify the changes work correctly. Keep it short and actionable — the user should be able to follow it quickly.
