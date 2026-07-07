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

- **Server unit tests:** 244 tests
- **Client component tests:** 442 tests
- **End-to-end tests:** 15 tests

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

All 701 tests (686 unit + 15 end-to-end) must pass before review or merge.

## Docs

Project documentation lives in [`docs/`](./docs/):

| File | Purpose |
|---|---|
| [`spec.md`](./docs/spec.md) | Product spec — current canonical |
| [`spec-changelog.md`](./docs/spec-changelog.md) | Spec revision history (reference, load on demand) |
| [`engineering-design.md`](./docs/engineering-design.md) | Engineering design — current canonical |
| [`engineering-design-changelog.md`](./docs/engineering-design-changelog.md) | Engineering design version history |
| [`engineering-design-amendment-v1.0-v1.1.md`](./docs/engineering-design-amendment-v1.0-v1.1.md) | Amendment reference (v1.0 → v1.1 delta) |
| [`engineering-design-amendment-v1.2.md`](./docs/engineering-design-amendment-v1.2.md) | Amendment reference (v1.2 — GitHub Copilot adapter redesign) |
| [`engineering-design-errata.md`](./docs/engineering-design-errata.md) | Blocker fixes applied to v1.1 |
| [`agentic-dev-flow.md`](./docs/agentic-dev-flow.md) | End-to-end agentic development workflow used to build this project |
| [`research/llm-analytics-landscape.md`](./docs/research/llm-analytics-landscape.md) | Phase 0 research — LLM usage analytics landscape and competitive tools |
| [`research/github-copilot-data-access.md`](./docs/research/github-copilot-data-access.md) | Phase 0 research — GitHub Copilot usage data access paths |
| [`research/claude-anthropic-data-access.md`](./docs/research/claude-anthropic-data-access.md) | Phase 0 research — Claude and Anthropic usage data access paths |

## License

MIT

## Dependencies

Full dependency reference across all workspaces. Versions are from `package.json`; descriptions explain each package's specific role in Promptly.

### Runtime — Server

Packages the Express server needs to run in production (`server/package.json` → `dependencies`).

| Package | Version | Role in Promptly |
|---|---|---|
| `express` | ^4.18.2 | HTTP server framework — hosts the `/api` routes that client panels call for usage data, recommendations, and pricing |
| `multer` | ^1.4.5-lts.1 | Multipart form-data middleware — reserved for future P1 local usage export sources (e.g. ChatGPT export, Claude.ai export) if file-upload ingestion is implemented |
| `node-fetch` | ^3.3.2 | HTTP client — fetches live model pricing from external APIs at server startup so cost calculations reflect current rates |
| `tiktoken` | ^1.0.10 | OpenAI's tokenizer — counts tokens in prompts and completions when the raw token count is not supplied by a usage source |

### Runtime — Client

Packages the React UI needs in production (`client/package.json` → `dependencies`).

| Package | Version | Role in Promptly |
|---|---|---|
| `react` | ^18.2.0 | Core UI framework — all panels, charts, and source-configuration flows are React components |
| `react-dom` | ^18.2.0 | React renderer — mounts the application to the browser DOM |
| `recharts` | ^2.10.3 | Chart library — renders cost-over-time line charts, per-model bar charts, and peak-hour heatmaps in the dashboard panels |
| `react-day-picker` | ^8.9.1 | Date-range picker component — lets users filter usage data by a custom date window in the dashboard header |
| `html2canvas` | ^1.4.1 | DOM-to-canvas renderer — captures panel screenshots for the PDF export feature |
| `jspdf` | ^2.5.1 | PDF generation — assembles captured panel screenshots into a downloadable spend report |

### Development — Server

Packages used only during development and testing of the server workspace (`server/package.json` → `devDependencies`).

