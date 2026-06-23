---
title: Promptly Engineering Design Amendment v1.1 — Blocker Fixes
source: architect-agent
source_type: sub-agent
tags: [engineering-design, promptly, amendment, v1.1, errata]
created_at: 2026-06-22T18:41:55.841Z
---
---
title: Promptly Engineering Design Amendment v1.1 — Blocker Fixes
source: architect-agent
source_type: sub-agent
tags: [engineering-design, promptly, amendment, v1.1, errata]
created_at: 2026-06-22
---

# Promptly Engineering Design Amendment v1.1 — Blocker Fixes

**Type:** Errata  
**Applies to:** Promptly Engineering Design Amendment v1.0 → v1.1  
**Fixes:** 3 blocking issues identified by design-review agent (2026-06-22)  
**Scope:** Only the three affected sections are reproduced here. All other sections of the amendment are unchanged.

---

## Fix 1 — §3.3.5, §3.5, §5, §3.6: R4 trigger cannot fire (per-session timestamps not propagated)

**Sections affected:** §3.3.5 `claudeCode.ts` (steps 4 and 7) · §3.5 metric mapping table · §5 `NormalizedSourceData` + `SourceMetrics` · §3.6 `R4_offPeak.ts`

**What was wrong:** The `claudeCode.ts` adapter extracts the first `timestamp` per session file (step 4) but discards the per-session timestamp list before normalization. The normalized output and `SourceMetrics` have no field from which R4's core trigger condition (`>70% of sessions fall between 08:00–18:00 on weekdays`) can be evaluated. R4 can check `session_count >= 20` and `data_window_days >= 7` but cannot evaluate the peak-hour condition; R4 never fires.

---

### Corrected §3.3.5 — `claudeCode.ts` step 4 and step 7

#### Step 4 (replace existing)

> 4\. For each session file, extract: `sessionId` (filename without extension), `projectDir` (parent directory name), and the first `timestamp` found in the file. **Retain the per-session first timestamp in a separate list `sessionFirstTimestamps: string[]` (one entry per session file that yielded at least one timestamp-bearing line). Sessions with no timestamp-bearing lines are counted in `sessionCount` but excluded from `sessionFirstTimestamps`.**

#### Peak-hour fraction computation (new step 4a, inserted after step 4, before step 5)

> 4a\. **Compute `claudeCodePeakHourFraction`** from `sessionFirstTimestamps`:
>
> ```typescript
> /**
>  * "Peak hour" = 08:00–18:00 Mon–Fri, evaluated in the local timezone offset
>  * carried by the ISO timestamp (e.g. "2026-06-15T09:23:11-07:00").
>  * If the timestamp has no offset (bare UTC "Z" or no suffix), treat as UTC.
>  */
> function isPeakHour(isoTimestamp: string): boolean {
>   const d = new Date(isoTimestamp);
>   // Extract the UTC offset from the raw string (e.g. "-07:00" → -420 min)
>   const offsetMatch = isoTimestamp.match(/([+-])(\d{2}):(\d{2})$/);
>   const offsetMinutes = offsetMatch
>     ? (offsetMatch[1] === '+' ? 1 : -1) *
>       (parseInt(offsetMatch[2], 10) * 60 + parseInt(offsetMatch[3], 10))
>     : 0;  // UTC
>   // Shift UTC epoch to local time
>   const localMs = d.getTime() + offsetMinutes * 60_000;
>   const local = new Date(localMs);
>   const dow = local.getUTCDay();    // 0=Sun, 1=Mon … 5=Fri, 6=Sat
>   const hour = local.getUTCHours(); // 0–23 in local time
>   return dow >= 1 && dow <= 5 && hour >= 8 && hour < 18;
> }
>
> const withTimestamp = sessionFirstTimestamps.length;
> const peakCount = sessionFirstTimestamps.filter(isPeakHour).length;
> const claudeCodePeakHourFraction: number | null =
>   withTimestamp > 0 ? peakCount / withTimestamp : null;
> ```
>
> If `claudeCodePeakHourFraction` is `null` (no sessions have timestamps), omit the field from the normalized output. R4 will treat `null` as not satisfying the trigger.

#### Step 7 normalized output (replace existing)

```typescript
{
  sourceId: 'claude_code',
  dailyTokensByModel: NormalizedUsageRecord[],   // one entry per (date, model)
  dailyCostUsd: { date: string; costUsd: number }[],  // summed across models per day
  cachedTokensSupported: true,
  sessionCount: number,                          // total distinct session files parsed
  claudeCodePeakHourFraction: number | undefined,// fraction in [0,1]; undefined if no timestamps
  periodStart: string,                           // min(timestamp) across all sessions
  periodEnd: string,                             // max(timestamp)
}
```

