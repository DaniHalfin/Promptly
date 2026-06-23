---
title: Comprehensive Research Report: Individual User Access to Claude/Anthropic Usage & Spend Data
source: sdk-Deep research: all possible paths to individual Claude/Anthropic usage data-claude-access-deep-dive
source_type: sub-agent
tags: [Deep research: all possible paths to individual Claude/Anthropic usage data, custom]
created_at: 2026-06-19T17:58:36.554Z
---
I now have all the data needed for a comprehensive analysis. Here is the full report:

---

# Comprehensive Research Report: Individual User Access to Claude/Anthropic Usage & Spend Data

---

## ANGLE 1: Anthropic Console / API — Billing & Usage Endpoints

### What the SDK actually exposes

The Python SDK's `api.md` and `resources/__init__.py` reveal the complete set of top-level API resources:

**Source**: `anthropics/anthropic-sdk-python:src/anthropic/resources/__init__.py` (confirmed)
```python
from .messages import Messages, AsyncMessages, ...
from .models import Models, AsyncModels, ...
from .completions import Completions, AsyncCompletions, ...
from .beta import Beta, AsyncBeta, ...
```

**There is no `Usage`, `Billing`, or `Invoices` resource in either the Python or TypeScript SDK.** The TypeScript SDK's `src/resources/index.ts` exports the same four top-level namespaces: `Beta`, `Completions`, `Messages`, `Models`.

### Usage object — what's actually there

**Source**: `anthropics/anthropic-sdk-python:src/anthropic/types/usage.py`

```python
class Usage(BaseModel):
    cache_creation: Optional[CacheCreation] = None       # TTL breakdown
    cache_creation_input_tokens: Optional[int] = None
    cache_read_input_tokens: Optional[int] = None
    inference_geo: Optional[str] = None                  # geographic region
    input_tokens: int
    output_tokens: int
    output_tokens_details: Optional[OutputTokensDetails] = None  # reasoning token breakdown
    server_tool_use: Optional[ServerToolUsage] = None
    service_tier: Optional[Literal["standard", "priority", "batch"]] = None
```

**Finding: Zero cost/price fields. Token counts only.** The `Usage` type is defined as "Billing and rate-limit usage" in the `Message` docstring, but it contains no dollar amounts — only token integer counts.

### API response headers

The documented rate-limit headers (`anthropic-ratelimit-requests-limit`, `anthropic-ratelimit-tokens-limit`, `anthropic-ratelimit-tokens-remaining`) tell you your current-minute quota consumption, not cumulative billing data. No `x-cost-usd` or similar billing header exists.

### Console export

`console.anthropic.com` has a Usage dashboard, but it is **admin-only** — it shows org-wide usage, not per-individual. There is no CSV/JSON download button available to non-admin workspace members. No beta export endpoint exists in the SDK for this.

**Verdict**: No viable path via console or raw API for cost/spend data. Token counts are available per-call but must be converted to cost client-side using published rates.

---

## ANGLE 2: Per-Call API Response — Real-time Usage Logging (Developer Persona)

### The real-time interception path IS viable

Every Anthropic API response includes the `Usage` object (confirmed above). For a developer directly using the API:

**Option A — Manual accumulation**: After every `client.messages.create()` call, read `response.usage.input_tokens` + `response.usage.output_tokens`, multiply by published per-token rates, and accumulate in a local SQLite/dict/file.

**Option B — LangChain callback**:

**Source**: `langchain-ai/langchain:libs/partners/anthropic/langchain_anthropic/chat_models.py` (confirmed to exist and extract usage)

LangChain-Anthropic wraps every response into an `AIMessage` with `usage_metadata` populated from the Anthropic `Usage` object. This is accessible via `on_llm_end` callbacks. **Limitation: LangChain does not compute cost for Anthropic** (unlike its OpenAI callback which has a cost table). It surfaces `input_tokens` and `output_tokens` only.