| Package | Version | Role in Promptly |
|---|---|---|
| `vitest` | ^4.1.9 | Test runner for all 244 server unit tests — adapter parsing, metric calculations, recommendation rules |
| `@vitest/coverage-v8` | ^4.1.9 | V8-native code coverage reporter plugged into Vitest — generates per-file line/branch coverage for server code |
| `tsx` | ^4.7.0 | TypeScript execution engine — powers `tsx watch src/index.ts` for zero-compile hot-reload during development |
| `typescript` | ^5.3.3 | TypeScript compiler — type-checks and compiles the server to `dist/` for production |
| `eslint` | ^8.56.0 | Linter — enforces code style and catches common errors across server source files |
| `@types/express` | ^4.17.21 | TypeScript type definitions for Express — enables typed `Request`, `Response`, and `Router` in route handlers |
| `@types/multer` | ^1.4.11 | TypeScript type definitions for Multer — types the `req.file` / `req.files` objects in upload handlers |
| `@types/node` | ^20.10.6 | TypeScript type definitions for Node.js built-ins — required for `fs`, `path`, `process`, and other Node APIs used by adapters |

### Development — Client

Packages used only during development and testing of the client workspace (`client/package.json` → `devDependencies`).

| Package | Version | Role in Promptly |
|---|---|---|
| `vite` | ^5.0.8 | Build tool and dev server — serves the React app on `localhost:5173` with HMR in development and bundles it for production |
| `vitest` | ^4.1.9 | Test runner for all 442 client component tests — runs in jsdom so components render without a real browser |
| `@vitejs/plugin-react` | ^4.2.0 | Vite plugin — enables React Fast Refresh and JSX transform during development and build |
| `@vitest/coverage-v8` | ^4.1.9 | V8 code coverage for client Vitest runs — tracks which component branches are exercised by tests |
| `typescript` | ^5.3.3 | TypeScript compiler — type-checks client source and produces the JS bundle via `tsc && vite build` |
| `tailwindcss` | ^3.3.6 | Utility-first CSS framework — all Promptly component styling uses Tailwind classes |
| `postcss` | ^8.4.31 | CSS post-processor — required by Tailwind to transform utility classes at build time |
| `autoprefixer` | ^10.4.16 | PostCSS plugin — automatically adds vendor prefixes so Tailwind styles work across target browsers |
| `jsdom` | ^29.1.1 | Browser DOM emulator — provides the `document` / `window` environment that Vitest needs to render and test React components in Node |
| `@testing-library/react` | ^16.3.2 | React Testing Library — renders components into jsdom and provides `screen`, `within`, and async query helpers used in all 442 client tests |
| `@testing-library/user-event` | ^14.6.1 | Simulates realistic user interactions (clicks, typing, keyboard navigation) in React Testing Library tests |
| `@testing-library/jest-dom` | ^6.9.1 | Custom DOM matchers (`toBeInTheDocument`, `toHaveValue`, etc.) that make assertion failures readable in component tests |
| `jest-axe` | ^10.0.0 | Axe accessibility engine wrapped for Jest/Vitest — used in component tests to assert panels meet WCAG accessibility rules |
| `@types/jest-axe` | ^3.5.9 | TypeScript type definitions for jest-axe — types the `axe()` call and matcher results |
| `@types/react` | ^18.2.37 | TypeScript type definitions for React — types JSX, hooks, and component props throughout the client |
| `@types/react-dom` | ^18.2.15 | TypeScript type definitions for React DOM — types `createRoot` and related DOM-rendering APIs |

### Workspace Root

Packages in the root `package.json` that coordinate both workspaces (`devDependencies`).

| Package | Version | Role in Promptly |
|---|---|---|
| `@playwright/test` | ^1.61.0 | End-to-end test framework — runs all 15 Playwright tests in `e2e/` against the running server and client with fixture mock data |
| `npm-run-all` | ^4.1.5 | Script orchestrator — `npm run dev` and `npm start` use `--parallel` to launch the server and client workspaces simultaneously |









