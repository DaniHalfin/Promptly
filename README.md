# Promptly

> Promptly helps you understand and optimize what you spend on AI. Usage trends, cost breakdowns, and actionable recommendations — so you're always in control of your AI budget, not surprised by it.

## Overview

Promptly is a local-first monorepo for analyzing AI usage and spend across the tools and providers teams use every day. It brings fragmented billing and usage signals into a single experience so you can understand where budget is going, which models are driving cost, and what concrete steps will reduce spend without losing capability.

The platform is designed for practical cost visibility: connect supported sources, review normalized usage data, inspect trends and peaks, and act on prioritized recommendations. The current implementation emphasizes privacy-conscious analysis, a fast developer workflow, and a clear path from raw usage to decisions.

## Features

- **Currently supports** GitHub Copilot, Claude Code, OpenAI API, and Claude API — with an extensible adapter model for additional sources
- **Cost breakdowns** by source and model so you can pinpoint the biggest drivers of spend
- **Peak-hour analysis** to identify concentration during expensive or overloaded usage windows
- **Actionable recommendations** for caching, model selection, prompt efficiency, and off-peak usage — ranked by estimated savings
- **Up-to-date pricing estimates** — model costs are fetched fresh at startup so your analysis reflects current rates

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install and run

```bash
cd promptly
npm install
npm run dev
```

Open <http://localhost:5173>.

## Running Tests

All test suites run locally and require no credentials.

```bash
npm --workspace server run test
npm --workspace client run test
npx playwright test
```

- **Server unit tests:** 44 tests
- **Client component tests:** 20 tests
- **End-to-end tests:** 14 tests

## Project Structure

```text
promptly/
├─ client/                 # React + Vite frontend
│  ├─ src/                 # Application source (components, context, pages)
│  └─ tests/               # Vitest + React Testing Library unit tests
├─ server/                 # Express + TypeScript backend
│  ├─ src/                 # Application source (adapters, engine, routes)
│  └─ tests/               # Vitest unit tests
├─ e2e/                    # Playwright end-to-end tests
│  └─ fixtures/            # Mock API response fixtures
├─ docs/                   # Product, engineering, and research documentation
│  └─ research/            # Phase 0 research artifacts
├─ playwright.config.ts    # E2E configuration
├─ package.json            # Workspace scripts and dependencies
└─ package-lock.json
```

## Contributing

1. Fork the repository.
2. Create a branch using one of these prefixes:
   - `feature/`
   - `fix/`
   - `docs/`
3. Make your changes with focused commits.
4. Run the full test bar before opening a pull request.
5. Open a PR with a clear summary, testing notes, and any relevant screenshots.

All 78 tests must pass before review or merge.

## Docs

Project documentation lives in [`docs/`](./docs/):

| File | Purpose |
|---|---|
| [`spec.md`](./docs/spec.md) | Product spec — current canonical |
| [`spec-changelog.md`](./docs/spec-changelog.md) | Spec revision history (reference, load on demand) |
| [`engineering-design.md`](./docs/engineering-design.md) | Engineering design — current canonical |
| [`engineering-design-amendment-v1.0-v1.1.md`](./docs/engineering-design-amendment-v1.0-v1.1.md) | Amendment reference (v1.0 → v1.1 delta) |
| [`engineering-design-errata.md`](./docs/engineering-design-errata.md) | Blocker fixes applied to v1.1 |
| [`agentic-dev-flow.md`](./docs/agentic-dev-flow.md) | End-to-end agentic development workflow used to build this project |
| [`research/llm-analytics-landscape.md`](./docs/research/llm-analytics-landscape.md) | Phase 0 research — LLM usage analytics landscape and competitive tools |
| [`research/github-copilot-data-access.md`](./docs/research/github-copilot-data-access.md) | Phase 0 research — GitHub Copilot usage data access paths |
| [`research/claude-anthropic-data-access.md`](./docs/research/claude-anthropic-data-access.md) | Phase 0 research — Claude and Anthropic usage data access paths |

## License

MIT









