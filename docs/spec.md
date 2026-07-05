---
title: promptly-product-spec-v2-0
source: spec-draft
source_type: sub-agent
tags: [spec, promptly, product, v2.0]
created_at: 2026-06-24T00:48:50.086Z
---
# Promptly Product Spec
**Version:** 2.2
**Date:** 2026-07-04
**Author:** spec-draft agent
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

Promptly is a **one-time analysis tool** that aggregates a user's existing AI usage data from up to five MVP sources, classifies it by the quality of data available, and produces a concrete set of insights and optimization recommendations. It runs entirely on the user's local machine. Data never leaves the machine. When the browser tab closes, everything is gone.

The core frame is **estimated spend**: how much did you spend, where did it go, and what should you do about it? Four MVP sources expose token-and-cost data. OpenAI and Anthropic return costs directly from their provider billing APIs. Claude Code computes cost locally from token counts × model price using the LiteLLM price map — no provider API call is made. GitHub Copilot reads per-model request cost directly from local session event files. ChatGPT Export (`chatgpt_export`) is the MVP Tier C source: because ChatGPT account exports do not include token counts or billing data, Promptly estimates relative cost from conversation/message counts, model hints where available, and the LiteLLM price map. Tier C estimates are included in mixed estimated-spend totals and spend-by-tool charts, but are visually labeled as estimated from conversation activity.

**Display label note:** All user-facing spend totals are labeled "Estimated spend." "Estimated" is a conservative product label — some sources (OpenAI, Anthropic) provide precise billing data, while others (Claude Code, GitHub Copilot) compute cost from local token counts and model prices. Source-level accuracy details are documented in the project README.

**Analysis-page design principle:** The analysis page answers practical money questions in a narrative flow. Every displayed metric must include a plain-language "so what" interpretation. Users should be able to answer "where is my money going and what should I change?" without needing to interpret raw numbers themselves.

### What makes it different

| Dimension | Native dashboards | Observability platforms | Promptly |
|---|---|---|---|
| Requires code instrumentation | No | Yes | No |
| Works retroactively on existing data | Yes | No | Yes |
| Aggregates across providers | No | Sometimes | Yes |
| Shows optimization recommendations | Minimal | Yes (Tier A only — see §6) | Yes (Tier B and MVP Tier C; see §8) |
| Requires cloud account / SaaS signup | No | Yes | No |
| Data leaves your machine | Yes (to provider) | Yes (to vendor) | Never |


---

## 2. Goals and Non-Goals

### Goals (MVP)

- **G1.** A user can connect any combination of the supported P0 data sources in a single session and see a unified analysis.
- **G2.** Every connected source always shows at least one non-empty insight, regardless of data quality.
- **G3.** All user-facing spend totals use the "Estimated spend" label across the entire UI. Per-source accuracy details are documented in the README and in the export assumptions section.
- **G4.** The tool surfaces optimization recommendations, each with a clear trigger condition and a specific estimated dollar saving where computable.
- **G4a.** The results page prioritizes cost answers and plain-language recommendations over raw token diagnostics. The user should be able to answer "where is my money going and what should I change?" from the analysis page alone, without needing to interpret numbers themselves.
- **G5.** The user can export their full analysis as a PDF report and/or a structured JSON file.
- **G6.** No user data is retained after the session ends; no account required.
- **G7.** The codebase is publishable on GitHub as a clone-and-run tool requiring only two commands: `npm install` and `npm start`.
- **G8 — No one-way doors:** No existing adapter, route, or schema change is required to add a persistence layer or multi-user support in a future release.

### Non-Goals (MVP)

- **NG1.** Team-level or organization-level analysis. This is a personal tool.
- **NG2.** Real-time or streaming analysis. Promptly analyzes a static snapshot taken at session start.
- **NG3.** Proxy-based or SDK-based ingestion of live traffic.
- **NG4.** Any form of user accounts, authentication, or session persistence.
- **NG5.** Support for Azure OpenAI, Google Vertex/Gemini, AWS Bedrock, Mistral, Cohere, or any provider not in the five MVP sources. Future file/web sources beyond ChatGPT Export (for example, Claude Export and Cursor) are planned but not MVP.
- **NG6.** Prompt or completion content analysis. Promptly never stores, surfaces, semantically analyzes, or sends the text of prompts or responses anywhere. For ChatGPT Export, the uploaded `conversations.json` may contain conversation text, but Promptly uses only structural metadata needed for aggregate metrics — timestamps, conversation/message counts, model identifiers where present, and tool-call markers where reliably exposed. All narrative signals on the analysis page — efficiency signal, session cost, caching savings, conversation efficiency, and activity spikes — are derived exclusively from aggregated token counts, cost metrics, conversation counts, timestamps, model identifiers, and non-content metadata. No prompt or response text is used to generate plain-language insights.
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

**Scenario:** Danny clones Promptly, runs `npm install && npm start`, opens the browser, pastes his OpenAI Admin key, and uploads his ChatGPT Export `conversations.json`. Promptly also reads his local Claude Code session data from `~/.claude/projects/` and his GitHub Copilot session data from `~/.copilot/session-state/` automatically — no credentials required for either. In under five minutes he sees: (a) his OpenAI model split by token cost, (b) that 3 API keys account for 70% of his API spend, (c) that his Claude Code sessions show consistently high input token counts — triggering a Reduce Prompt Verbosity recommendation, (d) that switching the identified high-volume, low-output API calls to `gpt-4o-mini` could reduce his API spend by an estimated 40-60%, and (e) a ChatGPT Export card showing estimated relative cost, conversation count, model mix, and conversation-efficiency recommendations clearly labeled as estimated from conversation activity. He exports a PDF, closes the tab, and his data is gone.

### PM Parker

**Role:** Product manager at a tech company
**AI tools in use:** Claude (via Anthropic API for a personal side project), ChatGPT (daily use)
**Mental model:** Thinks in workflow outcomes, not model names; does not distinguish between input and output tokens; has vague intuition that AI costs "could be optimized" but no concrete data
**Pain:** Parker wants to understand whether the Anthropic API spending on her side project is proportionate to the value she is getting. She also wants a rough, privacy-preserving view of whether her ChatGPT usage is dominated by long conversations or expensive model choices.

**Scenario:** Parker runs Promptly, connects her Anthropic Admin key, and uploads her ChatGPT Export `conversations.json`. Promptly also reads her Claude Code session data automatically from `~/.claude/projects/`. Anthropic API and Claude Code are classified as Tier B (tokens + cost available); ChatGPT Export is classified as Tier C (aggregate/export-derived estimates only). She sees absolute dollar costs for Tier B sources broken down by model and day, plus a clearly labeled estimated ChatGPT Export card with conversation count, model mix, estimated relative cost, and data-freshness prompt. The tool surfaces a Reduce Prompt Verbosity recommendation for her Anthropic API data and a conversation-efficiency recommendation if her ChatGPT conversations are long. She exports a JSON file to share with a developer friend who will implement the changes.

---

## 4. User Journey and Flow

### Step-by-step flow

**Step 1: Landing page**
User arrives at `http://localhost:5173` (Vite default port). The page shows:
- One-sentence description of what Promptly does
- A privacy notice: "All analysis runs locally. Nothing is sent to any server other than the AI providers you explicitly connect to."
- A "Connect sources" section with cards for each of the 5 supported MVP sources
- A "Start analysis" button (disabled until at least one source is ready). For auto-detected local-file sources (Claude Code, GitHub Copilot), 'ready' is reached automatically when the validation check passes after the user enables the card. For ChatGPT Export, 'ready' is reached after the user selects or drops a valid `conversations.json` export file and the lightweight parse validation succeeds.

**Step 2: Source connection**
The user can connect any combination of sources in any order. Each source card has its own connection UI:

