# Agentic Development Flow — Promptly

This document describes how Promptly was built using AI agents. Each phase has a clear goal, a set of specialized agents, and a gate that must pass before the next phase begins. A human directs the work and approves every handoff.

---

## Phase 0 — Definition and Research

**Goal:** Define what we're building, scope the first version, and gather enough background that the team can write a solid spec.

This phase is a conversation between the developer and an AI planning partner. The planning partner asks questions to clarify goals and constraints, identifies what research is needed, and sends a researcher to fill in the gaps. Once the research comes back, the planning partner synthesizes it into a brief that the spec writers can act on.

### Agents

**AI planning partner**
Runs the ideation conversation, frames the problem, figures out what needs to be researched, and turns the findings into actionable guidance. Doesn't write artifacts — connects the developer's vision to the agents that do.

**researcher**
Looks into the problem space: competing tools, where the data comes from, how to access it, and what's actually feasible. Writes a research report that keeps the spec grounded in reality.

Note: the researcher isn't done after Phase 0. Whenever the spec writers surface a question they can't answer, the researcher is called in to answer it.

### Loop

```
developer shares vision → planning partner frames it → researcher investigates → planning partner synthesizes
→ brief handed to spec writers
Researcher comes back as needed throughout Phase 1
```

### Output

- [`research/llm-analytics-landscape.md`](./research/llm-analytics-landscape.md) — Overview of the AI analytics space, competing tools, and what's feasible
- [`research/github-copilot-data-access.md`](./research/github-copilot-data-access.md) — How to get GitHub Copilot usage data (written during Phase 1 as questions came up)
- [`research/claude-anthropic-data-access.md`](./research/claude-anthropic-data-access.md) — How to get Claude / Anthropic usage data (written during Phase 1)
- Scope decision: focus on individual developer spend, use local data sources where possible, avoid proxy dependencies

---

## Phase 1: Spec Creation

**Goal:** Write a product spec that is complete, consistent, and has no open questions before design begins.

### Agents

**specification drafter**
Writes the spec from the developer's vision and research. Revises it as feedback comes in from the critic and consistency checker.

**specification critic**
Reviews the spec against a fixed checklist: completeness, internal consistency, scope clarity, data model accuracy, edge case coverage, and ambiguity. Returns a list of issues categorized as blocking or non-blocking. Loops with the specification drafter until there are no blocking issues left.

**consistency checker**
Reads the spec looking for contradictions, broken references, mismatched data, and scope drift. Never edits — only reports. Runs after the specification critic gives a clean pass.

**researcher**
Called in whenever the spec writers hit a question they can't answer from existing research.

### Loop

```
specification critic reviews → specification drafter fixes → repeat until zero blocking issues
consistency checker runs as the final gate
Spec is done when both pass clean
```

### Output

- `docs/spec.md` -- versioned specification
- `docs/spec-changelog.md` -- revision history

---

## Phase 2: Engineering Design

**Goal:** Turn the approved spec into a concrete technical plan — what gets built, how the pieces fit together, and what the key decisions are.

### Agents

**architect**
Writes the engineering design from the approved spec. Covers system structure, component breakdown, data flow, API contracts, the adapter pattern, the metrics engine, recommendation logic, the frontend structure, and the test plan.

**design reviewer**
Reviews the design for correctness, completeness, and faithfulness to the spec. Returns blocking and advisory issues. When reviewing changes, focuses only on what changed. Loops with the architect until there are no blocking issues left.

**architect (errata pass)**
When the design reviewer finds blockers, the architect writes a targeted fix document — specific corrections only, not a full rewrite. The design reviewer checks the fixes before signing off.

### Loop

```
architect writes design → design reviewer finds issues → architect fixes blockers → design reviewer confirms → done
For amendments: loop covers only the changed sections
```

### Output

- `docs/engineering-design.md` -- canonical merged design (base + all amendments + errata applied)
- `docs/engineering-design-amendment-v1.0-v1.1.md` -- amendment delta (historical reference)
- `docs/engineering-design-amendment-v1.2.md` -- amendment delta for GitHub Copilot adapter redesign (v1.2)
- `docs/engineering-design-errata.md` -- blocker fixes record

---

## Phase 3: Development

**Goal:** Build the engineering design into working code, in the right order.

### Agents

**gap analyst**
Reads the codebase and the design, finds every file that needs to change and exactly what needs to change in each, and produces a prioritized task list. The developer reviews and approves this list before any code is written.

**developer**
Handles implementation. For each task: reads the design, makes the changes, runs a type check to confirm nothing is broken, and reports back. Tasks that don't depend on each other run at the same time; tasks that do are chained in order.

### Task order

Work flows through layers, each depending on the one before:

```
types → infrastructure → adapters → metrics engine → backend routes → frontend
```

Tasks within the same layer run in parallel. A layer only starts when the previous one passes a clean type check.

### Loop

```
gap analysis → task list approved → developer works through tasks in order → type check passes → next task
If a task fails: retry with the failure context before escalating
```

### Output

A working application with clean type checks across the server and client.

---

## Phase 4: Test Development and Testing

**Goal:** Build a complete test suite and run it until everything passes.

### Agents

Three developer agents write the three test suites at the same time:

**developer (server unit tests)**
Writes tests for the core server logic: price calculations, billing tiers, adapter behavior, the metrics engine, and recommendation rules.

**developer (client component tests)**
Writes tests for the UI components: the source connection cards and each provider panel.

**developer (E2E tests)**
Writes end-to-end tests covering the full user flow: connecting a source, running an analysis, and exporting results. All tests run against fixed mock data — no real API keys needed.

**developer (fixes)**
After the full suite runs, diagnoses any failures and applies targeted fixes.

### Test suite

| Suite | Location | Tests | Framework |
|---|---|---|---|
| Server unit tests | `server/tests/` | 272 | Vitest |
| Client component tests | `client/tests/` | 439 | Vitest + React Testing Library |
| End-to-end tests | `e2e/` | 15 | Playwright (mocked) |
| **Total** | | **726** | |

### Loop

```
tests written → full suite runs → failures diagnosed → fixes applied → re-run → all green
```

### Output

701 passing tests. `npm test` runs the full suite from the repo root. No credentials needed.

---

## Phase 5: UX Review

**Goal:** Confirm that the UI works well for all users — including those using keyboards, screen readers, or small screens — before the product ships.

Phase 5 is a three-agent review coordinated by an orchestrator. First, the orchestrator reads the codebase to figure out what needs to be tested: which files, which user flows, which screen sizes. It presents this plan to the developer for review. Once approved, three reviewers run at the same time. Their findings are combined into a single report, with duplicate issues merged.

### Agents

**UX orchestrator**
Works in two modes. In discovery mode, it reads the repo to build the review plan — which files to scan, which flows to test, which screen sizes to check — then saves a summary for the developer to review and stops. In dispatch mode, once the developer confirms the plan, it kicks off the three reviewers in parallel.

**static reviewer**
Reads source files without running the app. Checks for: correct use of semantic HTML, proper heading structure and form labels, text alternatives for images and icons, focus handling when the page changes, error messages that are announced to screen readers, consistent use of design tokens, animations that respect reduced-motion settings, and accurate accessible names. Gate: BLOCKED if any critical finding.

**runtime reviewer**
Runs the live app in a browser across all flows and three screen sizes (desktop, tablet, mobile). Checks for: color contrast on text and UI controls, keyboard navigation and focus order, a skip link for keyboard users, visible states for interactive elements, loading indicators that appear quickly enough, touch targets that are large enough on mobile, layout at different sizes, and text readability when spacing is increased. Gate: BLOCKED if any critical finding.

**semantic reviewer**
Takes screenshots of each flow and screen size, then reasons over them as a senior UX designer would — no automated rules, just judgment. Checks for: clear information structure, readable content and effective calls to action, appropriate complexity, good use of progressive disclosure, plain language, repetition, how errors are surfaced, accuracy of completion states, and whether any elements are hidden behind others. Distinguishes between findings it can measure precisely and findings based on visual judgment. Gate: CLEAR if no critical findings; NEEDS HUMAN REVIEW if critical findings based on visual judgment are present.

### Loop

```
orchestrator reads repo → developer reviews and approves the plan → orchestrator starts reviewers
static, runtime, and semantic reviewers run in parallel
all three finish → duplicates merged, highest severity wins
→ final report: BLOCKED / NEEDS HUMAN REVIEW / CLEAR
```

### Output

- Review plan — the confirmed list of flows, screen sizes, and files used for the run
- Static findings — every issue found in source code, with location, what breaks, and how to fix it
- Runtime findings — every issue found in the live app, with measured evidence
- Semantic findings — all judgment-based findings with a clear statement of confidence level
- Final report — all findings combined, categorized by severity (critical / should fix / advisory), with fixes

---

## Human in the Loop

The developer directs the work at every stage.

Approval gates:
- Approves the spec before design begins
- Reviews and approves the engineering design, or escalates blockers
- Reviews and approves the gap analysis task list before development starts
- Sees each task result as it completes and can redirect at any point
- Reviews the UX review plan (flows, screen sizes, trigger steps) before any review agent is dispatched

Agents never make product decisions on their own. They work within a defined scope and flag anything unclear for the developer to resolve. All decisions belong to the developer — agents propose, the developer decides.