---

### Corrected §3.5 — Metric mapping table (new row)

Add the following row to the metric mapping table after row 7.14:

| Spec metric | Module | Function | Inputs | Output |
|---|---|---|---|---|
| 7.15a Claude Code peak-hour fraction | *(adapter pre-computed)* | — computed in `claudeCode.ts` step 4a | Per-session timestamps from `sessionFirstTimestamps` | `number \| undefined` in `NormalizedSourceData.claudeCodePeakHourFraction`; mapped 1:1 into `SourceMetrics.claudeCodePeakHourFraction`. No separate `tierB.ts` function needed. |

> **Note:** Row numbers 7.15–7.19 (Copilot metrics) shift to 7.16–7.20 in the final numbered list; only the new row at 7.15a is inserted here for clarity.

---

### Corrected §5 — `NormalizedSourceData` (add field, Claude Code block)

In `NormalizedSourceData`, after the `sessionCount` field comment, add:

```typescript
/** Claude Code only: fraction of sessions whose first timestamp falls 08:00–18:00 Mon–Fri
 *  (local time from ISO offset, or UTC if absent). undefined when no sessions have timestamps. */
claudeCodePeakHourFraction?: number;
```

Full updated Claude Code block in `NormalizedSourceData` (replace the existing comment block):

```typescript
/** Claude Code only: count of distinct session files parsed. */
sessionCount?: number;
/** Claude Code only: fraction of sessions with first timestamp in 08:00–18:00 Mon–Fri local time.
 *  Pre-computed by the adapter. undefined if no session has a parseable timestamp. */
claudeCodePeakHourFraction?: number;
```

---

### Corrected §5 — `SourceMetrics` (add field, Claude Code block)

In `SourceMetrics`, in the "Claude Code Tier B fields (NEW)" block, add after `claudeCodeAvgTokensPerSession`:

```typescript
/** Pre-computed by adapter. Fraction of sessions with first timestamp in 08:00–18:00 Mon–Fri.
 *  undefined if no session timestamps available. Used by R4 trigger. */
claudeCodePeakHourFraction?: number;                // 7.15a
```

Full updated Claude Code Tier B block in `SourceMetrics`:

```typescript
// Claude Code Tier B fields (NEW)
claudeCodeSessionCount?: number;                // 7.13
claudeCodeAvgTokensPerSession?: number;         // 7.14
claudeCodePeakHourFraction?: number;            // 7.15a — R4 trigger: fraction of sessions 08–18 weekday
totalInputTokensClaudeCode?: number;            // used by R1 trigger
cacheCreationInputTokensClaudeCode?: number;    // used by R1 trigger
```

---

### Corrected §3.6 — `R4_offPeak.ts` implementation (new subsection)

Add the following subsection after the R2 downgrade-candidate tables section:

#### R4 off-peak trigger implementation (`R4_offPeak.ts`)

```typescript
// server/src/engine/recommendations/R4_offPeak.ts

/** Spec §8 R4 — Off-Peak Hours
 *  Trigger: Claude Code connected AND
 *    peakHourFraction > 0.70 (>70% of sessions start 08:00–18:00 Mon–Fri)
 *    AND session_count >= 20
 *    AND data_window_days >= 7
 *  "Peak hour" defined as 08:00–18:00 local time Mon–Fri using timestamp offset,
 *  falling back to UTC when no offset is present.
 */
export const R4: Rule = {
  id: 'R4',
  severity: 'Low',
  evaluate(ctx: RuleContext): RecommendationResult[] {
    const cc = ctx.sources.find(s => s.sourceId === 'claude_code');
    if (!cc) return [];

    const sessionCount   = cc.claudeCodeSessionCount ?? 0;
    const peakFraction   = cc.claudeCodePeakHourFraction;   // undefined = no timestamps
    const windowDays     = computeDataWindowDays(cc.periodStart, cc.periodEnd);

    if (
      sessionCount >= 20 &&
      windowDays >= 7 &&
      peakFraction !== undefined &&
      peakFraction > 0.70
    ) {
      const pct = Math.round(peakFraction * 100);
      return [{
        id: 'R4',
        severity: 'Low',
        title: 'Most Claude Code sessions run during peak hours',
        body:
          `${pct}% of your Claude Code sessions start between 08:00–18:00 on weekdays. ` +
          `Shifting batch or long-context workloads to off-peak hours (evenings or weekends) ` +
          `can reduce response latency and improve throughput during high-demand periods.`,
        triggeringMetric: 'claudeCodePeakHourFraction',
        triggeringValue: peakFraction,
        estimatedSavingsUsd: null,   // R4 is a latency/UX recommendation, not a cost recommendation
        sourceIds: ['claude_code'],
      }];
    }

    return [];
  },
};
```

