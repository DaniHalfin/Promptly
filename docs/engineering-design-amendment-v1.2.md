# Design Amendment v1.2 — GitHub Copilot Adapter: Credential-Based API → Local JSONL File

**Date:** 2026-06-25
**Amendment to:** Promptly Design Document (last amended v1.1)
**Scope:** GitHub Copilot adapter only. All other adapters, the analysis layer, the aggregation pipeline, and the frontend are unchanged.
**Driver:** Spec v1.7 §5 Source 4 — replaces PAT token → GitHub REST API approach with no-credential local JSONL file approach.

---

## 1. What's Deleted

### 1.1 Types removed from `server/src/types/index.ts`

These types modeled the REST API response surface. They have no equivalent in the new design and are fully removed.

```typescript
// DELETED
export interface NormalizedCopilotBillingItem { ... }
export interface NormalizedCopilotEngagement { ... }
```

All GitHub API response interfaces defined internally in the old `githubCopilot.ts` are also deleted with the file:

| Interface (internal) | Modeled |
|---|---|
| `GitHubOrgMembership` | `GET /user/memberships/orgs` response item |
| `GitHubCopilotUsageEntry` | `/{scope}/settings/billing/ai_credit/usage` item |
| `GitHubCopilotMetricsEntry` | `/orgs/{org}/copilot/metrics/reports/…` item |
| Any PAT validation shape | `GET /user` response |

### 1.2 Logic removed from `githubCopilot.ts`

The entire file is replaced. The following function bodies are gone:

- PAT header construction and `Octokit` / `fetch` usage
- `GET /user` validation call
- `GET /user/memberships/orgs` org discovery
- Billing access probe (org-scope vs. user-scope fallback)
- `/{org|user}/settings/billing/ai_credit/usage` pagination loop
- `/orgs/{org}/copilot/metrics/reports/organization-1-day` fetch
- `NormalizedCopilotBillingItem[]` + `NormalizedCopilotEngagement[]` construction

### 1.3 Connection config removed

The old adapter accepted `{ token: string }` in `AdapterContext.config`. The new adapter accepts `{}` (no config); connection is auto-detected from the filesystem.

---

## 2. New Types

### 2.1 Raw JSONL event types

These represent the on-disk data as parsed from `events.jsonl`. Live in `server/src/adapters/githubCopilot.ts` (adapter-private; not exported).

```typescript
/** Per-model entry inside a session.shutdown event's modelMetrics map */
interface CopilotModelMetrics {
  requests: {
    count: number;      // number of requests to this model in the session
    cost: number;       // premium request AI credit cost (USD float)
  };
  usage: {
    inputTokens: number;       // TOTAL prompt tokens (cache tokens are subsets, not additive)
    outputTokens: number;      // TOTAL completion tokens (reasoningTokens is a subset)
    cacheReadTokens: number;   // subset of inputTokens
    cacheWriteTokens: number;  // subset of inputTokens
    reasoningTokens: number;   // subset of outputTokens
  };
}

/** A parsed session.shutdown event from events.jsonl */
interface CopilotShutdownEvent {
  sessionStartTime: number;                          // Unix ms
  modelMetrics?: Record<string, CopilotModelMetrics>;
  totalPremiumRequests: number;                      // float AI credit cost (cross-check)
}
```

### 2.2 Normalized session type

Exported from `server/src/types/index.ts`. Replaces `NormalizedCopilotBillingItem` and `NormalizedCopilotEngagement`.

```typescript
export interface NormalizedCopilotSession {
  /** ISO date string (local machine timezone), e.g. "2026-06-25" — bucketing key */
  date: string;

  /** Source file path for diagnostics, e.g. ".../session-state/abc123/events.jsonl" */
  sourceFile: string;

  /** Per-model aggregated metrics for this session */
  models: Record<string, {
    requestCount: number;
    requestCost: number;       // USD AI credit cost
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
  }>;

  /** Cross-check value from totalPremiumRequests field */
  totalCost: number;
}
```

### 2.3 `NormalizedSourceData` delta

In `server/src/types/index.ts`, replace the two old Copilot fields with one new field:

```typescript
// BEFORE
export interface NormalizedSourceData {
  copilotBillingItems: NormalizedCopilotBillingItem[];
  copilotEngagement: NormalizedCopilotEngagement[];
}

// AFTER
export interface NormalizedSourceData {
  copilotSessions: NormalizedCopilotSession[];
}
```

All other fields on `NormalizedSourceData` are unchanged.

---

## 3. Adapter Design

### 3.1 Directory layout

```
server/src/adapters/
  githubCopilot.ts   ← full replacement (same filename, new implementation)
  claudeCode.ts      ← reference implementation; structural template
  types.ts           ← SourceAdapter, AdapterContext, AdapterResult (no changes)
```

### 3.2 Path resolution