| Source | Connection method | Input field(s) |
|---|---|---|
| Claude Code | Local file read (auto) | No input required; Promptly reads session JSONL files under `~/.claude/projects/` (or `$CLAUDE_CONFIG_DIR/projects/` if set) when the card is enabled |
| OpenAI | API key entry | Admin API key (text input, masked) + date range picker (default: last 30 days) |
| Anthropic | API key entry | Admin API key (text input, masked) + date range picker (default: last 30 days) |
| GitHub Copilot | Local file read (auto) | No input required; Promptly reads session events from `~/.copilot/session-state/` (Windows: `C:\Users\<user>\.copilot\session-state\`) automatically when the card is enabled |
| ChatGPT Export | File upload | User selects or drops a ChatGPT account export `conversations.json` file from ChatGPT Settings → Data Controls → Export data |

When only local-file or uploaded-file sources (Claude Code, GitHub Copilot, and/or ChatGPT Export) are enabled and no API-key sources are configured, a global date range picker (default: last 30 days) is displayed at the top of the connection step and applies to all non-API sources. This picker is hidden when at least one API-key source is configured, as the API sources carry their own per-card date range pickers that govern the analysis window. If multiple API sources are connected with different date ranges, all local-file and uploaded-file sources use the union of those ranges (earliest start date to latest end date). ChatGPT Export conversations outside the selected analysis window are ignored for metrics.

Each card shows a status indicator: unconfigured / configured / fetching / ready / error. Configured API keys are stored only in JavaScript memory (the `window` object in the frontend); they are not written to `localStorage`, `sessionStorage`, cookies, or any other persistent store. Uploaded files are held in browser memory only until analysis completes and are not persisted. The backend receives API keys as request headers and uploaded export data as the per-request payload for that source; it does not store either beyond the lifetime of the request handler. GitHub Copilot requires no credentials — it reads from the local filesystem only. ChatGPT Export requires no credentials — the user supplies the export file directly.

**Step 3: Validation**
When a source is configured, the frontend immediately performs a lightweight validation check appropriate to the source's connection method. Status updates on the card:
- Green checkmark + "Connected: [N] days of data available" (where the source reveals this)
- Successful validation (green checkmark) moves the source card to the **'ready'** state.
- Red X + human-readable error message.

For API-key sources (OpenAI, Anthropic), the frontend sends a lightweight validation request through the local Express server to the provider API to confirm the key is valid and has the required permissions. Example error: "This key does not have Admin permissions. Org-level admin keys are required for usage data."

For Claude Code, the validation step checks that the `~/.claude/projects/` directory (or `$CLAUDE_CONFIG_DIR/projects/` if set) exists and contains at least one JSONL session file. If the directory is missing or empty, the card displays: "No Claude Code data found. Have you run Claude Code at least once?"

For GitHub Copilot, the validation step checks that `~/.copilot/session-state/` (Windows: `C:\Users\<user>\.copilot\session-state\`) exists and contains at least one parseable `session.shutdown` event.

- If the directory is missing: card displays "No Copilot session data found. Have you run GitHub Copilot at least once?"
- If the directory exists but contains no parseable `session.shutdown` events in the selected period: card displays "No Copilot session data found for the selected period. Try a wider date range."

For ChatGPT Export, the validation step checks that the uploaded file is parseable JSON and has the expected ChatGPT export shape: a top-level conversation collection with conversation/message nodes or equivalent conversation records. The parser validates structure only; it does not semantically inspect prompt or response text. Validation outcomes:
- If no file is selected: card remains unconfigured.
- If the file is not valid JSON: card displays "This file could not be parsed as JSON. Upload the `conversations.json` file from your ChatGPT data export."
- If the file is valid JSON but does not match the expected ChatGPT export shape: card displays "This doesn't look like a ChatGPT export. Upload the `conversations.json` file from ChatGPT Settings → Data Controls → Export data."
- If the file contains no conversations in the selected period: card displays "No ChatGPT conversations found for the selected period. Try a wider date range or re-export your data."

**Step 4: Run analysis**
User clicks "Start analysis." The frontend disables the button and shows a per-source progress indicator. The analysis runs as **one HTTP request per connected source** (not a single combined request), so the frontend can update each source card's progress indicator independently as each request resolves (status indicators update progressively; result panels render after all sources settle):

1. The frontend sends one `POST /analyze/{sourceId}` request per connected source, in parallel.
2. As each response arrives, the corresponding source card updates from "fetching" to "ready" (or "error").
3. After all source requests settle, the frontend sends one `POST /analyze/recommendations` with the combined metrics from all sources to compute cross-source recommendations.

Each `/analyze/{sourceId}` request body includes the data needed for that source and any relevant options (date range). API-key sources include credentials for that source. Local auto-detected sources include options only; the server reads the local files. ChatGPT Export includes the uploaded `conversations.json` data for that single request and the selected analysis window. Each response returns the metrics for that source only.

⚠️ NOTE: The spec should not require a specific transport encoding for the upload (`multipart/form-data` versus JSON payload); that is an engineering-design detail. The product requirement is that the file is processed in memory for the request and is not persisted.

Estimated total analysis time: under 30 seconds for typical personal usage volumes. Individual source results may appear in 3-10 seconds each.

**Step 5: Results dashboard**
The results page presents a narrative analyst-report layout in this fixed order:

1. **Analysis header** — Estimated spend total, analysis period (always visible), token sub-line with effective cost per million tokens where actual token counts are available, and a trend badge showing one of three states per §7.3d: available (MoM change %), insufficient_data, or no_prior_spend — never silently hidden. If the total includes Tier C estimated-only spend, the header flags the mixed total with an estimated marker (for example, `~` prefix or asterisk) and explanatory label.
2. **Where is your money going?** — Horizontal spend-by-tool bar showing each connected source's actual/computed or estimated spend contribution and share of total. Tier C estimated-only bars are visually flagged (for example, hatched fill, asterisk, and/or `~` prefix) and labeled "estimated from conversation activity." Top 1–2 money-saving recommendations (with specific dollar saving, with percentage context where applicable) appear directly under this bar; Tier C recommendations without dollar savings remain in the relevant per-tool card.
3. **Is your spending trending?** — Cross-source daily spend trend chart. Spike callout when peak day is ≥ 2× average. Insufficient-data note when MoM cannot be computed. Tier C source-level trends use daily conversation volume when actual spend is unavailable.
4. **Per-tool cards** — One expandable card per connected source, sorted by estimated or actual/computed spend contribution (highest first). The highest-spend tool is expanded by default. Cards use a uniform field model (§7 Source-card field inventory): fields that are available for a source are shown, while fields that do not apply are omitted or displayed as `N/A` with a reason such as "N/A — no billing API." A ChatGPT Export card shows estimated token volume, estimated relative cost labeled "estimated from conversation activity," conversation count, model mix breakdown, average conversation length, daily activity sparkline, data-freshness prompt, and Tier C recommendation(s) if triggered.
5. **Budget tracker CTA** — Placeholder for a future budget tracking feature.
6. **Export actions** — "Download PDF" and "Download JSON" buttons.

Analysis period is displayed in the header at all times. Recommendations appear in context — top money-saving recommendations under the spend bar, per-tool recommendations at the bottom of the relevant tool card. There is no standalone global recommendations section.

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
| **ChatGPT Export** | File upload (`conversations.json` from ChatGPT account export) | Conversation/message counts, timestamps, model identifiers where present, estimated token volume, estimated relative cost — no token counts or billing data |

### P1 Sources (future releases)

| Tool | Access Method | Limitation |
|---|---|---|
| **Claude Export (file) — disabled stub, future P1** | Account export | Not active in MVP; no metered billing for web users |
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
- **Note:** Session timestamps (Unix milliseconds) are stored in UTC. For daily bucketing and display dates, timestamps are converted to local machine timezone at display time, consistent with the timezone model in §5 Source 4.

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
- ASSUMPTION: `sessionStartTime` is a Unix millisecond timestamp. The adapter converts it to a calendar date for daily bucketing. The adapter converts `sessionStartTime` to the local machine timezone for daily bucketing. Unix millisecond timestamps are stored and processed in UTC. For daily bucketing, timestamps are converted from UTC to the local machine timezone at display time (Node.js `Intl`/`Date` local timezone). For API sources (OpenAI, Anthropic), calendar-day boundaries are as returned by the provider API (UTC-based) and are converted to local machine timezone for display.
- ASSUMPTION: The analysis period for GitHub Copilot defaults to the last 30 calendar days from the current date, matching the API source default. Sessions whose `sessionStartTime` predates this window are ignored.
- The Copilot adapter uses the same analysis window as any connected API sources. When only local-file sources are connected, a global date range picker (default: last 30 days) is displayed at the top of the connection step and applies to all local-file sources.
- If multiple API sources are connected with different date ranges, Copilot uses the union of those ranges (earliest start date to latest end date).
- ASSUMPTION: The adapter MUST resolve the home directory using `os.homedir()` (Node.js built-in, cross-platform). The base path is `path.join(os.homedir(), '.copilot', 'session-state')`. Literal `~/` paths must not be passed to file system calls.
- ASSUMPTION: `usage.reasoningTokens` is a subset of `usage.outputTokens` (already counted therein) and is not additive. If this assumption is incorrect, §7.2's Copilot formula must be updated to add `reasoningTokens` additively.
- VERIFIED: `usage.inputTokens` is the TOTAL prompt token count — it includes all input tokens (cached and uncached). `cacheReadTokens` and `cacheWriteTokens` are subsets of `inputTokens`, not additive fields. This mirrors OpenAI's model, not Anthropic's. Confirmed empirically from real session file data: `inputTokens` (221,203) = `tokenDetails.input.tokenCount` (46,611, non-cached residual) + `cacheReadTokens` (174,592). The session file also contains a separate `tokenDetails` object with `input.tokenCount` (non-cached only) and `cache_read.tokenCount` for implementers who need the breakdown.

---

### Source 5: ChatGPT Export

**Source ID:** `chatgpt_export`

**Connection:** User-supplied file upload. The user exports their ChatGPT data from ChatGPT Settings → Data Controls → Export data, then selects or drops the `conversations.json` file into the ChatGPT Export source card. No ChatGPT credentials are entered into Promptly, and Promptly does not call a ChatGPT usage or billing API.

**File read:**
- Uploaded `conversations.json`: ChatGPT account export file containing conversation records, message nodes, timestamps, role metadata, model identifiers where present, and conversation content. Promptly uses only structural metadata required for aggregate metrics. Prompt and response text is not surfaced, semantically analyzed, or included in exports.

**Data returned:**
- Conversation count over the selected analysis period
- Message count over the selected analysis period
- Daily activity: conversation count by calendar date
- Model mix: conversation count by model identifier when model metadata is present; otherwise an "unknown" bucket
- Estimated token volume derived from message character/word counts × an assumed average token-to-word ratio (OQ-19 defers the specific constant to engineering)
- Estimated relative cost in USD derived from estimated token volume × LiteLLM price map where model pricing is available
- Trend status and spike callout based on daily conversation volume, not actual spend

**Not available:**
- Actual token counts
- Actual spend or billing data
- Cache savings
- Session cost
- Dominant model cost share
- Per-message prompt or response content analysis

**Cost estimate formula:**

ChatGPT Export does not include token counts or billing data. The adapter computes an estimated relative cost for sorting, charting, and comparison only:

```text
estimated_relative_cost_usd = Σ estimated_tokens_model_m × blended_price_per_token_m
```

Where:
- `estimated_tokens_model_m` is the adapter's estimated token volume for conversations attributed to model `m`, derived from message character/word counts × an assumed average token-to-word ratio (the specific constant is deferred to engineering as OQ-19; document the assumption in export caveats).
- `blended_price_per_token_m` is derived from the LiteLLM price map for model `m`. If input/output split is not inferable from the export, use a conservative blended rate and document the assumption in the export caveats.
- If model metadata is missing or the model is absent from the LiteLLM price map, the conversation remains in the activity and count metrics, but the cost estimate is labeled with reduced confidence and the affected model is grouped under `unknown` or `price unavailable` as appropriate.

**Tier classification:** Tier C (aggregate/export-derived estimates only; no token counts and no billing data)

**Assumptions:**
- ASSUMPTION: The uploaded file is the `conversations.json` file from a ChatGPT account export and contains parseable conversation records.
- ASSUMPTION: ChatGPT export schema may change. If expected conversation/message fields are missing, the adapter returns a parse error rather than guessing from prompt text.
- ASSUMPTION: Model identifiers are not guaranteed to be present for every conversation. Missing model identifiers are grouped as `unknown`.
- ASSUMPTION: Estimated token volume and estimated relative cost are directional. They are suitable for ranking and rough comparison, not billing reconciliation.
- ASSUMPTION: ChatGPT does not provide a personal usage or billing API for this data. The Tier C freshness prompt is the correct nudge, not an Admin API upgrade prompt.

**Error states:**
- No file selected: card remains unconfigured.
- File is not parseable JSON: "This file could not be parsed as JSON. Upload the `conversations.json` file from your ChatGPT data export."
- File is parseable JSON but does not match expected ChatGPT export shape: "This doesn't look like a ChatGPT export. Upload the `conversations.json` file from ChatGPT Settings → Data Controls → Export data."
- File contains no conversations in the selected period: "No ChatGPT conversations found for the selected period. Try a wider date range or re-export your data."

---

## 6. Verbosity Tier Engine

### Tier definitions

Four MVP sources — Claude Code, OpenAI, Anthropic, and GitHub Copilot — are classified as Tier B. ChatGPT Export (`chatgpt_export`) is classified as Tier C because it provides aggregate/export-derived estimates only: conversation/message counts, timestamps, model hints where present, and estimated relative cost, but no actual token counts or billing data. Tier A is defined for architectural completeness and future extensibility (for proxy- or SDK-based ingestion that would expose full per-request trace data); it contains no MVP sources.

| Tier | Name | Data available | Sources that map to this tier |
|---|---|---|---|
| A | Full Trace | Per-request rows with prompt text, completion text, model, tokens, cost, latency | None in MVP (reserved for future proxy/SDK ingestion) |
| B | Token + Cost | Daily aggregates by model: tokens (input/output/cached), dollar cost | Claude Code (Anthropic CLI), OpenAI API, Anthropic API, GitHub Copilot |
| C | Aggregate / Estimated | Aggregate counts only, estimated token volume, estimated relative cost; no billing API and no actual token counts | ChatGPT Export (`chatgpt_export`) |

Tier A is defined in the system for architectural completeness but has no MVP data sources that produce it. Future adapter modules for proxy/SDK ingestion would map to Tier A.

### Tier detection

Tier detection is automatic and per-source. When a source is processed, the adapter assigns the tier based on what fields are present in the returned data:
- If `metrics.total_spend_usd` is non-null AND actual token fields (`input_tokens`, `output_tokens`) are non-null AND data is bucketed by day: Tier B
- For GitHub Copilot: if `~/.copilot/session-state/` exists and contains at least one `events.jsonl` file with a `session.shutdown` event that includes a non-empty `modelMetrics` object: Tier B
- For ChatGPT Export: if `source_id == "chatgpt_export"` and a valid uploaded `conversations.json` file is parsed into conversation/message counts, timestamps, and optional model identifiers: Tier C
- If all token fields are estimated or only aggregate counts are available: Tier C
- If the adapter fails to fetch data (network error, invalid credentials, HTTP 4xx/5xx, malformed local file, malformed uploaded file): the source is marked as `error` with a null tier. The source card displays the error message and is excluded from all metric aggregations. The tier column for this source in the export shows `null`.

The tier label is displayed on each source card in the results dashboard.

### What each tier unlocks (MVP insight set)

**Tier B unlocks (backend capabilities):**
- Estimated spend for the analysis period — displayed as primary cost signal
- Cross-source daily spend roll-up — powers the spend trend chart
- Spend by tool (share) — powers the spend breakdown bar
- Effective cost per million tokens — shown as inline sub-line
- Trend status (available / insufficient data / no prior spend) — explicit, never silently hidden
- Spike callout (when peak day ≥ 2× average AND ≥3 days of data)
- Model cost share — horizontal mini-bar chart with dominant model sentence in plain language
- Plain-language efficiency signal (input-heavy / output-heavy / balanced)
- Cache savings in dollars (where computable; not displayed as a percentage)
- Average session cost for local session sources (Claude Code, GitHub Copilot); unavailability note for OpenAI and Anthropic
- Average daily spend and 7-day rolling average
- Peak spend day
- All Tier B recommendations (see §8)
- Month-over-month spend change (when ≥45 days of data available) — §7.12
- Claude Code: session count — §7.14
- GitHub Copilot: per-model request count, reasoning token breakdown — §7.16–§7.17

Raw token diagnostics (input/output totals, cache fractions as percentages, average tokens per session) remain available in the JSON export and as supporting data but are not primary analysis-page UI content.

**Tier C unlocks (MVP aggregate/export-derived estimates):**
Tier C is active in MVP for ChatGPT Export. When ChatGPT Export is connected, it unlocks:
- Estimated token volume for the analysis period (derived from conversation/message counts and documented assumptions)
- Estimated relative cost in USD (using model identifiers where present and the LiteLLM price map)
- Conversation count and message count
- Average conversation length in turns
- Model mix by conversation count where model identifiers are present
- Daily activity sparkline based on conversation volume
- Trend status and spike callout based on daily conversation volume
- Tier C-specific recommendations RC1, RC3, RC4a, RC4b, RC5, and conditional RC6 (see §8)
- Data-freshness prompt reminding the user to re-export ChatGPT data because no ChatGPT usage API is available

### Upgrade and freshness nudge system

The Tier C nudge system has two variants:

1. **Tier B upgrade nudge (only when a real richer-data path exists):** When a Tier C source has a Tier B path, the nudge format is: "This data is at [Tier C: Estimated]. Connect [source_name] via its Admin API to see actual token counts and dollar costs." (Where `[source_name]` = the human-readable display name for the source as defined in §5's Source sections.)

2. **ChatGPT Export data-freshness prompt:** ChatGPT Export does not have a personal Admin API or usage API. Do not show the Admin API upgrade template for `chatgpt_export`. Instead show: "ChatGPT doesn't provide a usage API. Re-export your data from ChatGPT settings to keep estimates current."

The nudge does not suggest proxy/SDK instrumentation in MVP (that would be a Tier A nudge, reserved for post-MVP).

No source panel ever shows an empty state. If data is available but sparse (e.g., only 2 days in a 30-day window), the chart shows the 2 data points with a note: "Only [N] days of data available in this period." (Where `[N]` = count of calendar days with available data in the selected period.)

If a connected source returns zero events for the selected date range (source successfully connected with data available, but no usage events fall within the selected period), the panel displays: "No usage found for [source_name] between [start_date] and [end_date]. Try a different date range." (Where `[source_name]` = same human-readable display name as above; `[start_date]` and `[end_date]` = the start and end of the user-selected analysis period in `YYYY-MM-DD` format.) The source remains "connected" and is not counted as an error.


---

## 7. Analysis and Insight Definitions

All metrics are defined below with their formula and the minimum tier at which they apply.

### Source-card field inventory

Promptly uses a uniform card model for all connected sources. Tiers are an internal data-quality classification; externally, every source appears as a source card in the same narrative results section. Each card shows the fields available for that source and omits or marks unavailable fields as `N/A` with a reason.

| Field | Available for Tier A | Available for Tier B | Available for Tier C | Notes |
|---|---:|---:|---:|---|
| Estimated spend / relative cost | Yes | Yes | Yes | Tier C value is estimated from conversation activity and must be labeled "estimated from conversation activity." |
| Actual billing spend | Yes, when trace includes cost | Yes for OpenAI/Anthropic billing APIs; computed cost for Claude Code; provider request cost for GitHub Copilot | N/A | Tier C has no billing API. |
| Estimated token volume | Yes | Actual token count | Yes | Tier C token volume is estimated, not actual. |
| Conversation/session count | Yes, when trace/session rows exist | Claude Code and GitHub Copilot session count; N/A for daily API aggregates | Yes | ChatGPT Export shows conversation count. |
| Model mix breakdown | Yes | Yes | Yes, where model identifiers are present | Tier C model mix is by conversation count, not cost share. |
| Dominant model cost share | Yes | Yes | N/A | N/A — no per-model billing data for Tier C. |
| Input/output efficiency signal | Yes | Yes | N/A | Tier C has no reliable input/output token split. Conversation-efficiency recommendations cover Tier C instead. |
| Cache savings | Yes, where cache fields exist | Anthropic and Claude Code where computable; not shown for OpenAI or GitHub Copilot unless defensible | N/A | N/A — no cache billing data in ChatGPT Export. |
| Average session cost | Yes, when session cost exists | Claude Code and GitHub Copilot; OpenAI/Anthropic show unavailability note | N/A | N/A — no billing API. |
| Average conversation length | Optional | N/A unless source exposes conversations | Yes | ChatGPT Export shows average turns per conversation. |
| Daily sparkline | Yes | Daily spend sparkline | Yes | Tier C uses daily activity/conversation volume, not actual spend. |
| Recommendations | Yes, future | R1–R3 | RC1, RC3, RC4a, RC4b, RC5, conditional RC6 | Tier C recommendations do not appear in top money-saving slots unless a dollar saving is computable. |
| Data nudge | Optional | Optional richer-tier nudge where applicable | Yes | ChatGPT Export shows the data-freshness prompt, not an Admin API prompt. |

### Cross-source metrics (aggregate, shown at top of results)

**7.1 Total estimated spend (USD)**
- Display intent: Answers the question "How much did I spend this period?"
- Definition: Sum of spend contributions across all connected sources. For OpenAI and Anthropic, cost is the billing-API total for the analysis period. For Claude Code, cost is computed from token counts × LiteLLM price map. For GitHub Copilot, cost is derived from `requests.cost` summed across all `modelMetrics` entries in `session.shutdown` events (covers Chat, CLI, cloud agent, and Spaces interactions only; code completions are not tracked in these events). For ChatGPT Export, contribution is `estimated_relative_cost_usd`, estimated from conversation/message counts, model identifiers where present, and LiteLLM price-map assumptions.
- Formula: `total_estimated_spend_usd = sum(estimated_spend_usd for Tier B sources) + sum(estimated_relative_cost_usd for Tier C sources)`.
- Actual-spend companion field: `total_actual_spend_usd = sum(actual_or_computed_spend_usd for Tier B sources only)`. ChatGPT Export does not participate in `total_actual_spend_usd`.
- Display: "Estimated spend: $X.XX". If any Tier C contribution is included, visually flag the mixed total (for example, `~$X.XX` or an asterisk) and include copy such as "Includes ChatGPT Export estimated from conversation activity." The label "estimated" is a conservative product choice: OpenAI and Anthropic provide precise billing data; Claude Code and GitHub Copilot compute cost locally from token counts and model prices; ChatGPT Export estimates relative cost from aggregate export data. Source-level accuracy details are in the project README and export assumptions.
- Tier: B and C

**7.2 Total tokens consumed**
- Display intent: Provides volume context alongside estimated spend. Shown as a supplemental sub-line, not a primary KPI.
- Definition: Sum of actual tokens across all sources that expose token-level data. The four Tier B MVP sources report token counts. ChatGPT Export does not report actual tokens; it reports `estimated_token_volume` separately as a Tier C metric and must be labeled estimated wherever displayed.
- Display format: `X.XM tokens · $Y.YY per million tokens` — shown as visible inline text in the analysis header. The per-million-token rate is visible text (not a tooltip), as an accessibility requirement. See §7.3a for the effective cost per million tokens formula.
- Formula (provider-aware):
- **OpenAI:** `input_tokens + output_tokens` — `cached_input_tokens` is a subset of `input_tokens` and is already counted; do not add it separately.
- **Anthropic:** `input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens` — cache fields are additive buckets (not subsets of `input_tokens`). Source: Anthropic API, confirmed in official Anthropic SDK (`message.py`): *"Total input tokens in a request is the summation of `input_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens`."*
- **Claude Code:** Same formula as Anthropic: `input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens`.
- **GitHub Copilot:** `usage.inputTokens + usage.outputTokens` summed across all `modelMetrics` entries — `cacheReadTokens` and `cacheWriteTokens` are subsets of `inputTokens` (already counted). See §5 Source 4.
- Display: Shows actual token counts from all token-reporting Tier B sources. If Tier C estimated token volume is also displayed, it must be visually separated or labeled as estimated (for example, "plus ~N estimated ChatGPT tokens"). Do not silently combine actual and estimated token counts without a label.
- Tier: B for actual token total; C for labeled estimated token volume

**7.3 Analysis period**
- Display intent: Makes the analysis window explicit so the user knows what time range is covered.
- Definition: Date range covered by the analysis, per source.
- Display: Always visible in the page header at all times. Format: "[start date] – [end date]" (e.g., "Jul 1 – Jul 4, 2026"). When sources have different date ranges, the displayed range is the union (earliest start date to latest end date). Individual source date ranges are shown on each source card.
- **Mandatory:** The analysis period must appear in the page header at all times. It must never be hidden or omitted, even when sources have identical date ranges.
- Tier: B and C

**7.3a Effective cost per million tokens**
- Display intent: Answers "Am I getting value for my spend?" — provides a single number to compare efficiency across periods and tools with actual token counts.
- Definition: Total Tier B estimated spend divided by total actual Tier B tokens, expressed per million tokens. Tier C estimated token volume is excluded from this calculation unless the UI explicitly labels the result as a mixed actual/estimated calculation.
- Formula: `effective_cost_per_million_tokens = total_estimated_spend_usd_tier_b / (total_actual_tokens_tier_b / 1,000,000)`. Omit when total actual Tier B tokens are zero.
- Display: Shown as visible inline text alongside the token count in the analysis header — `X.XM tokens · $Y.YY per million tokens`. This is the same sub-line defined in §7.2. The value must be readable without hover or focus (accessibility requirement; no tooltip dependency). If only ChatGPT Export is connected, show `N/A — no actual token counts in ChatGPT export` instead of computing a misleading rate.
- Tier: B

**7.3b Cross-source daily spend roll-up**
- Display intent: Shows how spending varies day by day across all tools combined — powers the "Is your spending trending?" chart.
- Definition: Sum of spend contributions across all connected sources, bucketed by calendar date. Tier B sources contribute daily actual/computed spend. ChatGPT Export contributes daily estimated relative cost when it can be allocated from daily conversation activity; otherwise it contributes to the period total and the chart labels ChatGPT as period-level estimated only.
- Display: Used as the data series for the cross-source spend trend line chart. X-axis = date, Y-axis = estimated spend (USD). Tier C-derived points must be visually flagged or footnoted as estimated from conversation activity.
- Tier: B and C

**7.3c Spend by tool (share)**
- Display intent: Answers "Where is my money going?" — shows each source's share of total estimated spend at a glance.
- Definition: Per-source spend contribution as a percentage of `total_estimated_spend_usd` across all connected sources. Tier B sources use actual/computed spend. ChatGPT Export uses `estimated_relative_cost_usd` and is marked estimated-only.
- Display: Horizontal bars with tool name, dollar amount, estimate marker where applicable, and percentage of total. Sorted highest to lowest. Tier C bars must be visually flagged (for example, hatched fill, asterisk, and/or `~` prefix) and labeled "estimated from conversation activity." Powers the "Where is your money going?" section.
- Tier: B and C

**7.3d Trend status**
- Display intent: Makes comparisons explicit — including the case where data is insufficient — so the user always knows whether a trend is available.
- Definition: An explicit status object with three states: `available` (change is computable), `insufficient_data` (fewer than 45 daily spend data points for Tier B spend trends, or insufficient daily activity data for Tier C activity trends), `no_prior_spend` (no spend in the prior period for Tier B; no prior activity for Tier C). Trend status must always be present; the UI may never silently hide it.
- Display:
  - `available`: Show MoM direction badge (e.g., "↑ 12% vs last month").
  - `insufficient_data`: Show note — "Not enough data for a trend. Run analysis on 2+ months of data to see month-over-month trends."
  - `no_prior_spend`: Show note — "No spend in the prior period to compare."
- Tier: B and C

**7.3e Spike callout**
- Display intent: Flags unusually expensive or unusually active days so the user can investigate what drove the spike.
- Definition: For Tier B spend data, when the peak daily spend is ≥ 2× the average daily spend AND there are at least 3 days of spend data in the analysis window, surface a spike callout. For ChatGPT Export, apply the same threshold to daily conversation volume instead of spend.
- Formula: Tier B spike triggers when `peak_daily_spend >= 2 × avg_daily_spend` AND `days_with_data >= 3`. Tier C ChatGPT Export spike triggers when `peak_daily_conversation_count >= 2 × avg_daily_conversation_count` AND `days_with_data >= 3`.
- Tier B callout message: "Most expensive day: [date] — [N]× your average."
- Tier C callout message: "ChatGPT conversation volume spiked [N]× above your average on [date]."

  Where:
  - `[date]` = calendar date of the peak spend or activity day, formatted per the analysis-period display convention.
  - `[N]` = ratio of peak daily spend (or conversation count) to average daily spend (or conversation count), displayed as a decimal multiple (e.g., "2.6×"). Exact display precision (decimal places) is specified in the engineering design.
- Threshold rationale: 2× is the minimum meaningful signal above normal day-to-day noise; a spike at exactly 2× average is clearly above typical variation. The 3-day minimum prevents single-day or two-day analyses from always triggering (a single day is by definition its own average). Both thresholds are reviewable as usage data accumulates.
- Display: Shown as a callout in the "Is your spending trending?" section, immediately below the trend chart.
- Tier: B and C

### Common per-source metrics (Tier B sources)

Each metric in this block applies to connected Tier B sources. Tier C source-card fields are defined in §7.19–§7.25. Where a source does not support a specific metric, a source-support note explains what is shown instead.

**7.4 Per-source total spend (actual USD)**
Applies to: Tier B sources (Claude Code, OpenAI, Anthropic, GitHub Copilot).
- Definition: Total actual cost for the analysis period, per source. Cost is derived differently depending on the source, but the concept — total actual cost for the analysis period — is universal. For OpenAI and Anthropic, cost is returned directly from the provider billing API (Costs API). For Claude Code, cost is computed from token counts × model price using the LiteLLM price map (no provider API call is made). For GitHub Copilot, cost is derived from session request cost data in local session event files.
- Formula: `sum(cost_usd_per_day)` over the selected date range (OpenAI and Anthropic); sum of tokens × price per session (Claude Code); sum of per-model request cost across all qualifying session events (GitHub Copilot).
- Display: Labeled as "Estimated spend: $X.XX" across all sources. Source-level accuracy sub-note (documented in README and export caveats): "Billing API total" for OpenAI and Anthropic; "Computed from tokens × LiteLLM price map" for Claude Code; "Local session request costs" for GitHub Copilot. This is a daily aggregate total; per-model cost breakdown is estimated in §7.6.
- Note (GitHub Copilot): cost is derived from premium request cost data in local session event files.
- Tier: B

**7.5 Daily spend trend**
Applies to: Tier B sources (Claude Code, OpenAI, Anthropic, GitHub Copilot).
- Definition: Time series of daily cost in USD. The four Tier B sources produce daily or session-day cost data that feeds this trend: OpenAI and Anthropic provide calendar-day buckets from the Costs API; Claude Code sessions are bucketed by session start day; GitHub Copilot sessions are bucketed by session start day from local event files. For ChatGPT Export daily activity volume, see §7.24.
- Chart type: Line chart, x-axis = date, y-axis = USD.
- Tier: B

**7.6 Model cost share**
Applies to: Tier B sources (Claude Code, OpenAI, Anthropic, GitHub Copilot).
- Note: GitHub Copilot exposes additional token categories per model including cache-read tokens, cache-write tokens (informational only — not a billing charge), and reasoning tokens. Other sources expose input and output tokens per model.
- Definition: For each model that appears in the usage data, its estimated percentage contribution to total spend.
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
  (If the denominator `Σ model_cost_estimate(x)` is zero for all models in a source, `model_cost_share` is undefined for that source and the model cost breakdown chart is suppressed for that source.)
  ```
  Where:
  - `input_tokens_m` and `output_tokens_m` are summed over the analysis period from the Usage API (for OpenAI), the Anthropic Usage Report API `/v1/organization/usage_report/messages` (for Anthropic), or Claude Code local session JSONL files under `~/.claude/projects/` (for Claude Code)
  - `cache_creation_input_tokens_m` and `cache_read_input_tokens_m` are summed over the analysis period from the Anthropic Usage Report API (for Anthropic) or Claude Code local session JSONL files under `~/.claude/projects/` (for Claude Code); these fields are not present for OpenAI or GitHub Copilot
  - `input_cost_per_token_m`, `output_cost_per_token_m`, `cache_creation_input_token_cost_m`, and `cache_read_input_token_cost_m` are from the LiteLLM price map (§11)
  - If the LiteLLM cache price fields are absent for a model, fall back to the two-term formula for that model and note the estimate excludes cache costs
  - When a model's cost share rounds to zero, it is shown as '<0.1%' rather than 0% to preserve its presence in the breakdown.
- Note: This is a price-weighted estimated cost breakdown. For OpenAI and Anthropic/Claude Code, the chart is labeled "Estimated model cost breakdown." For GitHub Copilot, actual `requests.cost` values are used directly and the chart is labeled "Actual model cost breakdown."
- Chart type: Horizontal bar chart (not pie chart). Each model is a horizontal bar showing its estimated cost share as a percentage of source total. Models with very small shares are grouped as "Other."
- Dominant model sentence: The highest-spend model is surfaced as a plain-language sentence: "Most of your [source] spend went to [Model X] ([Y]%)." This sentence is displayed prominently above the model bars.
- Tier: B

**7.7 Input/output efficiency signal**
Applies to: Tier B sources (Claude Code, OpenAI, Anthropic, GitHub Copilot).
- Display intent: Translates the input/output token ratio into a plain-language characterization of how the user is spending — without requiring them to interpret a raw ratio number.
- Definition: A categorical signal derived from the aggregate input-to-output token ratio. The underlying ratio formula is: `input_output_ratio = total_input_tokens / total_output_tokens` (using provider-aware input token counts — see notes below).
- Signal categories and display text:
  - `input_heavy` (ratio > 8): "Most of your cost came from sending context, not getting answers." — typically triggers R3.
  - `output_heavy` (ratio < 1): "You're generating a lot — typical for coding or writing workflows."
  - `balanced` (ratio 1–8): No special callout displayed.
- **Note for Anthropic and Claude Code:** For this ratio, total input tokens includes all three additive input token categories: standard input tokens, cache creation tokens, and cache read tokens (cache fields are additive — see §7.2). Using standard input tokens alone would understate actual LLM input volume for sessions with active prompt caching.
- **Note for GitHub Copilot:** The total input token count already includes all prompt tokens (cached and uncached). Use the total input token count directly — do not add cache read or cache write tokens separately, as they are already counted within the total. See §5 Source 4.
- **Note for OpenAI:** Use total input tokens directly — cached input tokens are already included in the input token count and must not be added separately.
- The raw ratio value is still computed and used internally for R3 trigger evaluation and for JSON export. It is not displayed as a primary metric on the analysis page.
- Tier: B

**7.8 Cache savings**
Applies to: Anthropic and Claude Code (where dollar savings are computable from token counts and LiteLLM prices). Not displayed for OpenAI (caching is fully automatic, not configurable or actionable by the developer). Not shown for GitHub Copilot (the `requests.cost` field is provider-computed and already inclusive of caching; a defensible dollar savings estimate is not currently available from the available data).
- Display intent: Shows the user the tangible dollar value of prompt caching — "you saved $X this period" — rather than a raw cache-hit rate percentage.
- **Analysis-page display:** "This tool reuses repeated context automatically — you saved ~$Y this period." Shown only when computed savings are > $0. Not displayed as a percentage.
- **Internal / export use:** The underlying cache fraction values are computed as below and retained for R1 trigger evaluation and JSON export. They are not shown as primary metrics on the analysis page.
- Cache fraction formula (Anthropic): `cache_fraction_anthropic = cache_read_input_tokens / (input_tokens + cache_creation_input_tokens + cache_read_input_tokens)`
  - Data source: Anthropic Usage API
- Cache fraction formula (Claude Code): `cache_fraction_claude_code = cache_read_input_tokens / (input_tokens + cache_creation_input_tokens + cache_read_input_tokens)`
  - Data source: Claude Code local session files (`~/.claude/`)
- When both Anthropic and Claude Code are connected, the system computes cache fractions independently for each source and displays each on its respective source card.
- Note (GitHub Copilot): Cache fraction for GitHub Copilot is tracked internally but not displayed on the analysis page. The engineering design specifies the per-source formula.
- Realized savings formula (backward-looking): `savings_[source] = cache_read_input_tokens_[source] * (standard_input_price_[source] - cache_read_price_[source])` where `[source]` ∈ {`anthropic`, `claude_code`} matching the source whose data is used; `cache_read_input_tokens_[source]` = sum of `cache_read_input_tokens` from the respective source's data, `standard_input_price_[source]` = `input_cost_per_token` and `cache_read_price_[source]` = `cache_read_input_token_cost` from the LiteLLM price map.

  **Note:** `standard_input_price_[source]` and `cache_read_price_[source]` are source-aggregate aliases (token-volume-weighted average across models for that source):

  `standard_input_price_[source] = sum(cache_read_input_tokens_m * input_cost_per_token_m) / sum(cache_read_input_tokens_m)`

  `cache_read_price_[source] = sum(cache_read_input_tokens_m * cache_read_input_token_cost_m) / sum(cache_read_input_tokens_m)`

  If `sum(cache_read_input_tokens_m) == 0` for the source, set `savings_[source] = 0` and suppress the realized savings display for that source. For the authoritative per-model `_m` contract using the same LiteLLM fields, see §8 R1 Estimated savings formula. For forward-looking savings potential, see §8 R1.

  (Cache write overhead is not netted here — write costs are already sunk for tokens that have been cached. The forward-looking formula in §8 R1 nets write overhead because those costs have not yet been incurred.)
- Tier: B (Anthropic, Claude Code, and GitHub Copilot)

**7.9 Average daily spend**
Applies to: Tier B sources (Claude Code, OpenAI, Anthropic, GitHub Copilot).
- Definition: Mean of daily cost values over the analysis period.
- Formula: `avg_daily_spend = total_spend_usd / number_of_days_with_data`
- Tier: B

**7.10 Peak spend day**
Applies to: Tier B sources (Claude Code, OpenAI, Anthropic, GitHub Copilot).
- Definition: The calendar day with the highest single-day cost in the analysis period.
- Formula: `argmax(cost_usd_per_day)`
- Display: Date and amount.
- Tier: B

**7.11 7-day rolling average spend**
Applies to: Tier B sources (Claude Code, OpenAI, Anthropic, GitHub Copilot).
- Definition: Rolling average of daily cost over the last 7 days of the analysis period.
- Formula: `avg(cost_usd_per_day[last_7_days])`
- Tier: B

**7.12 Month-over-month spend change**
Applies to: Tier B sources (Claude Code, OpenAI, Anthropic, GitHub Copilot).
- Definition: Percentage change in spend from the prior 30-day period to the current 30-day period, if sufficient data exists.
- Formula: `MoM_change = (current_30d_spend - prior_30d_spend) / prior_30d_spend * 100`
- Only shown if the analysis period includes at least 45 daily data points.
- Tier: B

**7.13 Average daily output tokens per model (derived)**
Applies to: Tier B sources (Claude Code, OpenAI, Anthropic, GitHub Copilot).
- Definition: Average output tokens per calendar day for a given model, over the analysis period. Used by the R2 recommendation trigger.
- Formula: `output_tokens_per_day(model) = sum(output_tokens_for_model) / number_of_days_with_data`
- This is a derived value computed during recommendation evaluation; it is not displayed directly in the UI.
- Tier: B

**7.14 Session count**
Applies to: Claude Code and GitHub Copilot (local-file sources). Not applicable to OpenAI and Anthropic — these sources return daily aggregated usage data without session-level granularity; individual sessions are not visible.
- Definition: Number of distinct sessions found in local data files for the analysis period.
- Formula (Claude Code): `count(sessions)` across all project directories under `~/.claude/projects/`
- Formula (GitHub Copilot): `count(sessions with valid session.shutdown events)` across all subdirectories under the session-state root.
- Display: "N sessions analyzed" (shown separately on each source's panel)
- Session count is displayed separately on each source's panel. No combined count across sources is shown — Copilot and Claude Code sessions represent different interaction types and cannot be meaningfully combined.
- Note (GitHub Copilot): Session count reflects qualifying session events found in local session event files.
- Tier: B

**7.15 Average tokens per session**
Applies to: Claude Code and GitHub Copilot (local-file sources). Not applicable to OpenAI and Anthropic — these sources do not expose session-level granularity.
- Definition: Mean total tokens (input + output) per session over the analysis period.
- Formula (Claude Code): `avg((input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens) per session)` — cache fields are additive for Claude Code (see §7.2).
- Formula (GitHub Copilot): `mean(Σ(inputTokens + outputTokens) per session)` across all models in each qualifying `session.shutdown` event — `cacheReadTokens` and `cacheWriteTokens` are subsets of `inputTokens`, not additive.
- Display: "~N tokens per session (average)" — retained as a secondary/diagnostic metric; the primary user-facing session metric is average session cost (§7.18).
- Tier: B

### Source-specific metrics

The following metrics are unique to a specific source and have no conceptual equivalent in the other Tier B sources.

**7.16 Per-model request count**
- Source: GitHub Copilot only
- The number of discrete premium AI interactions made to each model during the analysis period. This is a distinct count separate from token volume. Other Tier B sources aggregate usage by tokens only; GitHub Copilot is the only P0 source that exposes a per-model request count separately from token volume.

**7.17 Reasoning token breakdown**
- Source: GitHub Copilot only
- Reasoning tokens are a distinct token category produced by certain Copilot models during internal chain-of-thought processing. They are shown per model alongside regular output tokens. Reasoning tokens are a subset of output tokens — they are not additional tokens on top of the output count. No other P0 Tier B source exposes a separate reasoning token category.

**7.18 Average session cost**
Applies to: Tier B sources (Claude Code, OpenAI, Anthropic, GitHub Copilot) — displayed differently based on session-level data availability.
- Display intent: Answers "How much does a typical AI session cost me?" — makes costs tangible at a usage-unit level.
- For Claude Code and GitHub Copilot (local session sources): "Each session costs you on average $X." Computed as `estimated_spend_usd / session_count` when session count > 0.
- For OpenAI and Anthropic: Display "Session-level cost not available from provider data." This message is always shown for these sources — it is never omitted and may not be substituted with an average daily spend figure or any other proxy. Provider APIs return daily aggregates without session-level granularity.
- Tier: B

### Tier C source metrics (ChatGPT Export)

The following metrics apply to the ChatGPT Export source only. They are shown on the ChatGPT Export source card using the uniform per-tool card model defined in §7 and §4 Step 5.

**7.19 Total conversations**
- Definition: Count of distinct conversation objects in the uploaded `conversations.json` file that fall within the analysis date range.
- Display: "N conversations" on the ChatGPT Export source card.
- Tier: C

**7.20 Total messages**
- Definition: Count of all message nodes across analyzed conversations. Includes user and assistant turns.
- Display: "N messages" on the ChatGPT Export source card.
- Tier: C

**7.21 Active days**
- Definition: Count of calendar days within the analysis period on which at least one conversation was created (based on `create_time` or equivalent timestamp in the export file).
- Display: "Active N of M days" on the ChatGPT Export source card (where M is total days in the analysis range).
- Tier: C

**7.22 Models identified**
- Definition: Distinct model identifiers found in the export file's `model` fields (or equivalent message metadata), where present. Some ChatGPT export formats omit the model field; this metric is suppressed when no model identifiers are available.
- Display: Comma-separated list of model names on the source card, or "Model data not available in export" when absent.
- Tier: C

**7.23 Estimated relative cost**
- Definition: Directional cost estimate for the analysis period, derived from estimated token volume (§7.25) × LiteLLM price-map rate for identified models. Not billing-reconcilable. Labeled as estimated throughout.
- Display: "~$X.XX estimated" on the source card. Always includes a label such as "estimated from conversation activity" so users understand this is not billing data.
- Tier: C

**7.24 Daily conversation activity**
- Definition: Time series of conversation count per calendar day, derived from conversation `create_time` or equivalent timestamps in the export. Analogous to §7.5 daily spend trend for Tier B sources but uses conversation activity volume rather than spend.
- Display: Line chart on the ChatGPT Export source card, x-axis = date, y-axis = conversation count.
- Tier: C

**7.25 Estimated token volume**
- Definition: Approximation of total token volume across analyzed conversations, derived from message character/word counts × an assumed average token-to-word ratio. This is a rough proxy only and is labeled as estimated. Deferred to engineering design for the estimation constant (OQ-19).
- Display: "~N tokens estimated" on the source card, with label. Must not be combined silently with Tier B actual token counts.
- Tier: C

---

## 8. Recommendation Engine

Recommendations are generated after all metrics are computed. Each recommendation has a trigger condition (the data condition that must be true for it to fire), a severity level (High, Medium, Low), a title, a body (one to two sentences), and a supporting metric reference.

A recommendation is shown only if its trigger condition is met. If no recommendations fire, the section displays: "No optimization opportunities detected based on the data available. Connect additional sources or richer data tiers for deeper analysis."

All recommendations are computable purely from token counts, costs, timestamps, and cache flags — no prompt or response content is required.

Tier B sources (Claude Code, OpenAI, Anthropic, GitHub Copilot) are eligible for R1, R2, and R3. R4 has been removed from scope (see §8 R4 and §12). ChatGPT Export (Tier C) is eligible for Tier C recommendations RC1, RC3, RC4a, RC4b, RC5, and RC6. See the Tier C recommendations section below for full definitions.

**Recommendation presentation — progressive disclosure**

Recommendations appear at two levels of depth:

**Top money-saving slot (compact, max 2):**
Appears under the "Where is your money going?" spend-by-tool bar. Shows: recommendation headline + specific dollar saving (with percentage context where applicable). Compact — 1–2 lines. No explanation. The spend breakdown above provides shoulder context. Top slot cards are **clickable navigation anchors** — clicking scrolls to and expands the relevant tool card, landing directly on the full recommendation.

R3's approximate savings estimate (`~$[S] (approximate)`) qualifies for a top money-saving slot. The approximate label is retained in the top slot display. If multiple sources trigger R3, the source with the highest estimated savings `[S]` is the top-slot candidate; if only one source triggers R3, that source's name appears in the top slot headline.

Tier C recommendations (RC1, RC3, RC4a, RC4b, RC5, RC6) are NOT eligible for top money-saving slots. They do not have computable dollar savings. They appear in the ChatGPT Export source card only.

**Per-tool card (full context):**
Appears at the bottom of the relevant expanded tool card, after the data that explains it (model breakdown, efficiency signal, cache savings). Shows: what triggered the recommendation, plain-language explanation of why, and the savings estimate with full context and caveats.

**Rules:**
- A recommendation that appears in a top slot also appears in full in its per-tool card — this is intentional progressive disclosure, not duplication.
- If more recommendations qualify for top slots than fit (max 2), overflow appears in its per-tool card only (not dropped).
- Top slots are sorted by estimated dollar saving descending; ties broken by severity (High → Medium → Low).
- Generic advice not produced by the recommendation engine is prohibited in both locations.

Template variables (`[X]`, `[N]`, `[Y]`, `[Model name]`, `[cheaper model]`, `[source_name]`, `[savings_estimate]`) are card-scoped: each recommendation's own Where block (or "resolved at render time" sub-block) is the sole authoritative definition for that card's render-time substitutions.

### R1: Enable Prompt Caching

**Category:** Caching opportunity
**Framing:** Opportunity (projected savings — how much you could save going forward). This recommendation uses the forward-looking projected savings formula below, not the backward-looking realized savings from §7.8.
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

**Estimated savings requirement:** R2 must always include a specific estimated dollar saving in the body text. The `[Z]` (dollar saving) and `[Y]` (percentage) template variables must both be computable; if `cheaper_model_price` is missing for a given model pair (making `[Z]` and `[Y]` unresolvable), the R2 card for that pair is suppressed.

**Title:** "High-cost model used for low-output tasks"
**Body:** "[Model name] accounts for [X]% of your actual spend but generates an average of only [N] output tokens per day. Consider testing [cheaper model] for these interactions. Estimated savings: ~$[Z] ([Y]% of your [source_name] spend) if volume holds."

Where `[Model name]` and `[cheaper model]` are resolved at render time:
- `[Model name]` = the name of the detected `premium_model` that fired the trigger, as returned by the source's usage data (API or local file)
- `[cheaper model]` = the display name resolved from the §11 model display-name mapping table, using the Suggested alternative value as the lookup key. If the value ends in `-*`, strip the `-*` suffix before querying the table (e.g., `claude-3-haiku-*` → lookup key `claude-3-haiku-`). If no display name is found, the raw lookup key (with the `-*` suffix already stripped) is used as the fallback.
- If the trigger fires for multiple premium models simultaneously, generate one R2 card per model, each resolving `[Model name]` and `[cheaper model]` independently

**Savings estimate formula:** `savings_estimate = current_spend * model_cost_share(premium_model) * (1 - (cheaper_model_price / premium_model_price))`

Where:
- `current_spend` = total actual cost for the analysis period for the source that contains `premium_model` (i.e., the Tier B source whose usage data reported the triggering model)
- `total_spend_premium_model_usd` = `current_spend * model_cost_share(premium_model)` — used for the $5.00 minimum-spend guard in the trigger
- `model_cost_share(premium_model)` = fraction of total spend attributable to the premium model (§7.6 — covers all Tier B sources)
- `output_tokens_per_day(premium_model)` = average daily output tokens for the premium model over the analysis period (see §7.13)
- `premium_model_price` = blended `(input_cost_per_token + output_cost_per_token) / 2` from the LiteLLM price map (all Tier B sources including GitHub Copilot)
- `cheaper_model_price` = blended `(input_cost_per_token + output_cost_per_token) / 2` from the LiteLLM price map for the suggested alternative model; if absent, suppress the savings estimate for that model pair
- `[X]` = `model_cost_share(premium_model) * 100` (percentage of total source spend, rounded to one decimal place)
- `[N]` = `output_tokens_per_day(premium_model)` for all Tier B sources including GitHub Copilot (average daily output tokens for the premium model, as defined in §7.13; for Copilot, derived from `usage.outputTokens` in `modelMetrics` across `session.shutdown` events)
- `[Y]` = `model_cost_share(premium_model) * (1 - (cheaper_model_price / premium_model_price)) * 100` — percentage of total source spend that would be saved if all calls to the premium model were routed to the cheaper alternative at the same volume
- `[Z]` = `current_spend_for_source × model_cost_share(premium_model) × (1 − cheaper_model_price / premium_model_price)` — specific dollar saving derived from the savings estimate formula above (same quantity as `savings_estimate`, surfaced in the body template)

Note: If `cheaper_model_price` is absent for a given model pair, suppress the savings estimate for that pair — omit the "Estimated savings: ~$[Z] ([Y]% of your [source_name] spend) if volume holds." sentence from the body for that card.

**Tiers that can trigger this:** B (all Tier B sources, including GitHub Copilot). ChatGPT Export (Tier C) cannot trigger R2 — it has no token data and no model cost share computation.

**Copilot-specific note:** For GitHub Copilot, model selection for Chat and CLI is configurable in Copilot settings. The recommendation body surfaces the per-model cost breakdown (§7.6) as evidence and links users to Copilot model configuration settings.

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
**Trigger:** Evaluated per-source. Each Tier B source with sufficient token data that individually satisfies p90 daily input tokens > 50,000 AND input:output ratio > 8 (input tokens massively exceed output tokens, indicating very large prompts with short completions) receives its own R3 card. Sources that do not individually cross both thresholds do not receive an R3 card, even if aggregate metrics across all Tier B sources would cross the threshold.
**Title:** "Consistently high input token volume"
**Body:** "Your 90th-percentile daily input token count is [N] tokens. Input tokens dominate your usage ([X]:1 input-to-output ratio). Reducing prompt length — by removing redundant instructions, using shorter examples, or leveraging system prompt caching — can materially reduce cost without affecting output quality. Conservative estimate: reducing excess input by ~20% could save approximately [S] over this period."

Where (all variables are scoped to the individual triggering source):
- `[N]` = p90 value of daily input tokens for this source over the analysis period (the same per-source quantity used in the trigger condition)
- `[X]` = `total_input_tokens / total_output_tokens` for this source over the analysis period, rounded to one decimal place (the same per-source ratio used in the trigger condition)
- `[S]` = conservative approximate savings estimate for this source (labeled as approximate in the UI): estimate savings from reducing excess input by ~20%, priced at this source's model input rates from the LiteLLM price map. The estimate is labeled "~$[S] (approximate)" in the UI. If input rates are unavailable for this source, the estimate is suppressed and the savings sentence is omitted from the body for that card.

  Approximate formula: `[S] ≈ total_input_spend_usd_for_source × (1 - 1/input_output_ratio_for_source) × 0.20`
  where `total_input_spend_usd_for_source` is the input-token portion of estimated spend for this source, computed from per-model input token counts × LiteLLM input rates. This is a conservative rough estimate; label it as approximate in the UI.

For Anthropic and Claude Code, daily input tokens = `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` summed across all models for that day (cache fields are additive — see §7.2).

For GitHub Copilot, daily input tokens = `usage.inputTokens` summed across all `modelMetrics` entries for that session day — `cacheReadTokens` and `cacheWriteTokens` are already included in `inputTokens`.

For OpenAI, daily input tokens = `input_tokens` for that day — `cached_input_tokens` is a subset of `input_tokens` and must NOT be added separately (see §7.2).

R3 appears in the tool card for each source that individually crosses both thresholds. For the top money-saving slot: if multiple sources trigger R3, the source with the highest estimated savings `[S]` is the top-slot candidate; if only one source triggers R3, that source is named in the top slot headline.

**Tiers that can trigger this:** B (all Tier B sources including GitHub Copilot — requires per-day token counts; GitHub Copilot is included as it now exposes per-session token counts via `usage.inputTokens` in `modelMetrics`). ChatGPT Export (Tier C) cannot trigger R3 — it has no token counts. For conversation-volume efficiency recommendations for ChatGPT Export, see RC5/RC6.

### R4: Use Off-Peak Hours — Removed from scope

**Status:** Removed. R4 is a latency and throughput optimization, not a cost optimization. Promptly is a cost analytics tool; R4 has no measurable cost impact and is applicable only to Claude Code. It is deferred to a future "performance insights" feature if needed. R4 must not appear in any recommendation output, the analysis page, or export files.

The former R4 trigger (>70% of Claude Code sessions in 08:00–18:00 weekday window) is no longer evaluated.

### Deferred recommendations (future scope)

The following recommendation types require reading or classifying prompt content, which crosses the prompt-content privacy boundary, or are deferred for other reasons.

| Deferred recommendation | Reason deferred |
|---|---|
| Consolidate repeated/similar prompts | Requires semantic similarity comparison of prompt text |
| Batch small sequential requests | Partial: high-frequency low-token session detection is computable, but grouping requires understanding request semantics |
| Content-aware context accumulation | Requires classification of conversation content to detect accumulation patterns beyond what is derivable from conversation/message counts |
| Quota/Throttle Risk | Low priority given higher-value recommendations; requires multi-month data |

### Tier C recommendations (ChatGPT Export)

Tier C recommendations apply to the ChatGPT Export source only. They do not have computable dollar savings and are NOT eligible for the top money-saving slot. They appear in the ChatGPT Export source card only.

**RC1: Re-upload for current data**
- **Category:** Data freshness
- **Severity:** Low
- **Trigger:** Newest conversation `create_time` in the uploaded file is more than 30 days before today's date (wall-clock time at analysis run, not `analysis_period_end`).
- **Title:** "ChatGPT data may be stale"
- **Body:** "Your ChatGPT export is from [export_date]. ChatGPT doesn't provide a usage API. Re-export your data from ChatGPT Settings → Data Controls → Export data to keep estimates current."
- Where `[export_date]` = date of the newest conversation in the upload, formatted as "Month D, YYYY".

**RC3: ChatGPT usage not reflected in spend estimate**
- **Category:** Coverage awareness
- **Severity:** Low
- **Trigger:** ChatGPT Export is connected AND at least one Tier B source is also connected AND `estimated_relative_cost_usd` for ChatGPT Export exceeds 5% of `total_estimated_spend_usd`.
- **Title:** "ChatGPT usage represents significant estimated activity"
- **Body:** "ChatGPT Export contributes an estimated ~$[E] to your total (approximately [P]% of combined spend). This is estimated from conversation activity, not billing data — your actual ChatGPT costs may differ. Re-export your ChatGPT data regularly to keep this estimate current."
- Where `[E]` = `estimated_relative_cost_usd` for ChatGPT Export; `[P]` = percentage of `total_estimated_spend_usd`.

**RC4a: High ChatGPT conversation volume**
- **Category:** Volume awareness
- **Severity:** Low
- **Trigger:** `total_conversations` > 500 for the analysis period.
- **Title:** "High ChatGPT conversation volume this period"
- **Body:** "You had [C] ChatGPT conversations in this period. If your usage is primarily conversational research or drafting, the ChatGPT export provides only a rough cost proxy — consider connecting an API-based source if you need billing accuracy."
- Where `[C]` = `total_conversations`.

**RC4b: Low ChatGPT activity**
- **Category:** Coverage awareness
- **Severity:** Low
- **Trigger:** `total_conversations` < 5 for the analysis period.
- **Title:** "Very few ChatGPT conversations in this period"
- **Body:** "Only [C] ChatGPT conversations were found in this export for the selected period. The cost estimate may not be meaningful. Consider extending the date range or re-exporting if you expected more activity."
- Where `[C]` = `total_conversations`.

**RC5: Spike in ChatGPT conversation volume**
- **Category:** Usage spike
- **Severity:** Medium
- **Trigger:** Derived from `daily_conversation_activity` (§7.24): `peak_daily_conversation_count >= 2 × avg_daily_conversation_count` AND `days_with_data >= 3`, where `peak_daily_conversation_count` = max of `conversation_count` across all date entries, `avg_daily_conversation_count` = mean of `conversation_count` across all date entries, and `days_with_data` = count of date entries with at least 1 conversation.
- **Title:** "ChatGPT conversation volume spike detected"
- **Body:** "ChatGPT conversation volume spiked [N]× above your average on [date]. Review what drove the spike to understand if it reflects a recurring workflow pattern."
- Where `[N]` = ratio of peak to average daily conversation count (one decimal place); `[date]` = date of the spike.

**RC6: No model information in export**
- **Category:** Data quality
- **Severity:** Low
- **Trigger:** ChatGPT Export is connected AND `models_identified` (§7.22) is an empty list or null (no model identifiers found in any conversation in the uploaded file).
- **Title:** "No model data in ChatGPT export"
- **Body:** "Your ChatGPT export does not include model identifiers. Cost estimates use a default model assumption. The estimates are directional only — actual costs may differ significantly if you use premium models (e.g., GPT-4, o1)."

### Recommendation presentation rules

- Recommendations are sorted by severity: High first, then Medium, then Low. For placement in the top money-saving slots, also sort by estimated dollar saving (descending).
- Each recommendation card includes: title, body text, the triggering metric value(s), a data-grounded trigger summary (the plain-language reason the recommendation applies), and the estimated dollar saving where available.
- Estimated savings figures are labeled as approximate ("~$X") and use conservative assumptions. All dollar savings in money-saving slots are specific dollar amounts (not percentage ranges or "up to" figures).
- If a recommendation cannot be computed for the connected sources (e.g., R1 when no Anthropic or Claude Code source is connected), it is not shown (no empty states).
- Recommendations never link to or promote third-party commercial products by name.
- Generic advice not produced by the recommendation engine is prohibited everywhere in the results page.

---
## 9. Privacy and Security Model

### Core guarantees

1. **No user data leaves the user's machine to any server other than the AI providers the user explicitly connects to.** The outbound network calls from the local Express server are: (a) `api.openai.com` and `api.anthropic.com` using credentials the user provides; and (b) `raw.githubusercontent.com` to fetch the LiteLLM price map at startup (no user data is included in this request; it is a plain GET for a public JSON file). GitHub Copilot data is read from the local filesystem (`~/.copilot/session-state/`) — no network call is made. If option (b) fails, the bundled price map snapshot is used instead and no retry is attempted.

2. **API keys are ephemeral.** Keys entered in the frontend are held in JavaScript heap memory only. They are never written to `localStorage`, `sessionStorage`, IndexedDB, cookies, or any file on disk. The Express server receives keys as HTTP request headers on each individual proxied request and does not store them in memory beyond the lifetime of that request handler.

3. **Local and uploaded file data do not leave the user's machine.** Claude Code data is read directly from `~/.claude/` and GitHub Copilot data from `~/.copilot/session-state/` on the user's filesystem by the local Express server. ChatGPT Export files are uploaded from the user's machine to the local Express server via the browser; the server parses the file in memory and returns metrics to the frontend — the file is never written to disk, persisted, or transmitted beyond the local Express server. No local or uploaded file data is transmitted to any network endpoint.

4. **Session end = data gone.** When the user closes the browser tab, all frontend state is cleared. The Express server process has no persistent state; restarting it (or even just receiving no requests) means no data persists. There is no session store, no database, and no log file that captures user data.

5. **No server-side logging of user data.** The Express server may log HTTP method, path, and status code for debugging (standard access log), but it must not log request bodies, response bodies, API keys, or file contents.

6. **Narrative signals are derived from aggregated metrics only.** The plain-language insights on the analysis page — efficiency signal, session cost, cache savings, dominant model sentence, spike callout, and conversation activity summary — are computed entirely from aggregated token counts, cost figures, timestamps, and conversation/message counts. No prompt or response content is read, transmitted, or processed to generate these insights. This is consistent with NG6: Promptly never reads, stores, or surfaces the text of prompts or responses.

### What the Express server does

The local Express server is a **stateless computation proxy**. Its responsibilities are:
- Receive a credential (API key or token) in the request header from the frontend
- Call the corresponding provider API using that credential
- Return the raw or lightly transformed response to the frontend
- Compute recommendation logic on metrics returned from all adapters
- Return computed metrics to the frontend as JSON
- Receive uploaded ChatGPT Export files from the frontend, parse them in memory, compute Tier C metrics, and return results; the uploaded file is never written to disk or retained after the request completes

The server does not store any data, maintain sessions, log user data, or make any network calls other than to the supported provider APIs and `raw.githubusercontent.com` (LiteLLM price map fetch at startup — no user data sent; falls back to bundled snapshot if unavailable). It reads local Claude Code and GitHub Copilot session files, and processes uploaded ChatGPT Export files, into memory only for the duration of the analysis request; no file contents are persisted.

### What the frontend does

The React frontend holds all session state in React component state and context. It never writes analysis data to any browser persistence API. It uses the local Express server only as a computation and API proxy layer.

### Key handling summary

| Key type | Where entered | Where stored | Lifetime | Sent to |
|---|---|---|---|---|
| OpenAI Admin key | Frontend text input | React state (memory only) | Session only | `api.openai.com` via local server |
| Anthropic Admin key | Frontend text input | React state (memory only) | Session only | `api.anthropic.com` via local server |
| GitHub Copilot | Auto-detected (no input) | N/A — no credentials | N/A | Local filesystem only (`~/.copilot/session-state/`) |
| ChatGPT Export file | Frontend file upload | Express server memory only (in-flight) | Request only | Local server only — never forwarded |

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

The PDF structure mirrors the narrative analysis page.

```
Promptly Analysis Report
Generated: [timestamp] (local time)
Analysis period: [start date] to [end date]
Sources connected: [list]

--- Page 1: Header, Spend Breakdown, and Trend ---
Estimated spend: [total_estimated_spend_usd from all connected sources; if any Tier C source contributes, add ~prefix and footnote "Includes ChatGPT Export estimated from conversation activity."]
Trend badge: one of three states per §7.3d — MoM change, insufficient-data note, or no-prior-spend note
Spend-by-tool bar: [each source with estimated spend and % of total, sorted descending; Tier C bars visually flagged as estimated]
Top money-saving recommendations: [up to 2, compact headline + dollar saving; footnote references full recommendation in per-tool section below; Tier C recommendations not eligible for this slot]
Spend trend chart: [cross-source daily estimated spend line chart; Tier C-derived points footnoted as estimated from conversation activity]
Spike callout: [if triggered — for Tier B sources; ChatGPT Export conversation spike if triggered]

--- Page 2+: Per-Tool Cards ---
[For each connected Tier B source, sorted by estimated spend:]
  Tool: [name]  |  Estimated spend: $X.XX
  Dominant model sentence
  Efficiency signal (plain language)
  Cache savings in dollars [if computable]
  Average session cost [or "Session-level cost not available from provider data" for OpenAI/Anthropic]
  Full recommendation text [if triggered for this tool — as written, including explanation and savings with caveats]

[For ChatGPT Export (Tier C), if connected:]
  Tool: ChatGPT Export  |  Estimated relative cost: ~$X.XX (estimated from conversation activity)
  Total conversations: N  |  Total messages: N  |  Active days: N of M
  Models identified: [list or "Model data not available in export"]
  Daily conversation activity chart
  Estimated token volume: ~N tokens estimated [if available]
  Tier C recommendations [RC1/RC3/RC4a/RC4b/RC5/RC6 as triggered]

Note: Top slot recommendations in PDF are not interactive; the full recommendation text is reproduced in the relevant per-tool section above.

--- Assumptions and Caveats ---
Per-source accuracy note: [source name, data method, accuracy level]
LiteLLM price map version date used.
Statement: "All spend figures are labeled 'Estimated spend.' Some sources provide precise billing data; others compute cost from local token counts and model prices. ChatGPT Export cost is estimated from conversation activity only. Details per source above."
All ASSUMPTION flags that applied to this analysis.
```

**Changes from prior export structure:**
- "Total actual spend" renamed to "Estimated spend" throughout the PDF.
- PDF follows the narrative page order (header → spend breakdown → trend → per-tool cards → recommendations) rather than the prior summary/per-source panels/recommendations structure.
- All triggered recommendations are included; the former cap of 3 recommendations is removed.
- The assumptions/caveats section explicitly documents per-source accuracy and the basis for the "estimated" label.

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
      "source_id": "claude_code | openai | anthropic | github_copilot | chatgpt_export",
      "adapter": "claude_code.js | openai.js | anthropic.js | github_copilot.js | chatgpt_export.js",
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
    },
    {
      // Example for chatgpt_export (Tier C):
      // "source_id": "chatgpt_export",
      // "adapter": "chatgpt_export.js",
      // "tier": "C",
      // "connected": true,
      // "error": null,
      // "metrics": {
      //   "total_conversations": 312,
      //   "total_messages": 1847,
      //   "active_days": 22,
      //   "analysis_period_days": 30,
      //   "models_identified": ["gpt-4o", "gpt-4o-mini"],
      //   "estimated_relative_cost_usd": 2.45,
      //   "estimated_token_volume": 1200000,
      //   "daily_conversation_activity": [{"date": "2026-07-01", "conversation_count": 14}, "..."],
      //   "spike_callout": {"date": "2026-07-10", "multiple_of_average": 3.2, "message": "ChatGPT conversation volume spiked 3.2× above your average on Jul 10"}
      // }
    }
  ],
  "cross_source_summary": {
    "total_actual_spend_usd": 55.40,
    "total_estimated_spend_usd": 57.85,
    // total_estimated_spend_usd now includes Tier C estimated costs (estimated_relative_cost_usd) alongside Tier B actuals/computed costs.
    // total_actual_spend_usd includes Tier B sources only and is retained for backwards compatibility.
    "total_actual_tokens": 8200000,
    // total_actual_tokens includes Tier B sources only. ChatGPT Export does not contribute to this field.
    "total_estimated_tokens": 9400000,
    // total_estimated_tokens adds Tier C estimated_token_volume to total_actual_tokens. Labeled as estimated wherever displayed.
    "effective_cost_per_million_tokens_usd": 6.76,
    // effective_cost_per_million_tokens_usd is computed from Tier B only (actual tokens and Tier B spend).
    "daily_spend": [
      {"date": "2026-07-01", "spend_usd": 3.20, "includes_estimated_tier_c": false},
      {"date": "2026-07-02", "spend_usd": 3.45, "includes_estimated_tier_c": true},
      "..."
    ],
    // daily_spend entries include includes_estimated_tier_c flag. When true, the day's spend_usd includes Tier C estimated contribution.
    "spend_by_tool": [
      {"source_id": "openai", "display_name": "OpenAI API", "estimated_spend_usd": 42.17, "percentage_of_total": 72.9, "tier": "B", "is_estimated": false, "rank": 1},
      {"source_id": "chatgpt_export", "display_name": "ChatGPT Export", "estimated_spend_usd": 2.45, "percentage_of_total": 4.2, "tier": "C", "is_estimated": true, "rank": 5},
      "..."
    ],
    "trend": {
      "status": "available | insufficient_data | no_prior_spend",
      "mom_change_pct": 12.3,
      "observed_days": 60,
      "required_days": 45,
      "message": "string"
    },
    "spike_callout": {
      "date": "2026-07-03",
      "spend_usd": 8.40,
      "multiple_of_average": 2.6,
      "message": "Most expensive day: Jul 3 — 2.6× your average"
    }
  },
  "recommendations": [
    {
      "id": "R1 | R2 | R3 | RC1 | RC3 | RC4a | RC4b | RC5 | RC6",
      "severity": "High | Medium | Low",
      "title": "string",
      "body": "string",
      "triggering_metric": "string",
      "triggering_value": "number or string",
      "estimated_savings_usd": 8.30
      // Populated for all recommendations that compute a dollar saving: R1 (projected savings), R2 ([Z] from the savings estimate formula), R3 (approximate [S]). Null if savings cannot be computed for the triggering source.
    }
  ],
  "assumptions": [
    "string: one entry per ASSUMPTION flag that applied"
  ]
}
```

Note: `total_actual_tokens` is computed using the provider-aware formula from §7.2: for Anthropic and Claude Code, cache fields (`cache_creation_input_tokens`, `cache_read_input_tokens`) are included as additive buckets; for OpenAI, `cached_input_tokens` is a subset of `input_tokens` and is not added separately. For GitHub Copilot, `usage.inputTokens + usage.outputTokens` is used — `cacheReadTokens` and `cacheWriteTokens` are already included in `inputTokens` and must not be added separately. ChatGPT Export does not contribute to `total_actual_tokens`.

`total_estimated_spend_usd` now includes Tier C `estimated_relative_cost_usd` contributions alongside Tier B actual/computed spend. When any Tier C source is connected and contributing, the JSON field `cross_source_summary.total_estimated_spend_usd` reflects the mixed total; `total_actual_spend_usd` retains the Tier B-only figure.

New cross-source narrative fields added in v2.0: `total_estimated_spend_usd`, `effective_cost_per_million_tokens_usd`, `daily_spend[]`, `spend_by_tool[]`, `trend{}`, and `spike_callout{}` — see §7.3a–§7.3e for definitions. The `total_actual_spend_usd` field is retained for backwards compatibility. Per-source narrative fields added in v2.0: `estimated_spend_usd`, `model_spend_breakdown[]`, `primary_model{}`, `avg_session_cost_usd` (or unavailability note), `efficiency_signal{}`, `cache_savings{}`, and `daily_spend_sparkline[]`. Added in v2.2: `total_estimated_tokens`, `includes_estimated_tier_c` flag on daily_spend entries, `is_estimated` and `tier` on spend_by_tool entries, Tier C source metrics block for `chatgpt_export`.

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
| Charts | Recharts | React-native chart library, sufficient for line and bar charts needed; no additional canvas setup. Horizontal CSS bars are the primary pattern for spend breakdowns and model shares. Pie charts are not used in the results UI. |
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

**Timezone model:** All timestamps are stored and processed in UTC. All time-based values displayed in the UI (dates and daily buckets) are rendered in the local timezone of the machine running the Express server using Node.js `Intl`/`Date`. This applies uniformly across all sources — API sources return UTC natively; local-file sources (Claude Code, GitHub Copilot) use Unix millisecond timestamps which are inherently UTC.

'Local machine timezone' throughout this spec means the timezone of the machine running the Express server. Because Promptly is a local-only tool, this is always the user's own machine.

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
   |       chatgpt_export.js   -- receives uploaded conversations.json in-memory, parses conversation/message data, computes Tier C metrics, returns Tier C data
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
   [uploaded conversations.json]  -- ChatGPT Export file received in-memory via browser file upload (no disk write)
```

