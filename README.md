# Promptly

> Promptly helps you understand and optimize what you spend on AI. Usage trends, cost breakdowns, and actionable recommendations — so you're always in control of your AI budget, not surprised by it.

## Overview

Promptly is a local-first monorepo for analyzing AI usage and spend across the tools and providers teams use every day. It brings fragmented billing and usage signals into a single experience so you can understand where budget is going, which models are driving cost, and what concrete steps will reduce spend without losing capability.

The platform is designed for practical cost visibility: connect supported sources, review normalized usage data, inspect trends and peaks, and act on prioritized recommendations. The current implementation emphasizes privacy-conscious analysis, a fast developer workflow, and a clear path from raw usage to decisions.

## Features

- **Multi-source adapters** for GitHub Copilot, Claude Code, Claude Export, OpenAI, and Anthropic
- **Cost breakdowns** by source and model so you can pinpoint the biggest drivers of spend
- **Peak-hour analysis** to identify concentration during expensive or overloaded usage windows
- **Recommendation engine** with R1–R4 rules for caching, model selection, prompt efficiency, and off-peak usage
- **Price map coverage** for 2,300+ models to support consistent normalization and comparisons

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
├─ docs/                   # Product and engineering documentation
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

- [`spec-v1.6.md`](./docs/spec-v1.6.md) — Product spec (current)
- [`spec-changelog.md`](./docs/spec-changelog.md) — Spec revision history (reference only)
- [`engineering-design.md`](./docs/engineering-design.md) — Engineering design
- [`engineering-design-errata.md`](./docs/engineering-design-errata.md) — Design errata and blocker fixes

## License

MIT