```typescript
const SESSION_STATE_ROOT = path.join(os.homedir(), '.copilot', 'session-state');
// Never use literal ~/ or process.env.HOME directly — always os.homedir()
```

### 3.3 `validate()` — filesystem probe, no network

```
validate(context: AdapterContext): Promise<AdapterValidationResult>

  root = path.join(os.homedir(), '.copilot', 'session-state')
  
  if root does not exist (fs.access fails):
    return { valid: false, error:
      "No Copilot session data found. Have you run GitHub Copilot at least once?" }
  
  return { valid: true }
```

### 3.4 `run()` — JSONL enumeration and aggregation

```
run(context: AdapterContext): Promise<AdapterResult>

  Phase 1: Discover session directories
    subdirs = fs.readdirSync(SESSION_STATE_ROOT, { withFileTypes: true })
               .filter(d => d.isDirectory())
    if empty: return { copilotSessions: [] }

  Phase 2: Read and parse each events.jsonl
    for each subdir:
      filePath = path.join(SESSION_STATE_ROOT, subdir.name, 'events.jsonl')
      if not exists: skip
      
      lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
      
      for each line:
        try:
          event = JSON.parse(line)
          if event.type !== 'session.shutdown': continue
          
          date = toLocalDateString(event.sessionStartTime)
          if outside analysis window: continue
          
          sessions.push(buildNormalizedSession(event, date, filePath))
        catch:
          malformedFiles.push(filePath) // deduplicated; one warning per file

  Phase 3: Emit warnings
    if malformedFiles.length > 0:
      emit: "One or more Copilot session files could not be fully parsed.
             Sessions with malformed events are skipped; all valid
             session.shutdown events are still included."

  Phase 4: Empty-period check
    if sessions empty AND subdirs existed:
      return warning: "No Copilot session data found for the selected period.
                       Try a wider date range."

  Phase 5: Return
    return { data: { copilotSessions }, metadata: { sessionCount, totalCost, dateRange } }
```

### 3.5 `buildNormalizedSession()` — model metrics extraction

```
if event.modelMetrics absent/empty:
  return { date, sourceFile, models: {}, totalCost: event.totalPremiumRequests ?? 0 }

for each [modelName, metrics] of modelMetrics:
  models[modelName] = {
    requestCount, requestCost,
    inputTokens, outputTokens,
    cacheReadTokens, cacheWriteTokens, reasoningTokens
  }

return { date, sourceFile, models, totalCost: event.totalPremiumRequests ?? 0 }
```

### 3.6 Token semantics (code comments)

| Field | Semantic |
|---|---|
| `inputTokens` | Total prompt tokens. `cacheReadTokens` + `cacheWriteTokens` are **subsets**, not added on top. |
| `outputTokens` | Total completion tokens. `reasoningTokens` is a **subset**, not added on top. |
| `requestCost` | AI credit units (float). Not an integer request count. |
| `totalCost` | Cross-check vs sum of `requestCost` across models. Both preserved for analysis layer. |

### 3.7 Data flow

```
AdapterContext (no config)
  → validate: probe SESSION_STATE_ROOT
    → not found: valid=false + error message
    → found: valid=true
  → run: readdirSync SESSION_STATE_ROOT
    → for each subdir: read events.jsonl
      → parse lines → filter session.shutdown → buildNormalizedSession
      → parse errors → malformed file warning
    → NormalizedCopilotSession[]
    → AdapterResult: copilotSessions + metadata
```

---

## 4. What Stays the Same

- All other adapters (`claudeCode.ts`, `cursor.ts`, `windsurf.ts`, `zed.ts`, REST-based adapters)
- `SourceAdapter` interface — `validate()` / `run()` signatures in `types.ts`
- `AdapterContext` — `config` is simply empty `{}` (same as Claude Code)
- Analysis layer interface contract and all other source handlers
- Frontend display components
- `AdapterResult` envelope shape
- Date windowing logic — this adapter participates in the same union-of-ranges window

*Note: The analysis layer will need a new code path to consume `copilotSessions` instead of the two old arrays. This is a follow-on task scoped separately.*

---

## 5. File Changes Summary

| File | Change type | What changes |
|---|---|---|
| `server/src/adapters/githubCopilot.ts` | **Full replacement** | ~400-line PAT/REST implementation deleted. New JSONL local-file implementation ~150 lines. |
| `server/src/types/index.ts` | **Edit** | Delete `NormalizedCopilotBillingItem`, `NormalizedCopilotEngagement`. Add `NormalizedCopilotSession`. Update `NormalizedSourceData`. |
| `server/src/adapters/claudeCode.ts` | **No change** | Reference only. |
| `server/src/adapters/types.ts` | **No change** | Unchanged. |
| Analysis layer (path TBD) | **Follow-on task** | Consume `copilotSessions` instead of old arrays. |
