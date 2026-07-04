# Promptly Engineering Design — Changelog

> **Reference file.** The canonical engineering design is [`engineering-design.md`](./engineering-design.md).  
> This file records changes between versions. For spec changes, see [`spec-changelog.md`](./spec-changelog.md).

### v1.3 (2026-07-03)

- **[§3.5]** `crossSource.ts:totalTokens()` — documented Copilot branch requirement: must read `copilotTokenBreakdownByModel` (not `modelBreakdown`) to avoid silently excluding Copilot tokens from cross-source aggregates. (F1)
- **[§3.6]** `COPILOT_DOWNGRADE_MAP` — added negative lookahead to GPT premium model regex (`/^gpt-5\.4(?!-mini)|^gpt-5\.5(?!-mini)/i`) so the downgrade target `gpt-5.4-mini` does not trigger a self-downgrade; supersedes `engineering-design-errata.md` Fix 3's older regex without the lookahead.
- **[§4.7, §5]** `PrintLayout` per-source summary fields — added `totalActualTokens` and `totalSpendUsd` to `SourceMetrics` so Page 1 can read `source.metrics.totalActualTokens` and `source.metrics.totalSpendUsd` directly.
- **[§3.6]** R3 threshold — documented explicit trigger threshold `p90_daily_input_tokens > 50000` used with `aggregate_input_output_ratio > 8`.
- **[§5]** `TierClassification` — added interface documentation for per-source tier assignment results (`sourceId`, `tier`, `reason`) used by the tier classifier.
- **[§5]** `InsightResult` — added internal computed-metric interface documentation and clarified that §7 metrics are flattened onto `SourceMetrics` in the public report.
- **[§3.5]** `computeCopilotTierBMetrics()` — documented `dailySpend[]` computation bucketed by `NormalizedCopilotSession.date`. (F2)
- **[§3.5]** `computeCopilotTierBMetrics()` — documented `aggregateInputOutputRatio` from model aggregates. (F3)
- **[§4.5]** `ClaudeCodePanel` — added `aggregateInputOutputRatio` KPI tile to component spec (field was already computed). (F4)
- **[§3.5]** `computeCopilotTierBMetrics()` — changed `momChangePct` to the shared 30-day-window formula `(last30Sum − prev30Sum) / prev30Sum × 100` with `null` when fewer than 45 daily data points; documented `avgDailySpendUsd`, `peakSpendDay`, and `rollingAvgSpend7dUsd` from `dailySpend[]`; recommend `computeDailySpendStats()` shared helper. (F5)
- **[§4.5]** `OpenAIPanel`, `AnthropicPanel`, `ClaudeCodePanel` — added `rollingAvgSpend7dUsd` and `momChangePct` KPI tiles to component specs (fields were already computed). (F6)
- **[§3.5, §4.5, §4.7, §5, §10]** `copilotAvgTokensPerSession` full treatment: formula documented (inputTokens + outputTokens per session, Copilot total-field semantics), KPI tile added to `CopilotPanel` spec, `serializeReport.ts` mapping noted, `PrintLayout` Copilot section updated. (F7)
- **[§3.6, §5]** R1 `buildR1Card()` — documented forward-looking projected-savings formula per spec §8 R1 with `reuse_factor = 0.5`; added `projectedR1SavingsUsd` to `SourceMetrics`. Corrected from v1.2 which did not specify the formula and used backward-looking realized savings. (F8)
- **[§3.6, §5]** R3 `R3_verbosity.ts` — changed R3 evaluation to the shared p90 mechanism `p90_daily_input_tokens > 50000 AND aggregate_input_output_ratio > 8` across Tier B token sources; documented Copilot coverage by removing the exclusion, adding the `copilotDailyInputTokens` path to `getP90DailyInputTokens()`, and adding `copilotDailyInputTokens` to `SourceMetrics`. (F9)
- **[§6]** ADR-2 Copilot downgrade table — corrected `claude-fable-5` cheaper alternative from `claude-sonnet-4-6` → `claude-haiku-4-5`. (F10)
- **[§4.7]** `PrintLayout` — documented Page 4: Assumptions & Caveats section. (F11)
- **[§4.7]** `PrintLayout` — documented Page 1 per-source summary table. (F12)
- **[§4.7]** `PrintLayout` — documented that recommendations section renders all fired recommendations; no cap. Corrected from v1.2 which erroneously applied `.slice(0, 3)`. (F13)
- **[§5]** `SourceId` type block — added `'claude_code'` (was missing in ED prose; code was already correct). (ED-DOC-1)
- **[§5]** `SourceMetrics` — corrected `avgDailyOutputTokensPerModel` type to `{ model: string; avgDailyOutputTokens: number }[]`, matching the §5 interface and implementation shape. (ED-DOC-1)
- **[§5]** `SourceMetrics` — added `projectedR1SavingsUsd` and `copilotDailyInputTokens` field documentation.
- **[§5]** JSON export `github_copilot` example — added `avg_tokens_per_session` field. (ED-DOC-2)
- **[§11]** Changelog extracted to `engineering-design-changelog.md`; §11 replaced with reference link.

### v1.2 (2026-06-25)

- Amendment v1.2: replaced legacy Copilot billing/engagement normalized types with `NormalizedCopilotSession`; updated `NormalizedSourceData` (`copilotSessions` field); added `CopilotModelMetrics` and `CopilotShutdownEvent` adapter-private interfaces; removed the legacy Copilot plan-cost option from `SourceConfig`, `SessionState`, §8, §9; updated metrics table input types; updated `isModelCostEstimated()` comment; removed GitHub from ADR-1 CORS rationale; cleaned §9 A2/A3, §10 review note.

### v1.1

- See `engineering-design-amendment-v1.0-v1.1.md` for full change details.

### v1.0

- Initial release.