### Backend presentation/metric layer

Between the adapter output and the frontend, the backend includes a **presentation layer** that maps raw metric output to narrative-ready fields. This layer is responsible for computing:
- Cross-source daily spend roll-up (§7.3b)
- Spend by tool share (§7.3c)
- Effective cost per million tokens (§7.3a)
- Trend status object (§7.3d)
- Spike callout (§7.3e)
- Per-source: model spend breakdown, dominant model, efficiency signal, cache savings summary, average session cost

The presentation layer runs after all adapters complete and before the response is sent to the frontend. It ensures React components receive narrative-ready fields and do not reconstruct business meaning from raw token counts.

For Tier C sources, the presentation layer computes: estimated relative cost (§7.23), daily conversation activity (§7.24), estimated token volume (§7.25), Tier C spike callout (§7.3e), and Tier C recommendation triggers (RC1/RC3/RC4a/RC4b/RC5/RC6). Tier C fields are included in the cross_source_summary where specified in §10.

### Narrative results component hierarchy

The analysis page uses the following component structure:

```
Results.tsx
├── AnalysisHeader           — estimated spend (mixed-total flag if Tier C present), analysis period, token sub-line, trend badge
├── MoneyByToolSection       — spend-by-tool horizontal bars (Tier C bars visually flagged) + top 1–2 money-saving recommendations (Tier B only)
│   ├── SpendByToolBar       — horizontal CSS or Recharts bar per source; Tier C bars hatched/asterisked
│   └── TopRecommendationLine (× 1–2, savings-bearing, Tier B only)
├── SpendingTrendSection     — cross-source daily spend trend + spike callout (Tier B spend + Tier C conversation spike)
│   └── SpendLineChart (full variant)
├── ToolCardsSection         — expandable cards per source, sorted by estimated spend
│   ├── ToolSpendCard (× N Tier B, highest-spend expanded by default)
│   │   ├── ModelSpendMiniBar      — horizontal model cost share bars + dominant model sentence
│   │   ├── EfficiencySignalCallout
│   │   ├── CacheSavingsCallout
│   │   ├── SpendLineChart (sparkline variant)
│   │   └── TopRecommendationLine (per-tool, at card bottom)
│   └── TierCSourceCard (× N Tier C — uses uniform per-tool card model)
│       ├── ConversationActivityChart  — daily conversation count line chart
│       ├── TierCMetricsSummary       — total conversations, messages, active days, models, estimated cost
│       └── TierCRecommendationLine (RC1/RC3/RC4a/RC4b/RC5/RC6 as triggered)
├── BudgetTrackerCTA         — CTA placeholder for future budget tracking
└── Export action bar        — PDF and JSON download buttons
```

