---
title: LLM Usage Analytics & Cost Optimization — Research Report
source: researcher-1781804466146
source_type: sub-agent
tags: [research, llm, cost-analysis, mvp, competitive-landscape]
created_at: 2026-06-18T17:43:37.163Z
---
# LLM Usage Analytics & Cost Optimization — Research Report

_Prepared to inform MVP scoping for an LLM cost-analysis web app. Date: 2026-06-18._

---

## 1. Existing Tools & Competitive Landscape

The market splits into three archetypes: **(A) Proxy/Gateway tools** (sit in the request path), **(B) SDK/trace observability platforms** (instrument your code), and **(C) native provider dashboards**. Most mature players blur these lines.

### Helicone — _Proxy-first observability_
- **What it does:** LLM observability/monitoring; logs requests, costs, latency, caching, rate-limiting.
- **Data surfaced:** tokens (prompt/completion), cost (computed), latency/TTFT, status, full prompt+completion bodies, custom properties, user IDs, cache hits.
- **Connection:** Primarily a **proxy** — change base URL to `oai.helicone.ai` and add an auth header. Also async logging SDK/OpenLLMetry for those who won't route traffic through a proxy.
- **Gaps:** Proxy in the hot path is a reliability/latency concern for some; async mode loses some features. Cost accuracy depends on their price tables.
- **Pricing:** Generous free tier (e.g. ~10k logs/mo), usage tiers above. **Self-hostable** (open source, Apache-2.0).

### Langfuse — _Open-source trace platform (strong reference impl)_
- **What it does:** Tracing, evals, prompt management, metrics, datasets, playground. The leading OSS observability platform.
- **Data surfaced:** nested traces/spans, model, input/output text, tokens, computed cost, latency, scores/evals, metadata tags, user/session IDs.
- **Connection:** **SDK instrumentation** (Python/JS decorators), OpenTelemetry, integrations with OpenAI SDK, LangChain, LiteLLM. Not a proxy by default → no hot-path dependency.
- **Gaps:** Requires code instrumentation (won't capture usage you don't wrap); cost depends on its model-price config.
- **Pricing:** OSS (MIT core), **self-hostable**; generous cloud free tier + paid tiers. **Very active** (pushed today, large TS codebase). https://github.com/langfuse/langfuse

### LangSmith (LangChain) — _Eval & trace, dev-centric_
- **What it does:** Tracing, debugging, evals, prompt hub; tightly coupled to LangChain but works standalone.
- **Data surfaced:** full traces, token counts, cost estimates, latency, feedback/eval scores, metadata.
- **Connection:** SDK / env-var auto-instrumentation; OTel support.
- **Gaps:** Closed-source SaaS; best within LangChain ecosystem; enterprise self-host gated.
- **Pricing:** Free developer tier, seat + usage pricing; self-host only on enterprise.

### Portkey — _AI Gateway + observability_
- **What it does:** Gateway/router across 100+ models with observability, caching, fallbacks, guardrails, budget limits.
- **Data surfaced:** cost, tokens, latency, request logs, virtual-key/user segmentation, cache analytics.
- **Connection:** **Proxy/gateway** (OpenAI-compatible endpoint) + SDK.
- **Gaps:** Hot-path gateway dependency; deepest value requires routing traffic through them.
- **Pricing:** Free tier; paid usage; gateway is open source, full platform SaaS.

### LiteLLM (BerriAI) — _OSS gateway + cost tracking primitive_
- **What it does:** Unified OpenAI-format SDK + **proxy server (AI gateway)** to call 100+ providers; **built-in cost tracking**, budgets, logging, key management.
- **Data surfaced:** per-request cost (maintains a model→price map), tokens, model, user/key/team spend, logs to many backends (Langfuse, etc.).
- **Connection:** SDK or self-hosted proxy. Often the **plumbing** under other tools.
- **Gaps:** Gateway-centric; UI is functional not polished; you operate it.
- **Pricing:** OSS (MIT); enterprise tier. **Extremely active** (pushed today). https://github.com/BerriAI/litellm — note its `model_prices_and_context_window.json` is a widely-used canonical price map.