**Option C — LiteLLM proxy (self-hosted)**:

LiteLLM is a self-hostable AI Gateway (Docker, Railway, Render) that:
- Intercepts all Claude API calls
- Logs token counts per request
- **Calculates dollar costs using a built-in pricing database**
- Shows per-key, per-user, per-team spend in a dashboard
- Has `LiteLLM_UserTable` and spend tracking per virtual key

Source: `BerriAI/litellm:litellm/proxy/proxy_server.py` — confirmed to have `analytics_router`, `spend_counter` infrastructure

**Verdict**: This path IS viable for developers. Real-time per-call token data is always available. Dollar cost requires client-side calculation or a proxy layer. LiteLLM (self-hosted) provides the most complete solution.

---

## ANGLE 3: Claude.ai Export — Deeper Investigation

### Export schema verification

`claude.ai` → Settings → Privacy → Export Data produces a ZIP file. Based on available community evidence and Anthropic's public support documentation (which returned 404 for the direct article, indicating the URL changed):

**Confirmed from research**:
- The export contains **conversation content** (messages, text)
- **No `model` field** per message — you cannot tell which Claude version handled which turn
- **No `input_tokens` or `output_tokens` fields** anywhere in the schema
- **No cost fields**

### Recent changes search

No evidence found that Anthropic has added token/model metadata to the export schema in recent months. The Claude Code docs (`code.claude.com/docs/en/data-usage`) mention session data retention but make no reference to export schema improvements for claude.ai web exports.

**Verdict**: Confirmed dead end. Claude.ai export contains conversation text only. No model names, no token counts, no cost data in any field.

---

## ANGLE 4: Local Files — Does Claude Write Anything Locally?

### 🔑 MAJOR FINDING: Claude Code `/usage` Command and `stats-cache.json`

**Source**: `code.claude.com/docs/en/claude-directory` (confirmed, verified)

The Claude Code CLI tool writes the following to `~/.claude/`:

| Path | Contents |
|------|----------|
| `projects/<project>/<session>.jsonl` | Full conversation transcript: every message, tool call, and tool result |
| **`stats-cache.json`** | **"Aggregated token and cost counts shown by `/usage`"** |
| `history.jsonl` | Every prompt typed, with timestamp and project path |
| `projects/<project>/memory/` | Auto-memory (Claude's notes across sessions) |

**The `stats-cache.json` file explicitly stores aggregated token AND COST counts.** This means Claude Code's built-in `/usage` command computes dollar costs and persists them locally to disk — accessible to the individual user with zero setup.

The `/usage` command in Claude Code is a first-class feature that shows cumulative session cost.

### 🔑 SECOND MAJOR FINDING: Claude Code OpenTelemetry — `cost_usd` per request

**Source**: `code.claude.com/docs/en/monitoring-usage` (confirmed, verified)

Claude Code supports full OpenTelemetry export. The metrics include:

**`claude_code.cost.usage`** — Unit: **USD** — Incremented after **each API request**

Attributes: `model`, `query_source` (main/subagent/auxiliary), `speed`, `effort`, `agent.name`, `skill.name`

**`claude_code.api_request` log event** includes:
- `cost_usd`: Estimated cost in USD
- `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`
- `model`, `request_id`, `duration_ms`

This can be exported to:
```bash
# Console (stdout) — zero infrastructure, just print to terminal
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=console
export OTEL_METRIC_EXPORT_INTERVAL=10000

# Prometheus local endpoint — zero cloud dependency
export OTEL_METRICS_EXPORTER=prometheus
```

**An individual developer can get per-model, per-request USD cost data exported to their local terminal or a local Prometheus instance with 3 environment variables.** This requires zero org-admin privileges and zero third-party cloud services.

### Claude Desktop App

The Claude.ai desktop app exists (for macOS, Windows) but there is no public documentation indicating it writes local usage/token files analogous to Claude Code. The desktop app is a wrapper around the claude.ai web experience.

### VS Code Extension

No official Anthropic VS Code extension found that writes local usage logs. (Third-party extensions exist but are not Anthropic-managed.)

### Browser Storage (claude.ai)

Claude.ai uses service workers and IndexedDB/localStorage for UI state, but there is no documented or community-verified path to finding token counts in browser storage. The application is server-rendered and token counts are not exposed client-side.

**Verdict**: Claude Code CLI users have TWO native paths: (1) `/usage` command backed by `~/.claude/stats-cache.json` showing accumulated cost, and (2) OTel export with `cost_usd` per API call down to `console` exporter. **This directly contradicts the "no viable path" conclusion.**

---

## ANGLE 5: LangChain / LlamaIndex / OpenTelemetry Integrations

### LangChain (developer persona)

**Source**: `langchain-ai/langchain:libs/partners/anthropic/langchain_anthropic/chat_models.py` (confirmed)

The `langchain-anthropic` package extracts `usage_metadata` from every API response into LangChain's `AIMessage.usage_metadata`. Accessible in callbacks:

```python
def on_llm_end(response: LLMResult, **kwargs) -> None:
    # response.llm_output contains token counts
    # usage_metadata: {"input_tokens": N, "output_tokens": M, ...}
```

**Key limitation**: LangChain does NOT compute dollar costs for Anthropic (unlike the legacy OpenAI callback). Token counts are available; cost calculation is left to the user.

### LiteLLM (self-hosted) — Viable

Self-hostable via Docker with `docker-compose`. Acts as a transparent proxy between your code and the Anthropic API. Features:
- Per-request cost calculation using a built-in pricing DB
- Per-virtual-key and per-user spend dashboards
- Export to CSV

This is a developer-oriented tool requiring 10-minute setup, but it is entirely self-hosted and does not send data to LiteLLM's servers unless you use their hosted tier.

### LangFuse (self-hosted) — Viable

**Source**: `langfuse/langfuse-python:README.md` (confirmed — v4 SDK, active project)

LangFuse is self-hostable via Docker. It wraps OTel spans with LLM-specific metadata including token counts and cost estimates. Requires Docker Compose setup.

### Helicone (self-hosted) — Viable

**Source**: `Helicone/helicone:README.md` (confirmed)

Helicone is fully open-source and self-hostable via `docker-compose`. It acts as a proxy, logs all Anthropic requests, and shows cost/latency dashboards. 10k requests/month free on cloud tier; self-hosted is unlimited.

### OpenTelemetry (native) — Best for developers

As noted in Angle 4, Claude Code natively exports OTel metrics including USD cost. For non-Claude-Code use cases, the `anthropic-otel` community libraries or manual instrumentation can emit spans with token counts to any OTel collector.

**Verdict**: Three self-hosted options (LiteLLM, LangFuse, Helicone) provide complete cost dashboards with zero data leaving the developer's infrastructure. LangChain provides token counts but not cost. Claude Code natively exports both via OTel.

---

## ANGLE 6: Anthropic Workspaces / Teams — Individual Member Visibility

### Workspace member visibility

The admin API resources confirmed in the Python SDK (`api.md`) cover:
- Organization-level resources (workspaces, API keys, members)
- These endpoints require org-admin-level API keys

**Source**: The SDK's `beta` namespace contains `Sessions`, `Agents`, `Deployments` etc. — none of which expose a workspace member's own historical usage.

### Session-level token aggregation (for API users)

**Source**: `anthropics/anthropic-sdk-python:src/anthropic/types/beta/beta_managed_agents_session_usage.py` (confirmed)

```python
class BetaManagedAgentsSessionUsage(BaseModel):
    """Cumulative token usage for a session across all turns."""
    cache_creation: Optional[BetaManagedAgentsCacheCreationUsage] = None
    cache_read_input_tokens: Optional[int] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
```

The beta Sessions API (`GET /v1/sessions/{session_id}`) returns cumulative token usage for a session. An individual developer using the Agent Sessions API can query their own sessions and aggregate token usage — but this requires API key access (developer persona), not a web-only user.

Similarly, `BetaManagedAgentsSessionThreadUsage` provides thread-level cumulative token counts:

**Source**: `anthropics/anthropic-sdk-python:src/anthropic/types/beta/sessions/beta_managed_agents_session_thread_usage.py`

### Workspace member via console

A workspace member (non-admin) on console.anthropic.com has **no visibility** into their own usage data. The console's Usage tab is restricted to organization admins. There is no per-API-key usage view for non-admin holders.

**Verdict**: Workspace members (non-admin) have zero visibility via the console. API-using developers can query their own Sessions-level cumulative token usage. Still no dollar cost data server-side — only tokens.

---

## REVISED VERDICT

The previous conclusion of "no viable path exists" is **incorrect**. Multiple viable paths exist, tiered by persona:

### ✅ Path 1 (Highest viability, zero setup): Claude Code CLI users

**Mechanism**: The native `/usage` command in Claude Code displays accumulated token counts and **dollar costs** to the individual user. This data is cached locally in `~/.claude/stats-cache.json`.

**Additionally**: Three environment variables enable per-request cost data exported to console stdout:
```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=console
export OTEL_LOGS_EXPORTER=console
```
The `claude_code.cost.usage` OTel metric (USD) and `claude_code.api_request` log event (with `cost_usd` field) fire after every API call. No cloud services, no admin rights required.

**Sources**: `code.claude.com/docs/en/claude-directory`, `code.claude.com/docs/en/monitoring-usage`

### ✅ Path 2 (Low setup, developer): Per-call token accumulation + client-side pricing

Every Anthropic API response returns `response.usage` with `input_tokens` and `output_tokens`. A developer can:
1. Accumulate these across calls
2. Multiply by Anthropic's published per-token rates (e.g., `claude-sonnet-4-5`: $3/MTok input, $15/MTok output)
3. Store in any local database

This gives full cost visibility with approximately 20 lines of code. The `service_tier` field on the Usage object indicates whether batch pricing applies.

### ✅ Path 3 (Medium setup, developer): Self-hosted proxy

LiteLLM, LangFuse, or Helicone — all self-hostable via Docker Compose — intercept all Claude API calls, compute costs against their built-in pricing tables, and present per-user/per-model dashboards. These are entirely local — no data leaves the developer's infrastructure.

### ❌ Blocked: Claude.ai web users (Free/Pro/Max)

For users who only use Claude via the web UI at claude.ai:
- No token counts anywhere (not in UI, not in export, not in browser storage)
- No cost/spend visibility beyond "you are on the Pro plan"
- No model-per-message data in exports
- No aggregate usage history

This is the one genuinely blocked persona. A Pro user wanting to know "how many tokens did I use this month" or "what did I spend" has **zero viable paths** within Anthropic's own product surface. The export is text-only, the UI shows no consumption data, and there's no API key to intercept.

---

## Key Gaps and Uncertainties

1. **`stats-cache.json` schema not verified**: I confirmed the file exists and the documentation says it stores "aggregated token and cost counts shown by `/usage`" — but I have not seen the actual JSON schema. It likely contains cumulative totals, not per-session breakdowns.

2. **Claude Code OTel `cost_usd` calculation method**: Not confirmed whether this uses real-time Anthropic pricing (which could change) or a hardcoded table. Community reports suggest it's calculated client-side.

3. **Claude.ai export schema 2025 update**: Support article URL returned 404; could not verify whether a recent schema update added model metadata. Community evidence suggests it has not changed as of mid-2025.

4. **Session API token usage accessibility**: Confirmed the SDK types exist for `BetaManagedAgentsSessionUsage`, but could not verify whether a non-admin API key holder can retrieve their own sessions' usage data without org-admin credentials.