> **`computeDataWindowDays` helper** (unchanged from v1.0; shared across rules):
> ```typescript
> function computeDataWindowDays(start: string, end: string): number {
>   return Math.max(0, Math.round(
>     (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000
>   ));
> }
> ```

---

## Fix 2 — §3.3.3: GitHub Copilot adapter validate probe order reversed + `orgSlug` gate

**Section affected:** §3.3.3 `githubCopilot.ts` — validate step only

**What was wrong:** The amendment probes the individual endpoint first and the org endpoint second, reversing the spec's stated assumption (§5 Source 4 OQ-2 resolution: "tries the org endpoint first"). The org fallback is additionally gated on `ctx.options.orgSlug`, a field that no spec-defined UI surface ever populates (spec §4 Step 2 defines only a PAT input for GitHub Copilot). Org/enterprise-licensed users — the dominant enterprise use case — silently receive `NOT_FOUND` despite valid credentials.

---

### Corrected §3.3.3 — validate step

Replace the existing **validate** bullet entirely:

- **validate**: Call `GET /user` with `Authorization: token <pat>` and `X-GitHub-Api-Version: 2026-03-10` to confirm PAT validity and retrieve `{username}`.
  - 401 → `INVALID_KEY` immediately; stop.
  - Any other non-2xx → `{ valid: false, error: { code: 'UNKNOWN', message: 'GitHub /user returned unexpected status ${status}.' } }`

  Then **auto-discover org membership** and probe in the following order:

  1. **Org probe (first):** Call `GET /user/memberships/orgs?state=active` (no additional scope needed beyond the PAT being authenticated). Collect all orgs where `role` is `"member"` or `"admin"`. For each discovered org (in order returned by the API), attempt:
     ```
     GET /organizations/{org}/settings/billing/ai_credit/usage?per_page=1
     Header: X-GitHub-Api-Version: 2026-03-10
     ```
     Use the first org that returns **200**. Record `resolvedOrg: orgLogin` in `ctx.options` for use by `run`. If `GET /user/memberships/orgs` itself returns 404 or the user has zero active org memberships, skip to step 2 without error.

  2. **Individual fallback (second):** If no org returned 200 (or no orgs were found), attempt:
     ```
     GET /users/{username}/settings/billing/ai_credit/usage?per_page=1
     Header: X-GitHub-Api-Version: 2026-03-10
     ```
     If 200 → record `resolvedOrg: null` in `ctx.options`.

  3. **Both failed:** If all org probes returned 403/404 **and** the individual probe returned 403/404:
     - If `GET /user/memberships/orgs` found at least one org → `NOT_FOUND` with message: `"This GitHub token does not have the required permissions to access Copilot billing data. For org-licensed Copilot, your token needs 'repo' scope and the account must be an org admin or billing manager."`
     - If no orgs were found → `NOT_FOUND` with message: `"No GitHub organization memberships found and the individual billing endpoint returned 403/404. Ensure you have an active Copilot plan (individual or org) and that the token has the required scopes."`

  **Either org or individual 200 → `{ valid: true }`**

  **Token scope notes (updated):**
  - Org endpoint: classic PAT with `repo` scope (recommended) or `admin:org`; caller must be org admin or billing manager.
  - Individual endpoint: classic PAT with `user` scope; user must have a self-purchased Copilot plan (Free/Pro/Pro+/Max).
  - `GET /user/memberships/orgs` requires only that the PAT is authenticated (no extra scope); it enumerates orgs the authenticated user belongs to.
  - Fine-grained PATs are **not** supported by the billing endpoints.
  - `orgSlug` is **not** a supported `ctx.options` field and must not be referenced anywhere in this adapter.

  **`run` endpoint resolution:** During `run`, read `ctx.options.resolvedOrg`. If non-null, use the org billing endpoint for that org login. If null, use the individual endpoint. If `ctx.options.resolvedOrg` is absent (e.g., run called without a prior validate), repeat the org-discovery probe inline before fetching data.

---

## Fix 3 — §3.6: `COPILOT_DOWNGRADE_MAP` GPT regex format mismatch

**Section affected:** §3.6 Recommendation Engine — `R2_modelDowngrade.ts` `COPILOT_DOWNGRADE_MAP` constant