### Langfuse vs Braintrust vs others
- **Braintrust:** Eval-first platform (experiments, scoring, prompt iteration) with logging/observability. Strong for eval workflows; cost analytics secondary. SaaS, free tier.
- **OpenAI usage dashboard:** Native, see §2.
- **Honorable mentions:** **OpenLLMetry/Traceloop** (OTel-based instrumentation, OSS), **Arize Phoenix** (OSS LLM observability/eval, OTel-native, self-hostable), **PromptLayer** (logging + prompt management), **Datadog/New Relic LLM Observability** (APM vendors bolting on LLM spans), **Vantage/CloudZero/Cloudability** (cloud FinOps tools beginning to surface Bedrock/Azure LLM spend), **Cloudflare AI Gateway** (free proxy with analytics/caching), **OpenRouter** (multi-model proxy with per-request cost in its dashboard/API).

### Competitive takeaways
- **Observability ≠ cost-first.** Almost all incumbents are observability/eval platforms where cost is one metric among many. A **cost-and-optimization-first** product with crisp recommendations is a differentiated wedge.
- **Two connection paradigms dominate:** proxy (zero code, hot-path risk, full content) vs SDK (code change, async, full content). **Few tools serve users who only have aggregate provider-dashboard data** — a real underserved segment.
- **Cost accuracy is a moat detail:** everyone maintains model price tables; getting this right (incl. cached-input pricing, batch discounts, tiered pricing) matters.

---

## 2. LLM Provider Usage Data APIs

| Provider | Native dashboard | Programmatic usage API | Granularity | Per-request cost? | Segmentation |
|---|---|---|---|---|---|
| **OpenAI** | Yes (Usage + Costs) | **Yes** — Usage API + Costs API (Admin key) | Per-bucket (1m/1h/1d), can group | Costs API gives $; Usage gives tokens | api_key, project_id, user_id, model |
| **Anthropic** | Yes (Console) | **Yes** — Admin Usage & Cost Report API | Daily buckets (cost), 1m/1h/1d (usage) | Cost Report gives $ | api_key, workspace, model |
| **Azure OpenAI** | Azure Cost Mgmt + Monitor metrics | Azure Monitor metrics + Cost Management API | Per-metric time series / daily cost | Via Azure billing, not per-call $ | subscription, resource, deployment |
| **Google Gemini/Vertex** | GCP Billing + Cloud Monitoring | Cloud Monitoring metrics + Billing export (BigQuery) | Time-series / daily billing | Via billing export | project, model |
| **AWS Bedrock** | CloudWatch + Cost Explorer | CloudWatch metrics + Cost Explorer API + CUR | Per-metric / daily/hourly cost | Via CUR/Cost Explorer | account, model, (inference profile / tags) |
| **Mistral** | La Plateforme console | Limited/none robust public usage API | Dashboard-centric | Dashboard | workspace |
| **Cohere** | Dashboard | Limited public usage API | Dashboard | Dashboard | api key |

### Details that matter for the MVP

**OpenAI** (richest native usage API)
- **Usage API** (`/v1/organization/usage/completions`, plus `embeddings`, `images`, etc.) returns **token counts** (input, output, cached input, etc.), **request counts**, bucketed by `1m`/`1h`/`1d`, with optional `group_by` of `model`, `project_id`, `api_key_id`, `user_id`, `batch`.
- **Costs API** (`/v1/organization/costs`) returns **dollar amounts** bucketed (daily). Requires an **Admin API key** (org-level), distinct from a standard key.
- **Per-response usage:** every Chat Completions / Responses call returns a `usage` object (prompt_tokens, completion_tokens, total, plus cached & reasoning token breakdowns). This is the per-request primitive if you instrument calls.
- **Caps/limits:** historical data is queryable but rate-limited; results are paginated (`next_page`). Not truly real-time (minutes of lag). Docs: platform.openai.com/docs/api-reference/usage and /docs/api-reference/usage-costs.

