# Plan: Add Median Likes & Comments Metrics

## Context
The casting search and enricher profile table currently show **average** likes and comments per post. The user wants to also show the **median** of these two metrics, since medians are more robust to outlier posts (a single viral post can skew the average significantly).

## Files to modify

| File | Change |
|------|--------|
| `src/lib/normalize.ts` | Add median calculation to `calculateEngagementMetrics()` and `computeEngagementFromPosts()` |
| `src/app/api/casting/search/route.ts` | Pass median values through to casting results |
| `src/components/casting/casting-results.tsx` | Add `median_likes_per_post` / `median_comments_per_post` to `CastingProfile` type, table headers, table cells, CSV export, and sort keys |
| `src/components/enricher/profile-table.tsx` | Add median columns to table headers, cells, and sortable headers |
| `src/lib/supabase/types.ts` | Add `median_likes_per_post` and `median_comments_per_post` to profiles Row/Insert/Update types |
| `src/app/api/profiles/route.ts` | Add median columns to the allowed sort fields |
| `src/app/api/profiles/export/route.ts` | Add median columns to the export CSV |
| `migrations/014_add_median_engagement.sql` | Add `median_likes_per_post` and `median_comments_per_post` numeric columns to `profiles` table |

## Implementation

### 1. SQL Migration (`migrations/014_add_median_engagement.sql`)
```sql
ALTER TABLE profiles ADD COLUMN median_likes_per_post numeric;
ALTER TABLE profiles ADD COLUMN median_comments_per_post numeric;
```

### 2. Calculation logic (`src/lib/normalize.ts`)

Add a small `computeMedian` helper function (sort array, pick middle value or average of two middle values).

Update return type of both `calculateEngagementMetrics()` and `computeEngagementFromPosts()` from:
```ts
{ avgLikes: number | null; avgComments: number | null }
```
to:
```ts
{ avgLikes: number | null; avgComments: number | null; medianLikes: number | null; medianComments: number | null }
```

In both functions, collect the individual likes/comments values into arrays (they already iterate over posts), then compute the median from those arrays using the helper.

### 3. Casting search API (`src/app/api/casting/search/route.ts`)

At ~line 312-313 where engagement is spread into the result object, add:
```ts
median_likes_per_post: engagement.medianLikes,
median_comments_per_post: engagement.medianComments,
```

### 4. Casting results component (`src/components/casting/casting-results.tsx`)

- Add `median_likes_per_post` and `median_comments_per_post` to `CastingProfile` interface
- Add to `SortKey` type
- Add two `<SortableHeader>` columns after "Avg Comments" for "Med Likes" and "Med Comments"
- Add two `<td>` cells after avg comments display (same formatting: `Math.round(...)`)
- Add to CSV export headers and row data

### 5. Enricher profile table (`src/components/enricher/profile-table.tsx`)

- Add two `<SortableHeader>` columns after "Avg Comments" for "Med Likes" and "Med Comments"
- Add two `<td>` cells in the row rendering after avg comments
- Update `colSpan` values if needed for empty/loading states

### 6. Types (`src/lib/supabase/types.ts`)

Add `median_likes_per_post: number | null` and `median_comments_per_post: number | null` to profiles `Row`, `Insert`, and `Update` types.

### 7. Profiles API (`src/app/api/profiles/route.ts`)

Add `"median_likes_per_post"` and `"median_comments_per_post"` to the allowed sort columns array at line 29.

### 8. Profiles export (`src/app/api/profiles/export/route.ts`)

Add median columns to the select query and CSV row generation.

## Verification
1. Run `npx next build` — confirm no build errors
2. Run `npm run dev` — visually check casting search results table has 4 engagement columns (avg likes, avg comments, med likes, med comments)
3. Verify enricher profile table also shows median columns
4. Run a casting search and confirm median values appear alongside averages
5. Test CSV export includes median columns
6. Run the migration SQL against Supabase
