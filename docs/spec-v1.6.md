---
title: promptly-product-spec-v1-7
source: spec-draft
source_type: sub-agent
tags: [spec, promptly, product, v1.7]
created_at: 2026-06-24T00:48:50.086Z
---
# Promptly Product Spec
**Version:** 1.7 *(file: spec-v1.6.md)*
**Date:** 2026-06-24
**Author:** spec-draft agent
**Stakeholder:** Dani Halfin, Principal PM, Microsoft
**Status:** Draft

---

## Table of Contents

1. Overview and Problem Statement
2. Goals and Non-Goals
3. User Personas
4. User Journey and Flow
5. Data Sources and Connection Model
6. Verbosity Tier Engine
7. Analysis and Insight Definitions
8. Recommendation Engine
9. Privacy and Security Model
10. Export Spec
11. Tech Stack and Architecture Overview
12. Out of Scope for MVP
13. Open Questions

---

## 1. Overview and Problem Statement

### What problem this solves

Developers and product managers who use AI tools daily have no easy way to answer three practical questions:

1. How many tokens am I actually consuming, across which tools, and on which models?
2. Am I spending my tokens efficiently, or am I leaving obvious savings on the table?
3. Which specific behaviors (long contexts, expensive model choices, verbose outputs) are the biggest drivers of my usage?

Native provider dashboards (OpenAI Usage, Anthropic Console) show raw numbers with minimal analysis. Third-party observability platforms (Helicone, Langfuse, LangSmith) require proxying or instrumenting code before generating any history; they cannot retroactively analyze the usage data you already have. The result is a gap: personal AI users have data they cannot see and questions they cannot answer.

### What Promptly does

Promptly is a **one-time analysis tool** that aggregates a user's existing AI usage data from up to four P0 sources, classifies it by the quality of data available, and produces a concrete set of insights and optimization recommendations. It runs entirely on the user's local machine. Data never leaves the machine. When the browser tab closes, everything is gone.

The core frame is **token economy**: how efficiently are you allocating your token budget? All four P0 MVP sources provide actual dollar costs. OpenAI and Anthropic return costs directly from their provider billing APIs. Claude Code computes cost locally from token counts × model price using the LiteLLM price map — no provider API call is made. GitHub Copilot reads per-model cost directly from local session event files. Provider billing data is only used for OpenAI and Anthropic. For future P1 sources — flat-subscription web tools and file exports where no per-token billing exists — the tool will show **relative cost estimates** derived from the LiteLLM model price map and token count estimates.

### What makes it different

| Dimension | Native dashboards | Observability platforms | Promptly |
|---|---|---|---|
| Requires code instrumentation | No | Yes | No |
| Works retroactively on existing data | Yes | No | Yes |
| Aggregates across providers | No | Sometimes | Yes |
| Shows optimization recommendations | Minimal | Yes (Tier A only) | Yes (all tiers) |
| Requires cloud account / SaaS signup | No | Yes | No |
| Data leaves your machine | Yes (to provider) | Yes (to vendor) | Never |


---

## 2. Goals and Non-Goals

### Goals (MVP)

- **G1.** A user can connect any combination of the supported P0 data sources in a single session and see a unified analysis.
- **G2.** Every connected source always shows at least one non-empty insight, regardless of data quality.
- **G3.** The tool shows absolute dollar costs where provider APIs supply them, and relative cost comparisons where they do not.
- **G4.** The tool surfaces 4 categories of optimization recommendations, each with a clear trigger condition.
- **G5.** The user can export their full analysis as a PDF report and/or a structured JSON file.
- **G6.** No user data is retained after the session ends; no account required.
- **G7.** The codebase is publishable on GitHub as a clone-and-run tool requiring only two commands: `npm install` and `npm start`.
- **G8 — No one-way doors:** No existing adapter, route, or schema change is required to add a persistence layer or multi-user support in a future release.

### Non-Goals (MVP)

- **NG1.** Team-level or organization-level analysis. This is a personal tool.
- **NG2.** Real-time or streaming analysis. Promptly analyzes a static snapshot taken at session start.
- **NG3.** Proxy-based or SDK-based ingestion of live traffic.
- **NG4.** Any form of user accounts, authentication, or session persistence.
- **NG5.** Support for Azure OpenAI, Google Vertex/Gemini, AWS Bedrock, Mistral, Cohere, or any provider not in the four P0 sources. P1 sources (ChatGPT web export, Claude.ai web export, Cursor) are planned but not MVP.
- **NG6.** Prompt or completion content analysis. Promptly never reads, stores, or surfaces the text of prompts or responses.
- **NG7.** Cost forecasting or budget alerting as interactive features (summary stats only in export).
- **NG8.** PII detection or redaction (no content ingestion means no content to scrub).
- **NG9.** Mobile or tablet UI optimization.

---

## 3. User Personas

### Developer Danny

**Role:** Full-stack developer at a mid-size startup
**AI tools in use:** OpenAI API (production app), ChatGPT (personal productivity), GitHub Copilot (daily coding)
**Mental model:** Thinks in token costs and model tiers; knows `gpt-4o` is more expensive than `gpt-4o-mini` but has never quantified the split in his own usage
**Pain:** His OpenAI bill came in higher than expected this month. He suspects one feature is over-using the frontier model but has no way to confirm without instrumenting code. He also wonders if his long ChatGPT conversations are inflating his personal usage.

**Scenario:** Danny clones Promptly, runs `npm install && npm start`, opens the browser, pastes his OpenAI Admin key. Promptly also reads his local Claude Code session data from `~/.claude/projects/` and his GitHub Copilot session data from `~/.copilot/session-state/` automatically — no credentials required for either. In under five minutes he sees: (a) his OpenAI model split by token cost, (b) that 3 API keys account for 70% of his spend, (c) that his Claude Code sessions show consistently high input token counts — triggering a Reduce Prompt Verbosity recommendation, and (d) that switching the identified high-volume, low-output API calls to `gpt-4o-mini` could reduce his API spend by an estimated 40-60%. He exports a PDF, closes the tab, and his data is gone.

### PM Parker

**Role:** Product manager at a tech company
**AI tools in use:** Claude (via Anthropic API for a personal side project), Claude.ai (conversation history exportable), ChatGPT (daily use)
**Mental model:** Thinks in workflow outcomes, not model names; does not distinguish between input and output tokens; has vague intuition that AI costs "could be optimized" but no concrete data
**Pain:** Parker wants to understand whether the Anthropic API spending on her side project is proportionate to the value she is getting. She also wants to see whether Claude.ai versus the API is costing her more per "conversation" on a relative basis.

**Scenario:** Parker runs Promptly, connects her Anthropic Admin key. Promptly also reads her Claude Code session data automatically from `~/.claude/projects/`. Both Anthropic API and Claude Code are classified as Tier B (tokens + cost available). She sees absolute dollar costs for both sources broken down by model and day. The tool surfaces a Reduce Prompt Verbosity recommendation — her Anthropic API input token p90 exceeds the high-input threshold. She exports a JSON file to share with a developer friend who will implement the changes.

---

## 4. User Journey and Flow

### Step-by-step flow

**Step 1: Landing page**
User arrives at `http://localhost:5173` (Vite default port). The page shows:
- One-sentence description of what Promptly does
- A privacy notice: "All analysis runs locally. Nothing is sent to any server other than the AI providers you explicitly connect to."
- A "Connect sources" section with cards for each of the 4 supported sources
- A "Start analysis" button (disabled until at least one source is ready). For local-file sources (Claude Code, GitHub Copilot), 'ready' is reached automatically when the validation check passes after the user enables the card.

**Step 2: Source connection**
The user can connect any combination of sources in any order. Each source card has its own connection UI:

| Source | Connection method | Input field(s) |
|---|---|---|
| Claude Code | Local file read (auto) | No input required; Promptly reads session JSONL files under `~/.claude/projects/` (or `$CLAUDE_CONFIG_DIR/projects/` if set) when the card is enabled |
| OpenAI | API key entry | Admin API key (text input, masked) + date range picker (default: last 30 days) |
| Anthropic | API key entry | Admin API key (text input, masked) + date range picker (default: last 30 days) |
| GitHub Copilot | Local file read (auto) | No input required; Promptly reads session events from `~/.copilot/session-state/` (Windows: `C:\Users\<user>\.copilot\session-state\`) automatically when the card is enabled |

When only local-file sources (Claude Code and/or GitHub Copilot) are enabled and no API-key sources are configured, a global date range picker (default: last 30 days) is displayed at the top of the connection step and applies to all local-file sources. This picker is hidden when at least one API-key source is configured, as the API sources carry their own per-card date range pickers that govern the analysis window. If multiple API sources are connected with different date ranges, all local-file sources (Claude Code and GitHub Copilot) use the union of those ranges (earliest start date to latest end date).

Each card shows a status indicator: unconfigured / configured / fetching / ready / error. Configured API keys are stored only in JavaScript memory (the `window` object in the frontend); they are not written to `localStorage`, `sessionStorage`, cookies, or any other persistent store. The backend receives the key as a request header on each call and does not store it. GitHub Copilot requires no credentials — it reads from the local filesystem only.

**Step 3: Validation**
When a source is configured, the frontend immediately sends a lightweight validation request through the local Express server to the provider API to confirm the key is valid and has the required permissions. Status updates on the card:
- Green checkmark + "Connected: [N] days of data available" (where the API reveals this)
- Successful validation (green checkmark) moves the source card to the **'ready'** state. This applies to API-key sources (OpenAI, Anthropic) identically to the automatic 'ready' transition for local-file sources described in Step 1.
- Red X + human-readable error message (e.g., "This key does not have Admin permissions. Org-level admin keys are required for usage data.")

For Claude Code, the validation step checks that the `~/.claude/projects/` directory (or `$CLAUDE_CONFIG_DIR/projects/` if set) exists and contains at least one JSONL session file. If the directory is missing or empty, the card displays: "No Claude Code data found. Have you run Claude Code at least once?"

For GitHub Copilot, the validation step checks that `~/.copilot/session-state/` (Windows: `C:\Users\<user>\.copilot\session-state\`) exists and contains at least one parseable `session.shutdown` event.

- If the directory is missing: card displays "No Copilot session data found. Have you run GitHub Copilot at least once?"
- If the directory exists but contains no parseable `session.shutdown` events in the selected period: card displays "No Copilot session data found for the selected period. Try a wider date range."

**Step 4: Run analysis**
User clicks "Start analysis." The frontend disables the button and shows a per-source progress indicator. The analysis runs as **one HTTP request per connected source** (not a single combined request), so the frontend can update each source card's progress indicator independently as each request resolves (status indicators update progressively; result panels render after all sources settle):

1. The frontend sends one `POST /analyze/{sourceId}` request per connected source, in parallel.
2. As each response arrives, the corresponding source card updates from "fetching" to "ready" (or "error").
3. After all source requests settle, the frontend sends one `POST /analyze/recommendations` with the combined metrics from all sources to compute cross-source recommendations.

Each `/analyze/{sourceId}` request body includes the credentials for that source and any relevant options (date range). Each response returns the metrics for that source only.

Estimated total analysis time: under 30 seconds for typical personal usage volumes. Individual source results may appear in 3-10 seconds each.

**Step 5: Results dashboard**
The results page has:
- A top-level summary bar: total actual AI spend (actual USD from all Tier B sources, shown together), total tokens consumed, analysis time window, and sources connected
- Per-source insight panels (see Section 7 for content)
- A "Recommendations" section (see Section 8)
- An "Export" section with "Download PDF" and "Download JSON" buttons

**Step 6: Export and session end**
User clicks export buttons to download files to local disk. When the user closes the browser tab, refreshes, or navigates away, the JavaScript memory is cleared. The Express server process retains no state. The only persistence is any file the user explicitly exported.

**Error states**
- If a source fails during analysis (network timeout, rate limit, bad key), the tool shows an inline error for that source and continues with all other sources. It does not fail the entire session.
- If zero sources succeed, the analysis result page is not shown; the user is returned to the connection step with error messages.

---

## 5. Data Sources and Connection Model

**Design principle:** Promptly is a *reader, not a collector*. It reads data that already exists from tools users are already running. It starts no background processes, installs no agents, and has no ongoing dependency on third-party services.

### P0 MVP Sources

| Tool | Access Method | Data Available |
|---|---|---|
| **Claude Code** (Anthropic CLI) | Local file read (`~/.claude/projects/<encoded-project-path>/<sessionId>.jsonl`) | Token counts per message (JSONL format), model, per-session — cost computed from tokens × model price; no auth required |
| **OpenAI API** (direct API users) | One-time API call (`GET /v1/usage`) | Daily tokens by model, costs — needs API key |
| **Anthropic API** (direct API users) | One-time API call (`GET /v1/usage`) | Daily tokens by model, workspace-level costs — needs admin key |
| **GitHub Copilot** (Chat, CLI, cloud agent, Spaces) | Local file read (`~/.copilot/session-state/*/events.jsonl`) | Token counts per model (input/output/cache-read/cache-write/reasoning), premium request cost per session — no credentials required |

### P1 Sources (future releases)

| Tool | Access Method | Limitation |
|---|---|---|
| **ChatGPT** (web) | Account export (Settings → Data Export) | Conversation JSON only — no token counts, no billing data (flat subscription model) |
| **Claude.ai** (web) | Account export | Same limitation — no metered billing for web users |
| **Cursor** | Local SQLite DB (unverified path) | No documented export path; needs investigation |

### Future Scope (not in roadmap yet)

- **LiteLLM** — rich PostgreSQL telemetry store, but requires ongoing/scheduled read access; not a one-time export
- **Helicone** — rich ClickHouse + MinIO store, same constraint
- **Azure OpenAI** — Azure Cost Management API, org-level only, requires enterprise access
- **Amazon Bedrock** — AWS Cost Explorer API, same constraint
- **Windsurf / Codeium** — no known local data or export path

### Source 1: Claude Code (Anthropic CLI)

**Connection:** Local filesystem read — no credentials or authentication required.

**Files read:**
- `~/.claude/projects/<encoded-project-path>/<sessionId>.jsonl`: per-session JSONL transcripts containing per-message token counts (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`) and model information. If `CLAUDE_CONFIG_DIR` is set in the user's environment, the base path is `$CLAUDE_CONFIG_DIR/projects/` instead of `~/.claude/projects/`.

**Data returned:**
- Tokens: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` per model
- Cost: computed from token counts × model price (using the LiteLLM price map); cost is not stored directly in the session files

Cost formula (per session message):
`cost = (input_tokens × input_cost_per_token)
      + (cache_creation_input_tokens × cache_creation_input_token_cost)
      + (cache_read_input_tokens × cache_read_input_token_cost)
      + (output_tokens × output_cost_per_token)`

All four price fields are sourced from the LiteLLM price map (see §11) keyed by model name. If `cache_creation_input_token_cost` is absent for a model, fall back to `input_cost_per_token` (slight underestimate). If `cache_read_input_token_cost` is absent, fall back to `input_cost_per_token`.
- Model names: as reported by the CLI
- Timestamps: session start time
- **Note:** Session timestamps (Unix milliseconds) are stored in UTC. For daily bucketing, display dates, and R4 peak-hours classification, timestamps are converted to local machine timezone at display time, consistent with the timezone model in §5 Source 4.

**Tier classification:** Tier B (actual token counts + actual cost, per model, no prompt content)

**Assumptions:**
- ASSUMPTION: The JSONL session transcript format is stable across Claude Code CLI versions. If the schema changes, the adapter must be updated. OQ-10 is resolved; see §13.
- ASSUMPTION: The path `~/.claude/projects/` is the default base path. If `CLAUDE_CONFIG_DIR` is set in the user's environment, the adapter uses `$CLAUDE_CONFIG_DIR/projects/` instead. Users with non-standard paths must be given a config option.
- ASSUMPTION: When API-key sources are also connected, the Claude Code adapter uses the same analysis window as the connected API sources. If multiple API sources have different date ranges, Claude Code uses the union of those ranges (earliest start date to latest end date), matching the behaviour defined for GitHub Copilot in §5 Source 4.

**Error states:**
- `~/.claude/projects/` does not exist (or `$CLAUDE_CONFIG_DIR/projects/` if set): "No Claude Code data found. Have you run Claude Code at least once?"
- A session JSONL file is malformed or unreadable: "One or more Claude Code session files could not be parsed — they may be from an unsupported version. Parseable sessions are still included."

---

### Source 2: OpenAI

**Connection:** Admin API key entered in the frontend UI. The local Express server uses this key (passed as `Authorization: Bearer <key>` on each request) to call OpenAI's organization-level APIs.

**APIs called:**
- `GET /v1/organization/usage/completions`: returns bucketed (1-day) input token, output token, and cached input token counts, grouped by `model`. Pagination via `next_page` cursor.
- `GET /v1/organization/costs`: returns dollar costs bucketed by day. Pagination via `next_page` cursor.

**Data returned:**
- Tokens: `input_tokens`, `output_tokens`, `cached_input_tokens` (subset of `input_tokens` — already counted within it; provided for breakdown purposes only, do not add to token total) per model per day
- Cost: dollar amount per day (not per-model via the Costs API; model breakdown is from Usage API only)
- Time range: user-specified date range (default: last 30 days)
- Segmentation: model name

**Tier classification:** Tier B (tokens + model + cost, no per-request rows, no content)

**Assumptions:**
- ASSUMPTION: The user has an OpenAI Admin API key (not a standard project key). Standard keys do not have access to the organization usage or costs endpoints. The UI must explain this distinction and link to OpenAI's documentation for generating admin keys.
- ASSUMPTION: The Costs API returns organization-level daily totals. Per-model cost is estimated using a price-weighted approach: for each model, estimated cost = (input_tokens_m × input_cost_per_token_m) + (output_tokens_m × output_cost_per_token_m) using LiteLLM price map rates (§11); each model's share is its estimated cost as a fraction of total estimated cost across all models. See §7.6 for the authoritative formula.

**Known limitations:** No per-request rows. No user or API key segmentation without additional `group_by` parameters (out of scope for MVP). Costs API has ~minutes of lag; Usage API may have similar lag.

---

### Source 3: Anthropic

**Connection:** Anthropic Admin API key entered in the frontend UI. The local Express server uses this key (passed as `x-api-key` header) to call Anthropic's admin endpoints.

**APIs called:**
- `GET /v1/organization/usage_report/messages`: returns bucketed (1-day) token counts per model: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`.
- `GET /v1/organization/cost_report`: returns dollar costs per day. Pagination as needed.

**Data returned:**
- Tokens: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` per model per day
- Cost: dollar amount per day
- Time range: user-specified date range (default: last 30 days)
- Segmentation: model name

**Tier classification:** Tier B (tokens + model + cost, no per-request rows, no content)

**Assumptions:**
- ASSUMPTION: The user has an Anthropic Admin API key. Same friction as OpenAI; standard keys lack access to these endpoints. UI must explain this.
- ASSUMPTION: Anthropic cost reports are daily-bucketed and may not align model-level token data directly with dollar totals. The same price-weighted estimated cost method used for OpenAI applies. For Anthropic, `input_tokens` from the Usage API is the standard-input-only count; `cache_creation_input_tokens` and `cache_read_input_tokens` are billed additively at separate rates (see §7.6 for the full Anthropic formula). See §7.6 for the authoritative formula.

**Unique feature:** Anthropic exposes `cache_creation_input_tokens` and `cache_read_input_tokens` separately. This enables a two-sided cost signal: `cache_read_input_tokens` indicates savings (reads are ~90% cheaper than standard input tokens), while `cache_creation_input_tokens` indicates write overhead (creation is ~25% more expensive than standard input tokens). The net effect depends on cache reuse — see §7.8 for realized savings and §8 R1 for projected savings.

---

### Source 4: GitHub Copilot

**Connection:** Auto-detected from `~/.copilot/session-state/` (Windows: `C:\Users\<user>\.copilot\session-state\`). No credentials required — same local-file pattern as Claude Code. The VS Code Copilot extension delegates to the embedded Copilot CLI; all session data lands in `~/.copilot`, not in VS Code's own storage.

**Tier classification:** Tier B (full token counts: input/output/cache-read/cache-write/reasoning per model, plus premium request cost per session)

**Files read:**
- `~/.copilot/session-state/*/events.jsonl` — one directory per session, each containing an `events.jsonl` file. The adapter reads all such files it can find under the session-state root.

**Event structure used:**
The adapter extracts only `session.shutdown` events. Each such event contains:
- `sessionStartTime` — Unix millisecond timestamp for the session start date
- `modelMetrics` — object keyed by model name (e.g. `gpt-5.4-mini`, `claude-opus-4.6-1m`), each entry containing:
  - `requests.count` — number of requests made to this model in the session
  - `requests.cost` — premium request AI credit cost for this model in the session (USD)
  - `usage.inputTokens`, `usage.outputTokens` — prompt and completion tokens
  - `usage.cacheReadTokens`, `usage.cacheWriteTokens` — cache read and write tokens
  - `usage.reasoningTokens` — reasoning tokens (where applicable)
- `totalPremiumRequests` — total AI credit cost for the entire session (USD); used as a cross-check against summed `requests.cost` per model. Note: despite the name, this field is a float cost metric (AI credit units), not an integer request count. It equals `sum(requests.cost)` across all models in the session and is used as a cross-check against that sum.

**Data returned:**
- Per-model token breakdown (input/output/cache-read/cache-write/reasoning), aggregated daily from session timestamps
- Per-model request count and premium request cost, aggregated daily
- Total session count and total cost over the analysis period
- All data is from the local machine only; no org-wide or cross-user data is included

**Known limitations / scope:**
- Only covers sessions run on this local machine. Does not include usage by other users or sessions from other machines.
- No engagement metrics (acceptance rate for code completions) — these are not present in `events.jsonl`. Acceptance rate is removed from Copilot scope.
- `requests.cost` reflects premium request AI credit billing only (Chat, CLI, cloud agent, Spaces). Code completions (which are unlimited on paid plans) are not tracked in these events and do not appear in any cost total.

**Assumptions:**
- ASSUMPTION: The `~/.copilot/session-state/` directory exists and is readable. If the directory is missing: the card displays "No Copilot session data found. Have you run GitHub Copilot at least once?" If the directory exists but contains no parseable `session.shutdown` events within the selected analysis period: the card displays "No Copilot session data found for the selected period. Try a wider date range."
- ASSUMPTION: The adapter enumerates all subdirectories under `~/.copilot/session-state/`, reads each `events.jsonl` file, and filters for `session.shutdown` events. Events other than `session.shutdown` are skipped. Malformed lines are skipped with a warning. User-facing error string: "One or more Copilot session files could not be fully parsed. Sessions with malformed events are skipped; all valid session.shutdown events are still included."
- ASSUMPTION: If `modelMetrics` is absent or empty in a `session.shutdown` event, the session contributes only to session count and not to token or cost aggregates.
- ASSUMPTION: `sessionStartTime` is a Unix millisecond timestamp. The adapter converts it to a calendar date for daily bucketing. The adapter converts `sessionStartTime` to the local machine timezone for daily bucketing and all time-of-day classifications. Unix millisecond timestamps are stored and processed in UTC. For daily bucketing and all time-of-day classifications (§7, §8), timestamps are converted from UTC to the local machine timezone at display time (Node.js `Intl`/`Date` local timezone). For API sources (OpenAI, Anthropic), calendar-day boundaries are as returned by the provider API (UTC-based) and are converted to local machine timezone for display.
- ASSUMPTION: The analysis period for GitHub Copilot defaults to the last 30 calendar days from the current date, matching the API source default. Sessions whose `sessionStartTime` predates this window are ignored.
- The Copilot adapter uses the same analysis window as any connected API sources. When only local-file sources are connected, a global date range picker (default: last 30 days) is displayed at the top of the connection step and applies to all local-file sources.
- If multiple API sources are connected with different date ranges, Copilot uses the union of those ranges (earliest start date to latest end date).
- ASSUMPTION: The adapter MUST resolve the home directory using `os.homedir()` (Node.js built-in, cross-platform). The base path is `path.join(os.homedir(), '.copilot', 'session-state')`. Literal `~/` paths must not be passed to file system calls.
- ASSUMPTION: `usage.reasoningTokens` is a subset of `usage.outputTokens` (already counted therein) and is not additive. If this assumption is incorrect, §7.2's Copilot formula must be updated to add `reasoningTokens` additively.
- VERIFIED: `usage.inputTokens` is the TOTAL prompt token count — it includes all input tokens (cached and uncached). `cacheReadTokens` and `cacheWriteTokens` are subsets of `inputTokens`, not additive fields. This mirrors OpenAI's model, not Anthropic's. Confirmed empirically from real session file data: `inputTokens` (221,203) = `tokenDetails.input.tokenCount` (46,611, non-cached residual) + `cacheReadTokens` (174,592). The session file also contains a separate `tokenDetails` object with `input.tokenCount` (non-cached only) and `cache_read.tokenCount` for implementers who need the breakdown.

---

## 6. Verbosity Tier Engine

### Tier definitions

| Tier | Name | Data available | Sources that map to this tier |
|---|---|---|---|
| A | Full Trace | Per-request rows with prompt text, completion text, model, tokens, cost, latency | None in MVP (reserved for future proxy/SDK ingestion) |
| B | Token + Cost | Daily aggregates by model: tokens (input/output/cached), dollar cost | Claude Code (Anthropic CLI), OpenAI API, Anthropic API, GitHub Copilot |
| C | Aggregate / Estimated | Aggregate counts only or estimated output volumes | None in MVP — reserved for future P1 sources (ChatGPT export, Claude.ai export, Cursor) when they ship |

Tier A is defined in the system for architectural completeness but has no MVP data sources that produce it. Future adapter modules for proxy/SDK ingestion would map to Tier A.

### Tier detection

Tier detection is automatic and per-source. When a source is processed, the adapter assigns the tier based on what fields are present in the returned data:
- If `metrics.total_spend_usd` is non-null AND actual token fields (`input_tokens`, `output_tokens`) are non-null AND data is bucketed by day: Tier B
- For GitHub Copilot: if `~/.copilot/session-state/` exists and contains at least one `events.jsonl` file with a `session.shutdown` event that includes a non-empty `modelMetrics` object: Tier B
- If all token fields are estimated or only aggregate counts are available: Tier C
- If the adapter fails to fetch data (network error, invalid credentials, HTTP 4xx/5xx): the source is marked as `error` with a null tier. The source card displays the error message and is excluded from all metric aggregations. The tier column for this source in the export shows `null`.

The tier label is displayed on each source card in the results dashboard.

### What each tier unlocks (MVP insight set)

**Tier B unlocks:**
- Total spend (actual USD) for the analysis period
- Daily spend trend (line chart)
- Model cost breakdown (pie or bar chart: % of total spend per model)
- Input vs. output token ratio (per model and aggregate — all Tier B sources)
- Cached token fraction (Anthropic, Claude Code, and GitHub Copilot: see §7.8 and §7.19 for source-specific formulas)
- Average daily spend and 7-day rolling average
- Peak spend day
- All Tier B recommendations (see §8)
- Month-over-month spend change (when ≥45 days of data available) — §7.12
- Claude Code: session count and average tokens per session — §7.13–§7.14
- GitHub Copilot: total cost, token breakdown by model, per-model cost breakdown, cached token fraction, average tokens per session — §7.15–§7.19

**Tier C (no MVP sources — future P1 placeholder):**
Tier C is defined for completeness and future P1 sources. When a Tier C source is connected in a future release, it will unlock:
- Estimated total token volume for the period (using LiteLLM price map + model assumption)
- Relative cost estimates vs. other connected Tier B sources
- Tier C-specific recommendations

No MVP P0 source is classified as Tier C.

### Upgrade nudge system

The upgrade nudge system is defined for use with future Tier C sources. No P0 MVP source is classified as Tier C, so no nudge panels are active for MVP. When a future P1 source is connected at Tier C and a Tier B path exists, the nudge format is: "This data is at [Tier C: Estimated]. Connect [source_name] via its Admin API to see actual token counts and dollar costs." (Where `[source_name]` = the human-readable display name for the source, e.g., "OpenAI API", "Claude Code", "GitHub Copilot", as defined in §5's Source sections.)

The nudge does not suggest proxy/SDK instrumentation in MVP (that would be a Tier A nudge, reserved for post-MVP).

No source panel ever shows an empty state. If data is available but sparse (e.g., only 2 days in a 30-day window), the chart shows the 2 data points with a note: "Only [N] days of data available in this period." (Where `[N]` = count of calendar days with available data in the selected period.)

If a connected source returns zero events for the selected date range (source successfully connected with data available, but no usage events fall within the selected period), the panel displays: "No usage found for [source_name] between [start_date] and [end_date]. Try a different date range." (Where `[source_name]` = same human-readable display name as above; `[start_date]` and `[end_date]` = the start and end of the user-selected analysis period in `YYYY-MM-DD` format.) The source remains "connected" and is not counted as an error.


---

## 7. Analysis and Insight Definitions

All metrics are defined below with their formula and the minimum tier at which they apply.

### Cross-source metrics (aggregate, shown at top of results)

**7.1 Total token spend (USD)**
- Definition: Sum of actual dollar costs from all Tier B sources. For GitHub Copilot, cost is derived from `requests.cost` summed across all `modelMetrics` entries in `session.shutdown` events (covers Chat, CLI, cloud agent, and Spaces interactions only; code completions are not tracked in these events).
- Formula: `sum(tier_b_actual_cost_usd)` across all connected Tier B sources.
- Display: "Actual: $X.XX (from [source list])". The display notes which sources contributed.
- Tier: B

**7.2 Total tokens consumed**
- Definition: Sum of actual tokens across all sources that expose token-level data. All four P0 MVP sources report per-model token counts.
- Formula (provider-aware):
- **OpenAI:** `input_tokens + output_tokens` — `cached_input_tokens` is a subset of `input_tokens` and is already counted; do not add it separately.
- **Anthropic:** `input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens` — cache fields are additive buckets (not subsets of `input_tokens`). Source: Anthropic API, confirmed in official Anthropic SDK (`message.py`): *"Total input tokens in a request is the summation of `input_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens`."*
- **Claude Code:** Same formula as Anthropic: `input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens`.
- **GitHub Copilot:** `usage.inputTokens + usage.outputTokens` summed across all `modelMetrics` entries — `cacheReadTokens` and `cacheWriteTokens` are subsets of `inputTokens` (already counted). See §5 Source 4.
- Display: Shows actual token counts from all token-reporting sources.
- Tier: B

**7.3 Analysis period**
- Definition: Date range covered by the analysis, per source.
- Display: "Showing data from [start date] to [end date] for [N] sources."
- When sources have different date ranges, the displayed range is the union (earliest start date to latest end date). Individual source date ranges are shown on each source card.
- Tier: B and C

### OpenAI and Anthropic metrics (Tier B)

**7.4 Total spend (actual USD)**
- Definition: Sum of all dollar values returned by the Costs API over the analysis period. This figure is the true billed cost as reported by the provider.
- Formula: `sum(cost_usd_per_day)` over the selected date range.
- Display: Labeled as "Actual (from [provider] Costs API)." This is a daily aggregate total; it is NOT broken down by model. Per-model cost breakdown is estimated in §7.6.
- Tier: B

**7.5 Daily spend trend**
- Definition: Time series of daily cost in USD.
- Data source: Costs API daily buckets.
- Chart type: Line chart, x-axis = date, y-axis = USD.
- Tier: B

**7.6 Model cost share**
- Definition: For each model that appears in the Usage API data, its estimated percentage contribution to total spend.
- Formula:
  ```
  model_cost_estimate(m) = cost_estimate_input(m) + (output_tokens_m × output_cost_per_token_m)

  Where cost_estimate_input(m) is provider-dependent:
  - OpenAI: cost_estimate_input(m) = input_tokens_m × input_cost_per_token_m
    (input_tokens already includes cached tokens — do not add cached_input_tokens separately)
  - Anthropic: cost_estimate_input(m) = (input_tokens_m × input_cost_per_token_m)
                                       + (cache_creation_input_tokens_m × cache_creation_input_token_cost_m)
                                       + (cache_read_input_tokens_m × cache_read_input_token_cost_m)
    (three additive billing buckets at separate rates — see §7.2)
  - Claude Code: same as Anthropic (same SDK and billing model)
  - GitHub Copilot: the entire outer formula is replaced — **`model_cost_estimate(m) = requests.cost(m)`** (taken from `requests.cost` in the `modelMetrics` entry directly; this value is pre-computed by the provider and is inclusive of all token billing). The output term `(output_tokens_m × output_cost_per_token_m)` is NOT applied separately — it is already captured within `requests.cost`. Do not add the output term.

  model_cost_share(m) = model_cost_estimate(m) / Σ model_cost_estimate(x) for all models x
  (If the denominator `Σ model_cost_estimate(x)` is zero for all models in a source, `model_cost_share` is undefined for that source; see §7.18 for the Copilot-specific zero-guard and display behavior.)
  ```
  Where:
  - `input_tokens_m` and `output_tokens_m` are summed over the analysis period from the Usage API (for OpenAI), the Anthropic Usage Report API `/v1/organization/usage_report/messages` (for Anthropic), or Claude Code local session JSONL files under `~/.claude/projects/` (for Claude Code)
  - `cache_creation_input_tokens_m` and `cache_read_input_tokens_m` are summed over the analysis period from the Anthropic Usage Report API (for Anthropic) or Claude Code local session JSONL files under `~/.claude/projects/` (for Claude Code); these fields are not present for OpenAI or GitHub Copilot
  - `input_cost_per_token_m`, `output_cost_per_token_m`, `cache_creation_input_token_cost_m`, and `cache_read_input_token_cost_m` are from the LiteLLM price map (§11)
  - If the LiteLLM cache price fields are absent for a model, fall back to the two-term formula for that model and note the estimate excludes cache costs
- Note: This is a price-weighted estimated cost breakdown. For OpenAI and Anthropic/Claude Code, the chart is labeled "Estimated model cost breakdown." For GitHub Copilot, actual `requests.cost` values are used directly and the chart is labeled "Actual model cost breakdown."
- Chart type: Pie chart or stacked bar chart.
- Tier: B

**7.7 Input vs. output token ratio**
- Definition: Ratio of total input tokens to total output tokens, per model and in aggregate.
- Formula: `input_output_ratio = total_input_tokens / total_output_tokens`
- Why it matters: A high ratio (many input tokens relative to output) indicates large prompts with short completions, which is the pattern R3 (Reduce Prompt Verbosity) watches for. A low ratio (output tokens approaching or exceeding input tokens) indicates verbose model responses.
- **Note for Anthropic and Claude Code:** For this ratio, `total_input_tokens` = `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` (cache fields are additive — see §7.2). Using `input_tokens` alone would understate actual LLM input volume for sessions with active prompt caching.
- **Note for GitHub Copilot:** `usage.inputTokens` already includes all prompt tokens (cached and uncached). For this ratio, use `usage.inputTokens` directly — do not add `cacheReadTokens` or `cacheWriteTokens` separately, as they are already counted within `inputTokens`. See §5 Source 4.
- **Note for OpenAI:** use `input_tokens` as `total_input_tokens` directly — `cached_input_tokens` is already included in `input_tokens` and must not be added separately.
- Tier: B

**7.8 Cached token fraction (Anthropic and Claude Code)**
- Definition: Fraction of total input tokens that were served from the prompt cache.
- Formula (Anthropic): `cache_fraction_anthropic = cache_read_input_tokens / (input_tokens + cache_creation_input_tokens + cache_read_input_tokens)`
  - Data source: Anthropic Usage API
- Formula (Claude Code): `cache_fraction_claude_code = cache_read_input_tokens / (input_tokens + cache_creation_input_tokens + cache_read_input_tokens)`
  - Data source: Claude Code local session files (`~/.claude/`)
- When both Anthropic and Claude Code are connected, the system computes `cache_fraction_anthropic` and `cache_fraction_claude_code` independently and displays each on its respective source card.
- Why it matters: Cache reads are cheaper than standard input tokens. A low cache fraction on a high-volume source indicates a missed prompt-caching opportunity.
- For GitHub Copilot cached token fraction, see §7.19.
- Realized savings formula (backward-looking): `savings_[source] = cache_read_input_tokens_[source] * (standard_input_price_[source] - cache_read_price_[source])` where `[source]` ∈ {`anthropic`, `claude_code`} matching the source whose data is used; `cache_read_input_tokens_[source]` = sum of `cache_read_input_tokens` from the respective source's data, `standard_input_price_[source]` = `input_cost_per_token` and `cache_read_price_[source]` = `cache_read_input_token_cost` from the LiteLLM price map.

  **Note:** `standard_input_price_[source]` and `cache_read_price_[source]` are source-aggregate aliases (token-volume-weighted average across models for that source):

  `standard_input_price_[source] = sum(cache_read_input_tokens_m * input_cost_per_token_m) / sum(cache_read_input_tokens_m)`

  `cache_read_price_[source] = sum(cache_read_input_tokens_m * cache_read_input_token_cost_m) / sum(cache_read_input_tokens_m)`

  If `sum(cache_read_input_tokens_m) == 0` for the source, set `savings_[source] = 0` and suppress the realized savings display for that source. For the authoritative per-model `_m` contract using the same LiteLLM fields, see §8 R1 Estimated savings formula. For forward-looking savings potential, see §8 R1.

  (Cache write overhead is not netted here — write costs are already sunk for tokens that have been cached. The forward-looking formula in §8 R1 nets write overhead because those costs have not yet been incurred.)
- Tier: B (Anthropic and Claude Code)

**7.9 Average daily spend**
- Definition: Mean of daily cost values over the analysis period.
- Formula: `avg_daily_spend = total_spend_usd / number_of_days_with_data`
- Tier: B

**7.10 Peak spend day**
- Definition: The calendar day with the highest single-day cost in the analysis period.
- Formula: `argmax(cost_usd_per_day)`
- Display: Date and amount.
- Tier: B

**7.11 7-day rolling average spend**
- Definition: Rolling average of daily cost over the last 7 days of the analysis period.
- Formula: `avg(cost_usd_per_day[last_7_days])`
- Tier: B

**7.12 Month-over-month spend change**
- Definition: Percentage change in spend from the prior 30-day period to the current 30-day period, if sufficient data exists.
- Formula: `MoM_change = (current_30d_spend - prior_30d_spend) / prior_30d_spend * 100`
- Only shown if the analysis period covers at least 45 days.
- Tier: B

**7.12a Average daily output tokens per model (derived)**
- Definition: Average output tokens per calendar day for a given model, over the analysis period. Used by the R2 recommendation trigger.
- Formula: `output_tokens_per_day(model) = sum(output_tokens_for_model) / number_of_days_with_data`
- This is a derived value computed during recommendation evaluation; it is not displayed directly in the UI.
- Tier: B

### Claude Code metrics (Tier B)

Note: Cached token fraction for Claude Code is defined in §7.8 (alongside the Anthropic formula). The section header "OpenAI and Anthropic metrics" does not restrict §7.8's scope — it covers both Anthropic and Claude Code sources.

**7.13 Session count**
- Definition: Number of distinct Claude Code sessions recorded in the local data files.
- Formula: `count(sessions)` across all project directories under `~/.claude/projects/`
- Display: "N sessions analyzed"
- Tier: B

**7.14 Average tokens per session**
- Definition: Mean total tokens (input + output) per Claude Code session over the analysis period.
- Formula: `avg((input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens) per session)` — cache fields are additive for Claude Code (see §7.2).
- Display: "~N tokens per session (average)"
- Tier: B

### GitHub Copilot metrics (Tier B)

**7.15 Copilot session count**
- Definition: Number of distinct Copilot sessions found in `~/.copilot/session-state/` that contain a `session.shutdown` event with non-empty `modelMetrics`.
- Formula: `count(sessions with valid session.shutdown events)` across all subdirectories under the session-state root.
- Display: "N sessions analyzed"
- Tier: B

**7.16 Copilot token breakdown by model**
- Definition: Per-model daily aggregates of input, output, cache-read, cache-write, and reasoning tokens, plus request count and premium request cost. Mirrors the Claude Code token breakdown structure.
- Formula: For each model key in `modelMetrics`, sum `usage.inputTokens`, `usage.outputTokens`, `usage.cacheReadTokens`, `usage.cacheWriteTokens`, `usage.reasoningTokens`, `requests.count`, and `requests.cost` across all sessions whose `sessionStartTime` falls within the analysis period; bucket by calendar day.
- Display: Table of model name, daily token totals (input / output / cache-read / cache-write / reasoning), request count, and cost (USD). Sorted by total cost descending.
- Tier: B

**7.17 Copilot total cost**
- Definition: Total premium request cost for the analysis period, summed across all models and all sessions.
- Formula: `total_cost = sum(requests.cost)` across all `modelMetrics` entries in all qualifying `session.shutdown` events.
- Display: "Total Copilot cost: $X.XX (premium interactions only — code completions are unlimited and not tracked)."
- Tier: B

**7.18 Copilot model cost breakdown**
- Definition: Percentage of total Copilot cost attributable to each model.
- Formula: `model_cost_share(m) = sum(requests.cost for model m) / total_cost`
- If `total_cost == 0` (e.g., the user has only used code completions with no premium interactions), suppress the model cost breakdown chart and display instead: "No premium interaction cost recorded for this period. Code completions are not tracked in cost data (see §5 Source 4)." When `total_cost == 0`, `model_cost_share(m)` is treated as undefined (not zero) for all models; the R2 trigger does not fire for Copilot in this state because `total_spend_premium_model_usd = 0 < $5.00`.
- Chart type: Pie chart or bar chart.
- Display: Model names with cost percentage and absolute cost. Sorted by cost descending.
- Tier: B

**7.19 Copilot cached token fraction**
- Definition: Fraction of total input tokens served from the cache, per model and in aggregate. Because `inputTokens` already includes cached and non-cached prompt tokens, it is the full denominator.
- Formula: `cache_fraction_copilot(m) = cacheReadTokens_m / inputTokens_m` for each model `m`; `cache_fraction_copilot(aggregate) = Σ(cacheReadTokens_m) / Σ(inputTokens_m)` where the sum runs over all models `m` in the analysis period.
- Display: Percentage with raw token counts. Shown per model and as a weighted aggregate.
- Tier: B

---

## 8. Recommendation Engine

Recommendations are generated after all metrics are computed. Each recommendation has a trigger condition (the data condition that must be true for it to fire), a severity level (High, Medium, Low), a title, a body (one to two sentences), and a supporting metric reference.

A recommendation is shown only if its trigger condition is met. If no recommendations fire, the section displays: "No optimization opportunities detected based on the data available. Connect additional sources or richer data tiers for deeper analysis."

All four recommendations are computable purely from token counts, costs, timestamps, and cache flags — no prompt or response content is required.

Template variables (`[X]`, `[N]`, `[Y]`, `[Model name]`, `[cheaper model]`, `[source_name]`, `[savings_estimate]`) are card-scoped: each recommendation's own Where block (or "resolved at render time" sub-block) is the sole authoritative definition for that card's render-time substitutions.

### R1: Enable Prompt Caching

**Category:** Caching opportunity
**Severity:** Medium
**Trigger (path A — not using caching):** Anthropic source connected AND `cache_creation_input_tokens_anthropic == 0` AND `total_input_tokens_anthropic > 100000`
**Trigger (path B — low cache hit rate):** Anthropic source connected AND `cache_fraction_anthropic < 0.1` AND `total_input_tokens_anthropic > 100000`
**Trigger (path C — Claude Code not using or underusing caching):** Claude Code source connected AND (`cache_creation_input_tokens_claude_code == 0` OR `cache_fraction_claude_code < 0.1`) AND `total_input_tokens_claude_code > 100000`

Note: Paths A and B are evaluated as a single Anthropic trigger; if both conditions are satisfied simultaneously, one R1 card is generated for the Anthropic source.

Where:
- `cache_creation_input_tokens_anthropic` = sum of `cache_creation_input_tokens` from Anthropic Usage API over the analysis period
- `cache_fraction_anthropic` = `cache_read_input_tokens / (input_tokens + cache_creation_input_tokens + cache_read_input_tokens)` from Anthropic Usage API, summed over the analysis period
- `total_input_tokens_anthropic` = sum of `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` from Anthropic Usage API over the analysis period
- `cache_creation_input_tokens_claude_code` = sum of `cache_creation_input_tokens` from Claude Code local session files (`~/.claude/`) over the analysis period
- `cache_fraction_claude_code` = `cache_read_input_tokens / (input_tokens + cache_creation_input_tokens + cache_read_input_tokens)` from Claude Code local session files (`~/.claude/`), summed over the analysis period
- `total_input_tokens_claude_code` = sum of `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` from Claude Code local session files (`~/.claude/`) over the analysis period
- `[X]` = `cache_fraction_anthropic * 100` for paths A/B; `cache_fraction_claude_code * 100` for path C (percentage of input tokens served from cache, rounded to one decimal place)

**Title:** "Prompt caching opportunity"
**Body:** "Only [X]% of your [source_name] input tokens are served from the prompt cache. If your workflows include repeated system prompts or reference documents, enabling prompt caching on your [source_name] calls could reduce costs by up to [savings_estimate]."

Where `[source_name]` is resolved at render time:
- Path A or B triggered (Anthropic): `source_name = "Anthropic"`
- Path C triggered (Claude Code): `source_name = "Claude Code"`

(When both trigger simultaneously, two separate cards are generated — one per source — each resolving `[source_name]` independently.)

**Estimated savings formula (per model, then summed):** For each model `m` used by the triggering source during the analysis period:

```
savings_m = total_input_tokens_m × (1 − cache_fraction_m) × reuse_factor
           × [(standard_input_price_m − cache_read_price_m) − (cache_creation_price_m − standard_input_price_m)]
```

Where (all variables are scoped to the triggering source — Anthropic Usage API for paths A/B; Claude Code local session files for path C):
- `total_input_tokens_m` = sum of `input_tokens_m + cache_creation_input_tokens_m + cache_read_input_tokens_m` for model `m` over the analysis period
- `cache_fraction_m` = `cache_read_input_tokens_m / total_input_tokens_m`
- `standard_input_price_m` = `input_cost_per_token` for model `m` from the LiteLLM price map
- `cache_read_price_m` = `cache_read_input_token_cost` for model `m` from the LiteLLM price map; if absent, exclude model `m` from the estimate
- `cache_creation_price_m` = `cache_creation_input_token_cost` from the LiteLLM price map for model m (approximately 1.25× `standard_input_price_m` for 5-minute TTL). If `cache_creation_input_token_cost` is absent for model m, use `standard_input_price_m × 1.25` as a fallback approximation.
- The second term `(cache_creation_price_m − standard_input_price_m)` represents the write overhead cost — the premium paid to write tokens into cache. This must be netted against the read savings to avoid overstating projected savings.
- Net savings formula simplifies to: `total_input_tokens_m × (1 − cache_fraction_m) × reuse_factor × (2 × standard_input_price_m − cache_read_price_m − cache_creation_price_m)`
- `reuse_factor` = 0.5 (label in the UI as "Estimated — assumes 50% of uncached tokens are cacheable")

`[savings_estimate]` = sum of `savings_m` across all models with available `cache_read_input_token_cost`. If no models for the source have this entry, suppress the savings estimate and omit "could reduce costs by up to [savings_estimate]" from the body.

**Tiers that can trigger this:** B (Anthropic and Claude Code only — for the Anthropic API source, prompt caching is developer-controlled via explicit `cache_control` markers in API calls. For the Claude Code source, caching is managed internally by the CLI tool; users do not write `cache_control` markers, so the recommendation should be interpreted as encouraging caching-friendly usage patterns (long system prompts, repeated contexts) rather than enabling API flags. OpenAI exposes `cached_input_tokens` in its API response but its caching is fully automatic — it cannot be enabled or tuned by developers — so R1 is not actionable for OpenAI. GitHub Copilot caching is managed automatically by the provider.)

### R2: Downgrade Model

**Category:** Model selection efficiency
**Severity:** High
**Trigger:** `model_cost_share(premium_model) > 0.3` AND `output_tokens_per_day(premium_model) < 500` AND `total_spend_premium_model_usd > 5.00` for any model in the following downgrade-candidate table:

**Downgrade-candidate table (OpenAI and Anthropic sources)**

| Premium model (detected) | Suggested cheaper alternative |
|---|---|
| gpt-4o | gpt-4o-mini |
| gpt-4-turbo | gpt-4o-mini |
| claude-3-5-sonnet-* | claude-3-haiku-* |
| claude-3-opus-* | claude-3-5-sonnet-* |

Entries ending in `-*` match any model name beginning with the preceding prefix, case-insensitively.

For GitHub Copilot: trigger fires when a single model accounts for >30% of total Copilot cost (derived from `requests.cost` summed across `modelMetrics`) AND `output_tokens_per_day(premium_model) < 500` AND total Copilot cost for the premium model exceeds $5.00.

If a premium model is detected in usage data but does not appear in this table, the recommendation does not fire.

**Title:** "High-cost model used for low-output tasks"
**Body:** "[Model name] accounts for [X]% of your actual spend but generates an average of only [N] output tokens per day. Consider testing [cheaper model] for these interactions. Estimated savings: [Y]% if volume holds."

Where `[Model name]` and `[cheaper model]` are resolved at render time:
- `[Model name]` = the name of the detected `premium_model` that fired the trigger, as returned by the source's usage data (API or local file)
- `[cheaper model]` = the display name resolved from the §11 model display-name mapping table, using the Suggested alternative value as the lookup key. If the value ends in `-*`, strip the `-*` suffix before querying the table (e.g., `claude-3-haiku-*` → lookup key `claude-3-haiku-`). If no display name is found, the raw lookup key (with the `-*` suffix already stripped) is used as the fallback.
- If the trigger fires for multiple premium models simultaneously, generate one R2 card per model, each resolving `[Model name]` and `[cheaper model]` independently

**Savings estimate formula:** `savings_estimate = current_spend * model_cost_share(premium_model) * (1 - (cheaper_model_price / premium_model_price))`

Where:
- `current_spend` = total actual cost for the analysis period for the source that contains `premium_model` (i.e., the Tier B source whose usage data reported the triggering model)
- `total_spend_premium_model_usd` = `current_spend * model_cost_share(premium_model)` — used for the $5.00 minimum-spend guard in the trigger
- `model_cost_share(premium_model)` = fraction of total spend attributable to the premium model (§7.6 for Anthropic/OpenAI; §7.18 for Copilot)
- `output_tokens_per_day(premium_model)` = average daily output tokens for the premium model over the analysis period (see §7.12a)
- `premium_model_price` = blended `(input_cost_per_token + output_cost_per_token) / 2` from the LiteLLM price map (all Tier B sources including GitHub Copilot)
- `cheaper_model_price` = blended `(input_cost_per_token + output_cost_per_token) / 2` from the LiteLLM price map for the suggested alternative model; if absent, suppress the savings estimate for that model pair
- `[X]` = `model_cost_share(premium_model) * 100` (percentage of total source spend, rounded to one decimal place)
- `[N]` = `output_tokens_per_day(premium_model)` for all Tier B sources including GitHub Copilot (average daily output tokens for the premium model, as defined in §7.12a; for Copilot, derived from `usage.outputTokens` in `modelMetrics` across `session.shutdown` events)
- `[Y]` = `model_cost_share(premium_model) * (1 - (cheaper_model_price / premium_model_price)) * 100` — percentage of total source spend that would be saved if all calls to the premium model were routed to the cheaper alternative at the same volume

Note: If `cheaper_model_price` is absent for a given model pair, suppress the savings estimate for that pair — omit "Estimated savings: [Y]% if volume holds." from the body for that card.

**Tiers that can trigger this:** B (all Tier B sources, including GitHub Copilot)

**Copilot-specific note:** For GitHub Copilot, model selection for Chat and CLI is configurable in Copilot settings. The recommendation body surfaces the per-model cost breakdown (§7.18) as evidence and links users to Copilot model configuration settings.

**Copilot model substitution table**

| API model name prefix | Suggested alternative (API prefix) | Rationale |
|---|---|---|
| `claude-opus-4.5`, `claude-opus-4.6`, `claude-opus-4.7`, `claude-opus-4.8` | `claude-haiku-4.5` | 10–30× cheaper per token; suitable for straightforward chat queries |
| `claude-sonnet-4` | `claude-haiku-4.5` | 3–5× cheaper; appropriate for most coding assistance tasks. Prefix `claude-sonnet-4` covers all claude-sonnet-4.x variants via prefix matching — no row update needed when new minor versions ship. |
| `gpt-5.4`, `gpt-5.5` | `gpt-5.4-mini` | 5–20× cheaper; equivalent quality for code completion and short queries. `gpt-5.4-nano` is an alternative for even lighter workloads. |
| `gemini-3.1-pro` | `gemini-3.5-flash` | 4–8× cheaper; comparable quality for standard tasks |
| `claude-fable-5` *(upcoming)* | `claude-haiku-4.5` | Future model; rule pre-staged for when it becomes available |

Model names in this table are matched case-insensitively against the API model name returned in `modelMetrics` using prefix matching (e.g., 'claude-opus-4.6' matches `claude-opus-4.6-1m`). If the model name detected in `modelMetrics` begins with the Suggested alternative prefix (case-insensitive prefix match), the R2 card is suppressed for that model — the user is already on the recommended alternative.

**Note:** This table is derived from GitHub's published model pricing at `docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing`. Token prices vary; the 'cheaper' designation is based on input+output token blended cost. As GitHub adds new models, this table should be updated.

If the triggering model does not appear in this table, the R2 recommendation does not fire for that model.

### R3: Reduce Prompt Verbosity

**Category:** Input token efficiency
**Severity:** Medium
**Trigger:** p90 daily input tokens across Tier B sources with token data > 50,000 AND aggregate input:output ratio > 8 (input tokens massively exceed output tokens, indicating very large prompts with short completions)
**Title:** "Consistently high input token volume"
**Body:** "Your 90th-percentile daily input token count is [N] tokens. Input tokens dominate your usage ([X]:1 input-to-output ratio). Reducing prompt length — by removing redundant instructions, using shorter examples, or leveraging system prompt caching — can materially reduce cost without affecting output quality."

Where:
- `[N]` = p90 value of daily input tokens across Tier B sources with token data over the analysis period (same quantity used in the trigger condition)
- `[X]` = `total_input_tokens / total_output_tokens` across Tier B sources with token data over the analysis period, rounded to one decimal place (same ratio used in the trigger condition)

For Anthropic and Claude Code, daily input tokens = `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` summed across all models for that day (cache fields are additive — see §7.2).

For GitHub Copilot, daily input tokens = `usage.inputTokens` summed across all `modelMetrics` entries for that session day — `cacheReadTokens` and `cacheWriteTokens` are already included in `inputTokens`.

For OpenAI, daily input tokens = `input_tokens` for that day — `cached_input_tokens` is a subset of `input_tokens` and must NOT be added separately (see §7.2).

**Tiers that can trigger this:** B (all Tier B sources including GitHub Copilot — requires per-day token counts; GitHub Copilot is included as it now exposes per-session token counts via `usage.inputTokens` in `modelMetrics`)

### R4: Use Off-Peak Hours

**Category:** Latency and throughput optimization
**Severity:** Low
**Trigger:** Claude Code source connected AND >70% of sessions fall between 08:00–18:00 on weekdays AND session count >= 20 AND data window >= 7 days (sufficient sample to identify a pattern)
**Title:** "Most activity concentrated in peak hours"
**Body:** "[X]% of your Claude Code sessions run between 8am–6pm on weekdays. Claude API latency (time-to-first-token) is often lower during off-peak hours. Shifting batch or non-interactive work to evenings or weekends can improve throughput."

Where:
- `[X]` = `(count of sessions with start time between 08:00–18:00 on weekdays / total session count) * 100`, rounded to one decimal place, computed from Claude Code local session files (`~/.claude/`) over the analysis period

**Timezone:** The 08:00–18:00 window and weekday classification are evaluated in the local timezone of the machine running the Express server (Node.js `Intl`/`Date` local timezone).

**Note:** Promptly reports this pattern from session timestamps only. It does not have access to actual latency data; the recommendation is based on known provider latency patterns, not measured latency.
**Tiers that can trigger this:** B (Claude Code only — requires session timestamp data)

### Deferred recommendations (future scope)

The following recommendation types require reading or classifying prompt content, which crosses the prompt-content privacy boundary, or depend on P1 sources not yet in MVP.

| Deferred recommendation | Reason deferred |
|---|---|
| Consolidate repeated/similar prompts | Requires semantic similarity comparison of prompt text |
| Batch small sequential requests | Partial: high-frequency low-token session detection is computable, but grouping requires understanding request semantics |
| Context Length Accumulation (long conversations) | Requires conversation content from file exports (P1 source) |
| Quota/Throttle Risk | Low priority given four higher-value recommendations; requires multi-month data |

### Recommendation presentation rules

- Recommendations are sorted by severity: High first, then Medium, then Low.
- Each recommendation card includes: title, body text, the triggering metric value(s), a supporting chart thumbnail (the relevant chart from the analysis section), and a "Why this matters" one-liner.
- Estimated savings figures are labeled as "estimated" and use conservative assumptions.
- If a recommendation cannot be computed for the connected sources (e.g., R1 when no Anthropic source is connected, R4 when no Claude Code data is present), it is not shown (no empty states).
- Recommendations never link to or promote third-party commercial products by name.

---
## 9. Privacy and Security Model

### Core guarantees

1. **No user data leaves the user's machine to any server other than the AI providers the user explicitly connects to.** The outbound network calls from the local Express server are: (a) `api.openai.com` and `api.anthropic.com` using credentials the user provides; and (b) `raw.githubusercontent.com` to fetch the LiteLLM price map at startup (no user data is included in this request; it is a plain GET for a public JSON file). GitHub Copilot data is read from the local filesystem (`~/.copilot/session-state/`) — no network call is made. If option (b) fails, the bundled price map snapshot is used instead and no retry is attempted.

2. **API keys are ephemeral.** Keys entered in the frontend are held in JavaScript heap memory only. They are never written to `localStorage`, `sessionStorage`, IndexedDB, cookies, or any file on disk. The Express server receives keys as HTTP request headers on each individual proxied request and does not store them in memory beyond the lifetime of that request handler.

3. **Local file reads do not leave the user's machine.** Claude Code data is read directly from `~/.claude/` and GitHub Copilot data from `~/.copilot/session-state/` on the user's filesystem by the local Express server. No local file data is transmitted to any network endpoint; it is parsed in memory and returned as metrics to the frontend only.

4. **Session end = data gone.** When the user closes the browser tab, all frontend state is cleared. The Express server process has no persistent state; restarting it (or even just receiving no requests) means no data persists. There is no session store, no database, and no log file that captures user data.

5. **No server-side logging of user data.** The Express server may log HTTP method, path, and status code for debugging (standard access log), but it must not log request bodies, response bodies, API keys, or file contents.

### What the Express server does

The local Express server is a **stateless computation proxy**. Its responsibilities are:
- Receive a credential (API key or token) in the request header from the frontend
- Call the corresponding provider API using that credential
- Return the raw or lightly transformed response to the frontend
- Compute recommendation logic on metrics returned from all adapters
- Return computed metrics to the frontend as JSON

The server does not store any data, maintain sessions, log user data, or make any network calls other than to the supported provider APIs. It reads local Claude Code and GitHub Copilot session files into memory only for the duration of the analysis request; no file contents are persisted.

### What the frontend does

The React frontend holds all session state in React component state and context. It never writes analysis data to any browser persistence API. It uses the local Express server only as a computation and API proxy layer.

### Key handling summary

| Key type | Where entered | Where stored | Lifetime | Sent to |
|---|---|---|---|---|
| OpenAI Admin key | Frontend text input | React state (memory only) | Session only | `api.openai.com` via local server |
| Anthropic Admin key | Frontend text input | React state (memory only) | Session only | `api.anthropic.com` via local server |
| GitHub Copilot | Auto-detected (no input) | N/A — no credentials | N/A | Local filesystem only (`~/.copilot/session-state/`) |

### Threat model (scoped to local use)

**In scope for MVP:**
- Accidental credential exposure: keys are never persisted, reducing risk of later leakage.
- Malicious local files: Claude Code session JSONL files and GitHub Copilot session JSONL files are parsed with a strict JSON parser; no `eval` or dynamic code execution is used.

**Out of scope for MVP (local-only tool):**
- Network interception (user is calling providers directly from their own machine).
- Malicious Express server (user controls the server they cloned and started).
- Multi-user or shared-machine scenarios (single-user personal tool only).

---

## 10. Export Spec

### PDF Report

The PDF is generated client-side using a print-to-PDF rendering of a dedicated print layout (using the browser's print API or a library such as `html2canvas` + `jsPDF`). It does not require a server round-trip.

**Report structure:**

```
Promptly Analysis Report
Generated: [timestamp] (local time)
Analysis period: [start date] to [end date]
Sources connected: [list]

--- Page 1: Summary ---
Total actual spend: [actual USD from all Tier B sources]
Total tokens analyzed: [N actual — from all connected Tier B sources with token data]
Sources: [table: source name, tier, tokens (where available), cost]

--- Page 2: Per-Source Insights ---
[For each source:]
  Source: [name]  |  Tier: [B]
  [Key metrics for this source, matching the UI analysis panels]
  [Primary chart image for this source]

--- Page 3: Recommendations ---
[Each recommendation card that fired:]
  [Severity badge]  [Title]
  [Body text]
  [Triggering metric values]

--- Page 4: Assumptions and Caveats ---
List of all ASSUMPTION flags that applied to this analysis, in plain language.
LiteLLM price map version date used.
Statement: "All figures labeled 'estimated' are approximations. Actual costs may differ."
```

**What is NOT included in the PDF:**
- Any prompt or response text
- API keys or tokens
- Any personally identifiable information beyond what the user explicitly chose to analyze

### JSON Export

The JSON export contains the complete structured data produced by the analysis. It is intended for programmatic use (e.g., sharing with a developer for implementation of recommendations).

**Schema:**

```json
{
  "metadata": {
    "generated_at": "ISO-8601 timestamp",
    "analysis_period_start": "ISO-8601 date",
    "analysis_period_end": "ISO-8601 date",
    "promptly_version": "semver string",
    "litellm_price_map_date": "ISO-8601 date of the price map file used"
  },
  "sources": [
    {
      "source_id": "claude_code | openai | anthropic | github_copilot",
      "adapter": "claude_code.js | openai.js | anthropic.js | github_copilot.js",
      "tier": "B | C | null",
      "connected": true,
      "error": "null if successful; error message string if the source failed to fetch",
      "metrics": {
        // null if error is non-null. Otherwise: all metrics from Section 7 that apply to this source.
        // Example for openai:
        "total_spend_usd": 42.17,
        "analysis_period_days": 30,
        "daily_spend": [{"date": "2026-05-19", "spend_usd": 1.23}],
        "model_breakdown": [{"model": "gpt-4o", "estimated_cost_share": 0.72, "input_tokens": 1200000, "output_tokens": 340000}],
        "input_output_ratio": 3.53,
        "avg_daily_cost_usd": 1.41,
        "peak_spend_day": {"date": "2026-05-28", "spend_usd": 5.20}
        // Example for github_copilot:
        // "session_count": 42,
        // "analysis_period_days": 30,
        // "model_breakdown": [{"model": "gpt-5.4-mini", "input_tokens": 320000, "output_tokens": 48000, "cache_read_tokens": 15000, "cache_write_tokens": 8000, "reasoning_tokens": 2000, "requests_count": 210, "requests_cost_usd": 2.10, "cost_share": 0.45}],
        // "total_cost_usd": 4.67,
        // "input_output_ratio": 6.67,
        // "avg_daily_cost_usd": 0.156,
        // "peak_cost_day": {"date": "2026-06-15", "cost_usd": 0.82},
        // "cache_fraction": {"aggregate": 0.31, "per_model": [{"model": "gpt-5.4-mini", "cache_fraction": 0.28}]}
      }
    }
  ],
  "cross_source_summary": {
    "total_actual_spend_usd": 55.40,
    "total_actual_tokens": 8200000
  },
  "recommendations": [
    {
      "id": "R1 | R2 | R3 | R4",
      "severity": "High | Medium | Low",
      "title": "string",
      "body": "string",
      "triggering_metric": "string",
      "triggering_value": "number or string",
      "estimated_savings_usd": 8.30
    }
  ],
  "assumptions": [
    "string: one entry per ASSUMPTION flag that applied"
  ]
}
```

Note: `total_actual_tokens` is computed using the provider-aware formula from §7.2: for Anthropic and Claude Code, cache fields (`cache_creation_input_tokens`, `cache_read_input_tokens`) are included as additive buckets; for OpenAI, `cached_input_tokens` is a subset of `input_tokens` and is not added separately. For GitHub Copilot, `usage.inputTokens + usage.outputTokens` is used — `cacheReadTokens` and `cacheWriteTokens` are already included in `inputTokens` and must not be added separately.

**What is NOT included in the JSON:**
- API keys or tokens
- Prompt or response text
- Any data beyond the metrics listed above

---

## 11. Tech Stack and Architecture Overview

### Stack decisions

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + Vite | Fast dev server, small bundle, widely understood; Vite enables HMR for developer productivity |
| Styling | Tailwind CSS | Utility-first, no custom CSS required for MVP, consistent design tokens |
| Charts | Recharts | React-native chart library, sufficient for line/bar/pie charts needed; no additional canvas setup |
| PDF export | html2canvas + jsPDF (client-side) | No server required; print layout renders in browser |
| Backend | Node.js + Express | Lightweight, no framework overhead; sufficient for a proxy+compute server with no persistence |
| Price map | LiteLLM `model_prices_and_context_window.json` | Community-maintained, updated frequently, covers all MVP models and more; import at server startup |

**LiteLLM price map fields used by Promptly:** All cost calculations reference the following fields from each model's entry in `model_prices_and_context_window.json`:
- `input_cost_per_token`: cost in USD per input (prompt) token
- `output_cost_per_token`: cost in USD per output (completion) token
- `cache_read_input_token_cost`: cost in USD per cached input token read (present for Anthropic, Claude Code, OpenAI, and some other models in the LiteLLM price map; absent for GitHub Copilot and sources that do not use per-token pricing)
- `cache_creation_input_token_cost`: Per-token price for writing tokens into the prompt cache (Anthropic and Claude Code only). Approximately 1.25× `input_cost_per_token` for 5-minute TTL cache writes. Present for all Anthropic models in the LiteLLM price map. Used when computing Claude Code session cost for `cache_creation_input_tokens`. If absent for a model, fall back to `input_cost_per_token` (will slightly underestimate cost for cache-write-heavy sessions).

If a model name from the usage data does not appear in the price map, Promptly displays "price unavailable" for that model's cost estimates and excludes it from savings calculations.
| File parsing | Built-in Node.js JSON parser | Standard; no additional dependency needed for JSON/JSONL |

### Timezone model

**Timezone model:** All timestamps are stored and processed in UTC. All time-based values displayed in the UI (dates, daily buckets, time-of-day windows) are rendered in the local timezone of the machine running the Express server using Node.js `Intl`/`Date`. This applies uniformly across all sources — API sources return UTC natively; local-file sources (Claude Code, GitHub Copilot) use Unix millisecond timestamps which are inherently UTC.

### Architecture diagram (text)

```
[User's browser]
   React + Vite frontend (port 5173)
   |-- Holds: API keys (memory), analysis results (memory), session state (memory)
   |-- Never writes to: localStorage, sessionStorage, IndexedDB, cookies
   |
   | HTTP (localhost only)
   v
[Local Express server] (port 3001)
   |-- Stateless: no in-memory state between requests
   |-- Modules:
   |     adapters/
   |       claude_code.js      -- enumerates ~/.claude/projects/**/*.jsonl session files, parses JSONL, computes cost from tokens × LiteLLM price map, returns Tier B data
   |       openai.js           -- calls api.openai.com, returns normalized Tier B data
   |       anthropic.js        -- calls api.anthropic.com, returns normalized Tier B data
   |       github_copilot.js   -- enumerates ~/.copilot/session-state/*/events.jsonl, extracts session.shutdown events, aggregates modelMetrics, returns normalized Tier B data
   |     engine/
   |       metrics.js          -- computes all metrics defined in Section 7
   |       recommendations.js  -- evaluates all recommendation triggers from Section 8
   |       tiers.js            -- classifies data tier per source
   |     data/
   |       model_prices_and_context_window.json  -- LiteLLM price map (bundled or fetched at startup)
   |
   | HTTPS (to provider APIs)
   v
[Provider APIs / Local Files]
   ~/.claude/projects/     -- Claude Code session JSONL files (read-only; no network call)
   api.openai.com          -- Usage API + Costs API
   api.anthropic.com       -- Usage Report API + Cost Report API
   ~/.copilot/session-state/  -- GitHub Copilot session event JSONL files (read-only; no network call)
```

### Adapter pattern

Each source adapter (`adapters/*.js`) implements the following interface:

```javascript
// adapter interface (all adapters implement these exports)
async function connect(credentials, options) {
  // credentials: { apiKey: string } or { token: string }
  // options: { startDate: Date, endDate: Date }
  // returns: { success: boolean, error: string | null, tier: "B" | "C" | null }
  // tier is null when success is false
}

async function fetch(credentials, options) {
  // returns: { data: NormalizedSourceData | null, tier: "B" | "C" | null, error: string | null }
  // data and tier are null when error is non-null
}

function normalize(rawData) {
  // converts provider-specific response format into the shared NormalizedSourceData schema
  // NormalizedSourceData: { sourceId, tier, metrics: {...} }
}
```

Adding a new provider requires only: creating `adapters/newprovider.js` implementing this interface, registering it in the adapter registry, and adding a source card in the frontend. No changes to the metrics engine or recommendation engine are required unless the new adapter provides new metric types.

**HTTP timeout policy:** All outbound HTTP requests from the Express server to provider APIs must have a 30-second timeout. If a request times out, the adapter returns `{ error: "Request timed out after 30s", tier: null, data: null }`. Pagination requests (fetching additional pages of results) share the same 30-second per-request timeout. The analysis waits for all source requests to settle before rendering any results (the per-source progress indicator shows which sources are still in flight).

Per-source status indicators (spinners, progress states) update progressively as each source responds. Final insight panels, the summary bar, and recommendation cards render only after all sources and the `/analyze/recommendations` call have settled.

### Model display-name mapping

When rendering model names in recommendation card body text, the `[cheaper model]` template variable is resolved to a friendly display name using the following lookup table. If a model prefix is not found in this table, the raw API model name prefix is used as a fallback.

| API model name prefix | Display name |
|---|---|
| `claude-haiku-4.5` | Claude Haiku 4.5 |
| `claude-3-haiku-` | Claude 3 Haiku |
| `claude-3-5-sonnet-` | Claude 3.5 Sonnet |
| `gpt-5.4-mini` | GPT-5.4 mini |
| `gpt-5.4-nano` | GPT-5.4 nano |
| `gemini-3.5-flash` | Gemini 3.5 Flash |
| `claude-fable-5` | Claude Fable 5 |

Match is case-insensitive prefix match against the API model name returned in `modelMetrics`. The first matching entry wins.

### No one-way door rationale

The following architectural choices are made explicitly to preserve optionality for a post-MVP persistent dashboard:

1. **All state lives in the frontend, not the server.** A future version could replace the React state with a database-backed state layer without any server refactoring.

2. **The Express server is already structured as a REST API.** Adding persistence (a database, a session store) to the same server in the future requires only adding new routes and a DB connection; the existing routes do not need to change.

3. **The `NormalizedSourceData` schema is database-ready.** The schema is flat, typed, and uses ISO timestamps; it can be inserted into a time-series database or a relational DB without transformation.

4. **The adapter interface is provider-agnostic.** New providers, including Tier A proxy adapters (Langfuse, Helicone, LiteLLM proxy) can be added without modifying existing adapters.

5. **No frontend routing choices lock in the SPA model.** React Router (or equivalent) should be used for page routing so future authenticated pages can be added cleanly.

### Running the tool

```bash
git clone https://github.com/[username]/promptly
cd promptly
npm install          # installs both frontend and backend dependencies (npm workspaces; root package.json with `workspaces: ["frontend", "backend"]`)
npm start            # starts both Vite dev server (port 5173) and Express server (port 3001) concurrently
```

The user opens `http://localhost:5173` in their browser. No environment variables are required; all credentials are entered in the UI at runtime.

---

## 12. Out of Scope for MVP

The following items are explicitly post-MVP. They are listed here to prevent scope creep during the 1.5-week build window.

| Feature | Why deferred |
|---|---|
| Session persistence / saved analyses | Requires a database and user accounts; MVP is stateless by design |
| User accounts and authentication | No persistence means no accounts are needed or meaningful |
| Multi-session comparison ("this week vs. last week") | Requires storage; deferred to persistent dashboard phase |
| Real-time / streaming analysis | API polling and live updates require a persistent connection; out of scope for one-shot tool |
| Proxy-based ingestion (Langfuse, Helicone, LiteLLM proxy) | Requires running a proxy in the request path; Tier A capability is deferred |
| SDK/OTel-based ingestion | Requires code instrumentation; deferred |
| Azure OpenAI, Google Vertex/Gemini, AWS Bedrock support | Requires navigating Cloud FinOps APIs (Azure Monitor, GCP Billing, Cost Explorer); out of scope for 1.5-week MVP |
| Mistral, Cohere, or other provider support | Thin or absent usage APIs; deferred |
| Prompt or completion content analysis | Privacy-sensitive; explicitly excluded by product decision |
| PII detection or redaction | No content ingestion in MVP; no PII to detect |
| Team or organization-level analysis | Personal tool only; multi-user analysis requires RBAC and data isolation |
| Budget alerting or notification features | No persistence = no ongoing monitoring |
| Cost forecasting as an interactive feature | Basic trend data in export only; interactive forecasting is post-MVP |
| Mobile or tablet UI | Desktop-first only for MVP |
| OpenRouter, custom API endpoints | Out of scope; adapter can be added later |
| Dark mode | Not in MVP scope |
| Internationalization (i18n) | English only for MVP |
| API rate limit handling with backoff beyond simple retry | Basic retry (3 attempts, exponential backoff) is in scope; sophisticated rate management is not |
| LiteLLM and Helicone as P0 data sources | Require continuous or scheduled database access; not one-time reads; future scope after persistent dashboard phase |
| Web app users on flat subscriptions (ChatGPT Plus, Claude.ai Pro) | No per-token billing data available; P1 account exports provide conversation text only |
| Prompt content analysis | Privacy boundary — all P0 recommendations are designed to work without reading actual prompt or response content |
| Background data collection or agent installation | Promptly is a reader, not a collector; it reads existing data with no background processes and no installed agents |
| Diff or comparison of two time periods in the UI | Month-over-month spend change (§7.12) is in scope as a Tier B UI metric when ≥45 days of data are available. General interactive period-comparison views (arbitrary date range diff UI) remain post-MVP. |

---

## 13. Open Questions

The following questions require a stakeholder decision before engineering begins. Blocking questions are marked [BLOCKING].

**OQ-1 [RESOLVED] OpenAI Costs API model-level granularity**
Resolved. Price-weighted estimated cost is used for MVP. Per-model cost is estimated by computing (input_tokens_m × input_cost_per_token_m) + (output_tokens_m × output_cost_per_token_m) per model using the LiteLLM price map, then computing each model's share as a fraction of total estimated cost across all models. For Anthropic, cache billing components are included separately (see §7.6). The UI labels the model cost breakdown chart as "Estimated model cost breakdown." See §5 Source 2 (Assumptions) and §7.6 for implementation details.

**OQ-2 [SUPERSEDED] GitHub Copilot billing API — required OAuth scopes**
Superseded by v1.7 source rewrite. The API-based approach (classic PAT + org billing endpoint) has been replaced by local file reads from `~/.copilot/session-state/`. No credentials or OAuth scopes are required. The original resolution details (PAT scopes, org vs. user endpoint fallback logic) are no longer applicable and have been removed from §5 Source 4.

**OQ-3 [SUPERSEDED] Copilot subscription cost input**
Superseded by v1.7 source rewrite. Both the original question (subscription cost input) and the v1.6 resolution (reading actual billing costs from `netAmount` in the API) are no longer applicable. Cost is now read directly from `requests.cost` in `session.shutdown` events in the local `~/.copilot/session-state/` files. No API key or subscription cost input is required.

**OQ-4 [MEDIUM] Date range default and configurability**
The spec defaults the analysis window to "last 30 days." Should users be able to select arbitrary date ranges, or only preset windows (7d, 30d, 90d, custom)? The Anthropic cost report API has a daily granularity and the OpenAI APIs support flexible date ranges, so technically both options are feasible. Decision needed before building the date range UI component.

**OQ-5 [RESOLVED] LiteLLM price map update strategy**
Resolved: option (b) — fetch the latest version from `raw.githubusercontent.com` at server startup, with the bundled snapshot as a fallback on failure. No retry on startup failure. Implemented in §9 (Core guarantees, point 1).

**OQ-6 [REMOVED]**
OQ-6 was deliberately removed during the v1.2 revision. No content has been inadvertently omitted; OQ-6 does not correspond to any deferred question.

**OQ-7 [LOW] PDF rendering library**
Section 10 specifies `html2canvas + jsPDF` for client-side PDF generation. An alternative is to use the browser's native `window.print()` with a CSS print stylesheet, which is simpler but offers less layout control. Decision needed before frontend work on the export feature.

**OQ-8 [LOW] Port configuration**
The spec uses Vite default (5173) and Express default (3001). Should these be configurable via environment variables for users who have port conflicts? Recommendation: yes, support `VITE_PORT` and `EXPRESS_PORT` env vars with documented defaults.

**OQ-9 [LOW] Handling of legacy model names in API usage data**
API usage data from Anthropic and OpenAI may include model names from older versions (e.g., `claude-2`, `claude-instant-1`, `gpt-4-0314`) that may or may not have entries in the current LiteLLM price map. Decide: show "unknown model" with no cost estimate, skip those records in the aggregate, or use the nearest known model as a fallback?

**OQ-10 [RESOLVED] Claude Code session data format**
Resolved. `~/.claude/stats-cache.json` does not exist. Real data location: `~/.claude/projects/<encoded-project-path>/<sessionId>.jsonl` (or `$CLAUDE_CONFIG_DIR/projects/...` if `CLAUDE_CONFIG_DIR` is set). Format: JSONL session transcripts — token counts are per-message. Cost is not stored directly; it must be computed as tokens × model price using the LiteLLM price map. The adapter enumerates all session JSONL files under the projects directory, parses each, and aggregates token counts and computed costs per model. Error handling and onboarding copy in §5 Source 1 and §4 have been updated accordingly.

---

*End of Promptly Product Spec v1.7*
---

## Changelog

The full revision history for this spec is maintained in a separate reference file to keep this document concise and model-context-efficient.

**See:** [docs/spec-changelog.md](./spec-changelog.md)

> Load spec-changelog.md only when you need to trace a specific change, understand a past decision, or audit version history. It is not required context for implementing or reviewing the current spec.