**Anthropic**
- **Admin API → Usage & Cost Reports:** `/v1/organization/usage_report/messages` (token usage, bucketable 1m/1h/1d, group by api_key/workspace/model) and `/v1/organization/cost_report` (dollar costs, daily). Requires **Admin API key**.
- **Per-response usage:** Messages API responses include `usage` (input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens). Critical for prompt-caching cost analysis.
- Docs: docs.anthropic.com/en/api/admin-api/usage-cost/...

**Azure OpenAI**
- No single "usage API" returning tokens+cost per call. Use **Azure Monitor metrics** (`ProcessedPromptTokens`, `GeneratedTokens`, `TokenTransaction`, request counts) per deployment, and **Azure Cost Management** for dollars. Per-request token detail requires you to log the response `usage` object or enable diagnostic logging.
- Segmentation by subscription/resource/deployment; tagging via Azure resource tags.

**Google Vertex/Gemini**
- Usage/cost via **Cloud Monitoring** metrics and **Billing export to BigQuery** (the standard FinOps path). Gemini API responses carry `usageMetadata` (promptTokenCount, candidatesTokenCount, totalTokenCount). No dedicated token-usage REST endpoint comparable to OpenAI's.

**AWS Bedrock**
- **CloudWatch** metrics (`InputTokenCount`, `OutputTokenCount`, `Invocations`, latency) per model; **Cost Explorer API** and **CUR (Cost & Usage Report)** for dollars. Model invocation logging (to S3/CloudWatch) can capture full request/response if enabled. Tag-based and inference-profile segmentation.

**Mistral / Cohere**
- Primarily **console dashboards**; programmatic usage APIs are thin or absent. Realistically you rely on **per-response `usage` fields** (instrumentation) or manual export.

### Cross-provider implications
- **Two native data shapes:** (1) **token/usage time-series** (OpenAI/Anthropic native; Azure/GCP/AWS via metrics), and (2) **dollar cost time-series** (everyone, via billing). **Per-request rows with prompts only exist if the user instruments calls or runs a proxy/gateway.**
- **Admin keys are a friction point:** OpenAI/Anthropic usage+cost APIs need org/admin keys, not the standard inference key. Onboarding must account for this.
- **The cloud providers (Azure/GCP/AWS) are FinOps-shaped**, not LLM-shaped — token granularity is in metrics, dollars are in billing, and joining them is non-trivial. This is a known pain point.

---

## 3. Verbosity Tiers

A user will arrive with data at one of these levels. The product should detect the tier and adapt insights + "upgrade" guidance.