**What was wrong:** The `COPILOT_DOWNGRADE_MAP` GPT entries use hyphens as version separators (`gpt-5-4`, `gpt-5-5`) and are anchored with `$`. The GitHub Copilot billing API returns GPT model names with dots (`"gpt-5.4"`, `"gpt-5.5"`) as documented in the amendment's own §3.3.3 adapter schema comment (`model: string; // e.g. "claude-sonnet-4-6", "gpt-5.4", "gemini-3-5-flash"`). The regex `/^gpt-5-4$|^gpt-5-5$/i` can never match `"gpt-5.4"` — the literal dot does not match a hyphen. The `cheaper` string `'gpt-5-4-mini'` has the same format error. R2 never fires for any GPT premium model Copilot user.

---

### Corrected §3.6 — `COPILOT_DOWNGRADE_MAP` constant (full replacement)

**Format rules applied:**
- **GPT models:** version separator is a dot in the API response → use `\.` (escaped dot) in regex; drop trailing `$` anchor to match variant suffixes (e.g., `gpt-5.4-turbo`); apply dot format to `cheaper` strings.
- **Claude models:** hyphens throughout in API response → keep hyphens in patterns and `cheaper` strings (unchanged).
- **Gemini models:** hyphens throughout in API response → keep hyphens (unchanged).

```typescript
// Copilot model names are returned by the billing API as:
//   GPT:    "gpt-5.4", "gpt-5.5", "gpt-5.4-mini"  (dots as version separator)
//   Claude: "claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5", "claude-fable-5"  (hyphens)
//   Gemini: "gemini-3-1-pro-preview", "gemini-3-5-flash"  (hyphens)
// Patterns must match these formats exactly.
// Pricing rationale: docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing

const COPILOT_DOWNGRADE_MAP: Array<{ pattern: RegExp; cheaper: string; rationale: string }> = [
  {
    pattern:  /^claude-opus-4/i,
    cheaper:  'claude-haiku-4-5',
    rationale: '10–30x cheaper; suitable for straightforward Chat queries',
  },
  {
    pattern:  /^claude-sonnet-4/i,
    cheaper:  'claude-haiku-4-5',
    rationale: '3–5x cheaper; appropriate for most coding assistance tasks',
  },
  {
    // API returns "gpt-5.4" and "gpt-5.5" (dots, not hyphens).
    // Anchored $ removed: handles variants like "gpt-5.4-turbo", "gpt-5.5-turbo".
    // Two alternatives in one pattern — both map to the same cheaper model.
    pattern:  /^gpt-5\.4|^gpt-5\.5/i,
    cheaper:  'gpt-5.4-mini',
    rationale: '5–20x cheaper; equivalent quality for code completion and short queries',
  },
  {
    pattern:  /^gemini-3-1-pro/i,
    cheaper:  'gemini-3-5-flash',
    rationale: '4–8x cheaper; comparable quality for standard tasks',
  },
  {
    pattern:  /^claude-fable-5/i,
    cheaper:  'claude-sonnet-4-6',
    rationale: 'Significant cost reduction; Fable 5 reserved for complex multi-step tasks',
  },
];
```

**Changes from the original:**

| Entry | Was | Is now | Why |
|---|---|---|---|
| GPT pattern | `/^gpt-5-4$\|^gpt-5-5$/i` | `/^gpt-5\.4\|^gpt-5\.5/i` | API uses dots; `$` removed to handle variants |
| GPT `cheaper` | `'gpt-5-4-mini'` | `'gpt-5.4-mini'` | API uses dots for GPT version numbers |
| Claude patterns | `/^claude-opus-4/i`, `/^claude-sonnet-4/i`, `/^claude-fable-5/i` | unchanged | API uses hyphens for Claude ✓ |
| Gemini pattern | `/^gemini-3-1-pro/i` | unchanged | API uses hyphens for Gemini ✓ |
| Claude `cheaper` strings | `'claude-haiku-4-5'`, `'claude-sonnet-4-6'` | unchanged | Hyphens correct for Claude ✓ |
| Gemini `cheaper` | `'gemini-3-5-flash'` | unchanged | Hyphens correct for Gemini ✓ |

---

## Summary of affected sections

| Fix | Sections changed | Nature |
|---|---|---|
| Fix 1 (R4 data gap) | §3.3.5 steps 4 & 4a & 7 · §3.5 row 7.15a · §5 `NormalizedSourceData` + `SourceMetrics` · §3.6 `R4_offPeak.ts` | Additive: new field + computation + rule implementation |
| Fix 2 (Copilot probe order) | §3.3.3 validate step | Replacement: org-first auto-discovery, `orgSlug` gate removed |
| Fix 3 (COPILOT_DOWNGRADE_MAP) | §3.6 `COPILOT_DOWNGRADE_MAP` constant | In-place correction: GPT patterns and `cheaper` string format |

---

Amendment v1.1 is complete when these three errata are applied. Ready for design-review.