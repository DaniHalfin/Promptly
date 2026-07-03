# Promptly Engineering Design — Changelog

> **Reference file.** The canonical engineering design is [`engineering-design.md`](./engineering-design.md).  
> This file records changes between versions. For spec changes, see [`spec-changelog.md`](./spec-changelog.md).

### v1.3 (2026-07-03)

- **[§3.5]** `crossSource.ts:totalTokens()` — documented Copilot branch requirement: must read `copilotTokenBreakdownByModel` (not `modelBreakdown`) to avoid silently excluding Copilot tokens from cross-source aggregates. (F1)
- **[§3.5]** `computeCopilotTierBMetrics()` — documented `dailySpend[]` computation bucketed by `NormalizedCopilotSession.date`. (F2)
- **[§3.5]** `computeCopilotTierBMetrics()` — documented `aggregateInputOutputRatio` from model aggregates. (F3)
- **[§4.5]** `ClaudeCodePanel` — added `aggregateInputOutputRatio` KPI tile to component spec (field was already computed). (F4)
- **[§3.5]** `computeCopilotTierBMetrics()` — documented `avgDailySpendUsd`, `peakSpendDay`, `rollingAvgSpend7dUsd`, `momChangePct` from `dailySpend[]`; recommend `computeDailySpendStats()` shared helper. (F5)
- **[§4.5]** `OpenAIPanel`, `AnthropicPanel`, `ClaudeCodePanel` — added `rollingAvgSpend7dUsd` and `momChangePct` KPI tiles to component specs (fields were already computed). (F6)
- **[§3.5, §4.5, §4.7, §5, §10]** `copilotAvgTokensPerSession` full treatment: formula documented (inputTokens + outputTokens per session, Copilot total-field semantics), KPI tile added to `CopilotPanel` spec, `serializeReport.ts` mapping noted, `PrintLayout` Copilot section updated. (F7)
- **[§3.6, §5]** R1 `buildR1Card()` — documented forward-looking projected-savings formula per spec §8 R1 with `reuse_factor = 0.5`; added `projectedR1SavingsUsd` to `SourceMetrics`. Corrected from v1.2 which did not specify the formula and used backward-looking realized savings. (F8)
- **[§3.6, §5]** R3 `R3_verbosity.ts` — documented Copilot coverage: remove exclusion, add `copilotDailyInputTokens` path to `getP90DailyInputTokens()`; added `copilotDailyInputTokens` to `SourceMetrics`. (F9)
- **[§6]** ADR-2 Copilot downgrade table — corrected `claude-fable-5` cheaper alternative from `claude-sonnet-4-6` → `claude-haiku-4-5`. (F10)
- **[§4.7]** `PrintLayout` — documented Page 4: Assumptions & Caveats section. (F11)
- **[§4.7]** `PrintLayout` — documented Page 1 per-source summary table. (F12)
- **[§4.7]** `PrintLayout` — documented that recommendations section renders all fired recommendations; no cap. Corrected from v1.2 which erroneously applied `.slice(0, 3)`. (F13)
- **[§5]** `SourceId` type block — added `'claude_code'` (was missing in ED prose; code was already correct). (ED-DOC-1)
- **[§5]** `SourceMetrics` — added `avgDailyOutputTokensPerModel` field documentation. (ED-DOC-1)
- **[§5]** `SourceMetrics` — added `projectedR1SavingsUsd` and `copilotDailyInputTokens` field documentation.
- **[§5]** JSON export `github_copilot` example — added `avg_tokens_per_session` field. (ED-DOC-2)
- **[§11]** Changelog extracted to `engineering-design-changelog.md`; §11 replaced with reference link.

### v1.2 (2026-06-25)

- Amendment v1.2: replaced legacy Copilot billing/engagement normalized types with `NormalizedCopilotSession`; updated `NormalizedSourceData` (`copilotSessions` field); added `CopilotModelMetrics` and `CopilotShutdownEvent` adapter-private interfaces; removed the legacy Copilot plan-cost option from `SourceConfig`, `SessionState`, §8, §9; updated metrics table input types; updated `isModelCostEstimated()` comment; removed GitHub from ADR-1 CORS rationale; cleaned §9 A2/A3, §10 review note.

### v1.1

- See `engineering-design-amendment-v1.0-v1.1.md` for full change details.

### v1.0

- Initial release.