### Tier A — Full Trace (richest)
**Fields:** prompt text, completion text, model, prompt/completion/cached/reasoning tokens, latency/TTFT, user ID, session/conversation ID, metadata tags (feature, environment, prompt version), tool calls.
**Source:** proxy (Helicone/Portkey/LiteLLM) or SDK instrumentation (Langfuse/LangSmith).
**Insights possible:** Everything below, **plus**: prompt-level cost attribution, "expensive prompt patterns," redundant/duplicate calls, oversized system prompts, retrieval context bloat, cache-hit opportunities, model-downgrade candidates (find prompts that don't need the frontier model), per-feature/per-user/per-customer cost, prompt-version regressions.
**Optimizations recommendable:** Right-size model per prompt class; enable prompt caching (quantify savings from `cached_input` pricing); trim system prompts/few-shot; dedupe; batch; set max_tokens; switch verbose outputs to structured. **Highest-value recommendations live here.**

### Tier B — Mid (no prompt content)
**Fields:** model, tokens, cost, latency, user ID, timestamp, request ID, maybe feature tag — **no prompt/completion text.**
**Insights possible:** model mix & cost share, token-per-request distributions (find heavy requests), cost per user/feature, latency vs model tradeoffs, trend/anomaly detection, output-token-heavy vs input-heavy patterns, caching opportunity _estimation_ (via repeated identical token-count signatures, weakly).
**Not possible:** content-level recommendations ("this prompt is bloated because…"), semantic dedupe, prompt-version diffs.
**Optimizations recommendable:** "These N% of requests use the premium model but have small outputs — test a cheaper model"; "output tokens dominate cost — cap max_tokens / request concise format"; per-user budget alerts; spot model-mix inefficiency. **This is the sweet-spot privacy/value tier** — strong analysis, no content exposure.

### Tier C — Aggregate Only (leanest)
**Fields:** daily/monthly totals by model (tokens and/or dollars). The native OpenAI Costs / Anthropic Cost Report / cloud billing export level.
**Insights possible:** total spend & trend, spend-by-model breakdown, month-over-month growth, simple forecasting, budget tracking, "you're 80% on the most expensive model" headline.
**Not possible:** per-request, per-user, per-feature attribution; any content or token-distribution analysis.
**Optimizations recommendable:** High-level only — "frontier model is 85% of spend; pilot a cheaper model on a workload," "spend is growing 30%/mo, set a budget," forecast end-of-month cost. **Low effort to onboard (just an admin key), low insight ceiling.**

### Design consequence
Build a **tiered insight engine** that (1) classifies the user's data tier, (2) shows the best insights available at that tier, and (3) **explicitly nudges to the next tier** ("Connect via proxy/SDK to unlock prompt-level savings of est. $X"). The "guidance on getting more verbose data" requirement maps directly onto these tiers.

---

## 4. Privacy & Anonymization Approaches

Prompt/completion content is the most sensitive and most valuable data. How incumbents handle it:

### Common techniques
- **Opt-in logging / content toggle:** Most platforms let you log requests but **disable input/output capture** (log metadata+tokens only). Helicone, Langfuse, LangSmith all support "omit content." This is the dominant enterprise control.
- **Client-side redaction / PII scrubbing:** Regex + ML detectors (emails, SSNs, credit cards, names) before data leaves the customer (e.g. Presidio-based). LangSmith/Langfuse offer masking hooks; Helicone has key/PII redaction.
- **Truncation:** Store only first/last N chars or token counts, not full bodies.
- **Hashing:** Hash prompts to detect duplicates/cache opportunities **without storing content** (enables dedupe analytics at Tier B). One-way; supports "this exact prompt ran 4,000×" insights privately.
- **Tokenization/structural metadata only:** Keep token counts, structure (n messages, roles, tool calls), embeddings/semantic clusters — not raw text. Embeddings allow clustering "similar expensive prompts" without revealing them (though embeddings can leak; treat as sensitive).
- **Field-level encryption / customer-managed keys (CMK/BYOK):** Enterprise expectation for any content at rest.

### What enterprise customers typically require
- **No prompt content leaving their boundary**, or strict opt-in + redaction + retention limits.
- **Self-hosting / VPC deployment** option (why Langfuse/Helicone/LiteLLM OSS win enterprise).
- **Data residency**, **SOC 2 Type II**, configurable **retention/TTL & deletion**, **RBAC**, **audit logs**, **no training on their data**, **PII redaction**, **SSO**.
- **Zero-Data-Retention (ZDR)** alignment with the underlying providers.

### Standards/frameworks
- No single dedicated "LLM data privacy" standard yet. In practice teams compose: **OpenTelemetry GenAI semantic conventions** (standardizes span/attribute names incl. guidance to make content capture optional), **Microsoft Presidio** (open-source PII detection/anonymization), **NIST AI RMF / ISO 42001** (governance), plus general **SOC 2 / GDPR / HIPAA** controls. OTel GenAI conventions are the closest thing to an emerging standard for _what fields to capture and how to gate content_.

### Minimum data for meaningful cost analysis without exposing content
**You do not need prompt/completion text for strong cost analytics.** The minimum viable set:
- `timestamp`, `model`, `input_tokens`, `output_tokens` (+ `cached_input_tokens` if available), and **dollar cost** (derived or provided).
Strongly recommended optional, still non-sensitive: `request_id`, `latency`, `user_id`/`feature_tag` (pseudonymous), `prompt_hash` (for dedupe), `status`.
This is exactly **Tier B**, and it unlocks ~80% of actionable cost recommendations while keeping content out of scope — a defensible default posture for the MVP.

---

## 5. Open Source Projects (reference implementations / potential foundations)

| Project | What it is | License | Activity | Link |
|---|---|---|---|---|
| **Langfuse** | Full OSS observability/eval/cost platform (TS + Postgres/ClickHouse). Best reference for data model, cost computation, tracing schema. | MIT (core) | **Very high** — pushed 2026-06-18; YC W23 | github.com/langfuse/langfuse |
| **LiteLLM** | OSS gateway + **cost-tracking engine**; canonical `model_prices_and_context_window.json` price map (reuse this!). | MIT | **Very high** — pushed 2026-06-18 | github.com/BerriAI/litellm |
| **Helicone** | OSS proxy-based observability (TS, ClickHouse). Reference for proxy ingestion + cost calc. | Apache-2.0 | **High** — pushed 2026-06-11; YC W23 | github.com/Helicone/helicone |
| **Arize Phoenix** | OSS LLM observability/eval, **OTel-native**, self-hostable. Good for OTel ingestion patterns. | Elastic/ Apache | High | github.com/Arize-ai/phoenix |
| **OpenLLMetry / Traceloop** | OSS OTel-based auto-instrumentation SDKs for LLM calls. | Apache-2.0 | High | github.com/traceloop/openllmetry |
| **tokencost** (AgentOps) | Python lib mapping model→price + token counting; quick cost estimation. | MIT | Moderate | github.com/AgentOps-AI/tokencost |
| **tiktoken** (OpenAI) | Tokenizer for offline token counting/estimation. | MIT | Maintained | github.com/openai/tiktoken |
| **Microsoft Presidio** | PII detection/anonymization — for the privacy layer. | MIT | High | github.com/microsoft/presidio |

**Key reuse opportunities:** LiteLLM's price map + tokencost/tiktoken give you accurate cost computation **without building a pricing database from scratch**. Langfuse's schema is the best blueprint for a trace/cost data model. Presidio handles redaction if you ever ingest content.

---

## Key Implications for MVP Design

1. **Position as cost-first, not another observability tool.** Incumbents (Langfuse, Helicone, LangSmith) are trace/eval platforms where cost is incidental. A focused "understand & cut your LLM spend, with concrete recommendations" wedge is differentiated and demoable in 1.5 weeks.

2. **Make Tier B (model + tokens + cost + user, no content) the default supported tier.** It unlocks ~80% of actionable recommendations, sidesteps the hardest privacy problem, and matches what providers expose. Treat full-trace (Tier A) as an upsell, not a launch requirement.

3. **Lead onboarding with the lowest-friction path: native usage/cost APIs (OpenAI Costs/Usage API, Anthropic Cost Report).** But design for the **admin-key friction** — these need org/admin keys, not inference keys. For cloud providers (Azure/GCP/AWS), aggregate billing/metrics is the realistic v1 input; per-call detail is out of scope unless they instrument.

4. **Build a tiered insight engine that classifies the user's data verbosity and explicitly upsells the next tier.** This directly satisfies the "guidance on getting more verbose data" goal and turns a limitation into a product loop ("connect a proxy/SDK to unlock $X of prompt-level savings").

5. **Do not build a pricing database from scratch — adopt LiteLLM's `model_prices_and_context_window.json` (+ tiktoken/tokencost).** Cost accuracy (incl. cached-input and batch pricing) is a make-or-break detail and a common failure point; reuse the community-maintained map.

6. **Ship a default privacy posture of "no prompt/completion content."** Use token counts, dollars, model, pseudonymous user/feature tags, and optional one-way `prompt_hash` for dedupe insights. This is enterprise-friendly out of the gate; offer content capture only as explicit opt-in later.

7. **Anchor the recommendation set on the highest-ROI, tier-appropriate levers:** model right-sizing (premium model on cheap workloads), output-token control (max_tokens / concise formats), prompt caching savings quantification, and dedupe/batching. These are computable at Tier B for most, deepen at Tier A.

8. **Keep ingestion modular for two paradigms** — (a) pull from provider usage/cost APIs (v1 priority), (b) push via SDK/proxy/OTel for richer tiers (v2). Aligning the data model with **OpenTelemetry GenAI semantic conventions** future-proofs ingestion and content-gating.
