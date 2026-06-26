# Agentic Development Flow -- Promptly

This document describes the end-to-end AI-assisted workflow used to build the Promptly project. Each phase is driven by specialized agents operating in critique-and-fix loops, with a human directing and approving at every gate. The workflow is designed so that no phase begins until the previous one has passed a structured review.

---

## Phase 0 — Definition and Research

**Goal:** Define the problem space, scope the MVP, and produce a research foundation that spec-draft can build from.

Phase 0 is a structured conversation between the human and the AI planning partner. The planning partner's role is to surface scope, constraints, and unknowns through targeted questions, then dispatch the researcher to fill knowledge gaps, and synthesize the output into a brief that spec-draft can act on.

**Agents involved:**

1. **AI planning partner (orchestrator)** -- Facilitates the ideation conversation, helps frame and scope the problem, identifies what research is needed, dispatches the researcher, and synthesizes findings into guidance for spec-draft. Does not produce artifacts directly -- acts as the connective layer between the human's vision and the execution agents.

2. **researcher** -- Investigates the problem domain: competitive landscape, platform data availability, API access paths, pricing models, and feasibility constraints. Produces a research report that grounds the spec in what is actually possible.

   Note: researcher does not stop at the end of Phase 0. As spec-draft surfaces specific data-access questions during Phase 1, researcher is dispatched on demand to answer them.

**Loop mechanic:** Human articulates vision → planning partner scopes and frames → researcher investigates → planning partner synthesizes findings → brief handed to spec-draft. Researcher loops back throughout Phase 1 as new questions arise.

**Output:**
- [`research/llm-analytics-landscape.md`](./research/llm-analytics-landscape.md) -- LLM usage analytics landscape, competitive tools, and feasibility analysis
- [`research/github-copilot-data-access.md`](./research/github-copilot-data-access.md) -- GitHub Copilot usage data access paths (produced during Phase 1 as spec questions surfaced)
- [`research/claude-anthropic-data-access.md`](./research/claude-anthropic-data-access.md) -- Claude and Anthropic usage data access paths (produced during Phase 1)
- Scoping guidance: individual developer spend, local data sources where possible, no proxy dependency

---

## Phase 1: Spec Creation

**Goal:** Produce a product specification that is internally consistent, complete, and critique-proof before any design work begins.

### Agents

**spec-draft**
Drafts the initial spec from the user's vision and research input. Iterates on sections as feedback arrives from critique and consistency passes.

**spec-critique**
Reviews the spec against a structured checklist covering: completeness, consistency, scope clarity, data model correctness, edge case coverage, and ambiguity. Returns a categorized list of blocking and non-blocking issues. Runs in a loop with spec-draft until zero blocking issues remain.

**doc-consistency**
Cross-checks the spec for internal contradictions, broken references, mismatched data, and scope drift. Read-only -- surfaces issues only, never modifies. Runs after spec-critique passes clean.

**researcher**
Brought in as needed to fill knowledge gaps -- for example, how a specific platform's billing API works, what pricing data is publicly available, or competitive landscape context.

### Loop Mechanic

```
spec-critique -> spec-draft fixes -> spec-critique re-checks -> repeat until 0 blocking issues
doc-consistency runs as final gate
Spec is done when both pass clean
```

### Output

- `docs/spec.md` -- versioned specification
- `docs/spec-changelog.md` -- revision history

---

## Phase 2: Engineering Design

**Goal:** Translate the spec into a concrete technical design covering architecture, data models, component contracts, and implementation decisions.

### Agents

**architect**
Produces the engineering design document from the approved spec. Covers: system architecture, component breakdown, data flow, API contracts, adapter model, metrics engine, recommendation rules, frontend structure, and test strategy.

**design-review**
Reviews the engineering design for correctness, completeness, and spec fidelity. Returns blocking and advisory issues. When reviewing amendments, scope is restricted to the changed sections only. Runs in a loop with architect until zero blocking issues remain.

**architect (errata pass)**
When design-review surfaces blockers, architect produces a targeted errata document -- specific fixes only, not a full redesign. design-review re-checks the errata before sign-off.

### Loop Mechanic

```
architect produces design -> design-review critiques -> architect fixes blockers -> design-review confirms -> clean
For amendments: loop scoped to changed sections only
```

### Output

- `docs/engineering-design.md` -- canonical merged design (base + all amendments + errata applied)
- `docs/engineering-design-amendment-v1.0-v1.1.md` -- amendment delta (historical reference)
- `docs/engineering-design-amendment-v1.2.md` -- amendment delta for GitHub Copilot adapter redesign (v1.2)
- `docs/engineering-design-errata.md` -- blocker fixes record

---

## Phase 3: Development

**Goal:** Implement the engineering design in working code, in logical dependency order.

### Agents

**code (gap analysis)**
Reads the codebase and the canonical design, identifies every file that needs to change and what specifically needs to change, and produces a prioritized task list. This gap analysis is reviewed and approved by the developer before implementation begins.

**developer**
The primary implementation agent. Given a task from the gap analysis, it reads the canonical design, writes or modifies the relevant files, runs `tsc` to verify type correctness, and reports the result. Independent tasks are run in parallel; dependent tasks are chained sequentially.

### Task Sequencing

Tasks are ordered by dependency:

```
types -> infrastructure -> adapters -> metrics engine -> backend routes -> frontend
```

Independent tasks within a tier run in parallel. The next task in a chain is only assigned after the previous one completes with a clean TypeScript build.

### Loop Mechanic

```
gap analysis -> task list approved -> developer assigned task 1 -> tsc clean -> developer assigned task 2 -> ... -> all tasks done
If a task fails: retry with failure context before escalating
```

### Output

Working implementation with clean TypeScript builds across server and client.

---

## Phase 4: Test Development and Testing

**Goal:** Build a comprehensive test suite covering all components and run it to verify correctness.

### Agents

Three developer agents run in parallel to build the three test suites simultaneously:

**developer -- Agent A (server unit tests)**
Writes Vitest tests covering: priceMap, tiers registry, adapter logic (isPeakHour, JSONL parsing), metrics engine, and recommendation rules.

**developer -- Agent B (client component tests)**
Writes Vitest + React Testing Library tests covering: SourceCard, CopilotPanel, ClaudeCodePanel, AnthropicPanel, and OpenAIPanel.

**developer -- Agent C (E2E tests)**
Writes Playwright tests covering: connection flow, analysis pipeline, and export. All tests run against mock fixtures -- no real credentials required. Adapter network calls are mocked via `page.route()` so the suite runs fully offline.

**developer (fixes)**
After the full suite runs, any failures are diagnosed and fixed in targeted single-pass corrections.

### Test Structure

| Suite | Location | Count | Framework |
|---|---|---|---|
| Server unit tests | `server/tests/` | 44 | Vitest |
| Client component tests | `client/tests/` | 20 | Vitest + RTL |
| E2E tests | `e2e/` | 14 | Playwright (mocked) |
| **Total** | | **78** | |

### Loop Mechanic

```
tests authored -> full suite run -> failures diagnosed -> fixes applied -> re-run -> green
```

### Output

78 passing tests across three tiers. `npm test` runs all suites from the repo root. No credentials needed.

---

## Human in the Loop

The developer acts as the directing intelligence throughout the entire workflow.

Approval gates:
- Approves the spec before design begins
- Reviews and approves the engineering design, or escalates blockers
- Reviews and approves the gap analysis task list before development starts
- Sees each task result as it completes and can redirect at any point

Agents never make product decisions autonomously. They execute within a defined scope and surface any ambiguity for human resolution. All architectural decisions belong to the human -- agents propose, the human decides.