### Adapter pattern

Each source adapter (`adapters/*.js`) implements the following interface:

```javascript
// adapter interface (all adapters implement these exports)
async function connect(credentials, options) {
  // credentials: { apiKey: string } or { token: string } or null (for no-credential sources like Claude Code, GitHub Copilot, and ChatGPT Export)
  // options: { startDate: Date, endDate: Date, uploadedFile?: Buffer | null }
  // uploadedFile is used by chatgpt_export.js; null for all other adapters
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

Adding a new provider requires only: creating `adapters/newprovider.js` implementing this interface, registering it in the adapter registry, and adding a source card in the frontend. For a file-export source, set `credentials` to null and pass the uploaded file buffer via `options.uploadedFile`. No changes to the metrics engine or recommendation engine are required unless the new adapter provides new metric types.

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
| Budget tracker as a feature | Budget tracker is a CTA placeholder only in this release. No budget-setting, alerting, or tracking logic is implemented for MVP. |
| Cost forecasting as an interactive feature | Basic trend data in export only; interactive forecasting is post-MVP |
| Latency/performance optimization recommendations (R4) | R4 is a latency and throughput optimization with no cost impact. Deferred to a future "performance insights" feature. R4 does not appear in any recommendation output in this release. |
| Mobile or tablet UI | Desktop-first only for MVP |
| OpenRouter, custom API endpoints | Out of scope; adapter can be added later |
| Dark mode | Not in MVP scope |
| Internationalization (i18n) | English only for MVP |
| API rate limit handling with backoff beyond simple retry | Basic retry (3 attempts, exponential backoff) is in scope; sophisticated rate management is not |
| LiteLLM and Helicone as P0 data sources | Require continuous or scheduled database access; not one-time reads; future scope after persistent dashboard phase |
| Web app users on flat subscriptions (ChatGPT Plus, Claude.ai Pro) | No per-token billing data available from subscription plans. ChatGPT Export (Tier C) provides activity/conversation data for ChatGPT but is not billing data. Claude.ai Pro export is a disabled stub (§5 P1 table) — not active in MVP. |
| claude_export (Claude.ai conversation export) | Disabled stub. Listed in §5 P1 table only. Not active for MVP. No code, adapter, or UI entry should be created until explicitly promoted. |
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

**OQ-11 [RESOLVED] Session-level cost for OpenAI and Anthropic**
Resolved (Q1). For OpenAI and Anthropic, session-level cost is unavailable — provider APIs return daily aggregates without session rows. The display string for these sources is: "Session-level cost not available from provider data." This message is always shown; it is never omitted and may not be substituted with an average daily spend figure or any other proxy. See §7.18.

**OQ-12 [RESOLVED] R3 savings estimate**
Resolved (Q2). R3 includes a conservative approximate savings estimate: reduce excess input by ~20%, priced at source/model input rates from the LiteLLM price map. The estimate is labeled as approximate ("~$[S]") in the UI. See §8 R3 for the full formula.

**OQ-13 [RESOLVED] R4 fate**
Resolved (Q3). R4 (off-peak/latency optimization) is removed from scope. Rationale: R4 is a latency and throughput optimization with no cost impact, and is applicable only to Claude Code. Promptly is cost-focused. R4 is deferred to a future "performance insights" feature if needed. See §8 R4 and §12.

**OQ-14 [RESOLVED] Spike callout threshold**
Resolved (Q4). Spike callout triggers when peak daily spend ≥ 2× average daily spend AND at least 3 days of spend data in the analysis window. Rationale: 2× is the minimum meaningful signal above normal day-to-day noise. The 3-day minimum prevents single-day analyses from always triggering (a single day is by definition its own average). Both thresholds are reviewable as usage data accumulates. See §7.3e.

**OQ-15 [RESOLVED] Header per-million-token sub-line**
Resolved (Q8). The header sub-line displays `$X.XX per million tokens` as visible inline text. No tooltip is used; the value must be readable without hover or focus as an accessibility requirement. See §7.2 and §7.3a.

**OQ-16 [DEFERRED to ED/code] Copilot cache savings dollar estimation**
Copilot `requests.cost` is provider-computed and inclusive of caching. A defensible dollar savings estimate for Copilot is not currently available from existing data. Deferred to engineering: if a price-map-based approximation is added and marked as approximate, update §7.8 and the §10 export schema accordingly.

**OQ-17 [RESOLVED] FileExportPanel and Tier C card model**
Resolved in v2.2. ChatGPT Export uses the uniform per-tool card model defined in §7 and §4 Step 5. The `FileExportPanel.tsx` component either adapts to the uniform card model or is replaced by `TierCSourceCard` — that implementation decision is delegated to engineering. The product behavior is fully specified: Tier C sources display the fields defined in §7.19–§7.25 using the same card structure as Tier B sources.

**OQ-18 [DEFERRED to ED/code] JSON export backwards compatibility**
New cross-source narrative fields added in §10 may affect consumers of the JSON export. The `total_actual_spend_usd` field is retained for backwards compatibility. Full compatibility strategy (field deprecation, schema versioning) deferred to engineering.

**OQ-19 [DEFERRED to ED/code] ChatGPT Export token-estimation constants**
The product behavior for ChatGPT Export estimated token volume (§7.25) is resolved: conversation/message character counts × an assumed token-to-word ratio. The specific estimation constant (tokens-per-word ratio and/or tokens-per-message assumption) is deferred to engineering design. When resolved, update §7.25 with the adopted constant and label it as an ASSUMPTION in the export.

---

## Changelog

The full revision history for this spec is maintained in a separate reference file to keep this document concise and model-context-efficient.

**See:** [docs/spec-changelog.md](./spec-changelog.md)

> Load spec-changelog.md only when you need to trace a specific change, understand a past decision, or audit version history. It is not required context for implementing or reviewing the current spec.

---

*End of Promptly Product Spec v2.2*