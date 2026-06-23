---
title: Individual GitHub Copilot Usage Data Access — Research Report
source: researcher-1781847937831
source_type: sub-agent
tags: [research, copilot, promptly, api]
created_at: 2026-06-19T05:49:18.098Z
---
# Individual GitHub Copilot Usage Data Access — Research Report

## Summary
An individual Copilot subscriber (Pro/Pro+, billed to their **personal** account — NOT licensed via an org) CAN access their own usage data through several paths. The single best path is the **documented user-scoped REST billing endpoints** (`/users/{username}/settings/billing/...`), which work with the user's own token and return per-day, per-model, per-SKU premium-request/AI-credit consumption with dollar amounts. A second strong path is the **undocumented internal quota endpoint** (`/copilot_internal/user`) used by the IDEs, which returns live quota snapshots (entitlement / remaining / percent for completions, chat, premium interactions). Local VS Code logs exist but are unstructured and do NOT contain reliable acceptance-rate data — that telemetry is sent to GitHub, not persisted locally in parseable form. NOTE: if the user's Copilot is licensed through an org/enterprise, the user-level endpoints return nothing and only org admins can see usage.

---

## 1. GitHub Copilot individual REST API endpoints

### 1a. Documented user-scoped billing usage endpoints ✅ BEST PATH
Part of GitHub's "enhanced billing platform." All are scoped to a username and return data **billed directly to the individual's personal account**.

- `GET /users/{username}/settings/billing/premium_request/usage` — **premium request usage** (the Copilot one that matters)
- `GET /users/{username}/settings/billing/ai_credit/usage` — AI credit usage (model-level)
- `GET /users/{username}/settings/billing/usage` — total metered usage across products

**Query params:** `year`, `month`, `day` (filter; defaults to current), plus `model` and `product` on the premium_request/ai_credit variants. Only the **past 24 months** are accessible.

**Response shape (premium_request / ai_credit):**
```json
{
  "timePeriod": { "year": 2025, "month": 6, "day": 18 },
  "user": "USERNAME",
  "usageItems": [
    {
      "product": "copilot",
      "sku": "...",
      "model": "gpt-4o",            // model-level breakdown!
      "unitType": "...",
      "pricePerUnit": 0.04,
      "grossQuantity": 120,
      "grossAmount": 4.8,
      "discountQuantity": 100,
      "discountAmount": 4.0,
      "netQuantity": 20,
      "netAmount": 0.8
    }
  ]
}
```
The `/settings/billing/usage` variant adds `date`, `organizationName`, `repositoryName` and a flat `quantity` per item (daily granularity).

- **Viable for individual?** YES — explicitly designed for users who "purchased their own Copilot plan." Docs state: *"User endpoints return Copilot usage billed directly to an individual user's personal account."* No org admin required.
- **Data available:** premium-request counts and AI-credit consumption **per day, per model, per SKU**, with gross/net quantities and dollar amounts. This gives request volume + cost + model mix.
- **Difficulty:** LOW. Standard REST + token. Headers: `Authorization: Bearer <TOKEN>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`. Token = fine-grained PAT with the **"Plan" account permission (read)** for the user's own account (classic tokens historically used `manage_billing:copilot`/`read:user`; fine-grained "Plan: read" is the current path). The token must belong to the same user as `{username}`.
- **Limitations:** Billing-granularity only — **counts of premium requests and credits, NOT raw token counts, NOT inline-completion acceptance rates**. Free/base completions that aren't metered won't appear. 24-month retention. Returns empty if the license is org-managed. There is NO `/user/copilot_billing` or `/user/copilot_billing/seats` endpoint — those 404. (`/orgs/{org}/copilot/billing` and `/orgs/{org}/copilot/billing/seats` exist but are **org-admin only**.)

### 1b. The org/enterprise metrics & user-management APIs (for contrast) ❌
- `/orgs/{org}/copilot/metrics`, `/enterprises/{ent}/copilot/metrics`, `/orgs/{org}/copilot/billing/seats`, `/orgs/.../settings/billing/premium_request/usage` etc. — these return the rich acceptance-rate / suggestions-accepted / active-users data, but **all require org admin or billing-manager**. Not usable by an individual. This is the wall the team already hit.

---

## 2. Undocumented internal quota endpoint (used by the IDEs) ✅ STRONG PATH
`GET https://api.github.com/copilot_internal/user`

This is what powers VS Code's "View quota usage" / status-bar quota panel. Verified against the open-source `ericc-ch/copilot-api` project (`src/services/github/get-copilot-usage.ts`).

**Headers:** `Authorization: token <GITHUB_OAUTH_TOKEN>` plus editor headers (`editor-version: vscode/<ver>`, `editor-plugin-version: copilot-chat/<ver>`, `user-agent: GitHubCopilotChat/<ver>`, `x-github-api-version: 2025-04-01`).

**Response shape:**
```json
{
  "access_type_sku": "...",
  "assigned_date": "...",
  "chat_enabled": true,
  "copilot_plan": "individual",
  "quota_reset_date": "2025-07-01",
  "quota_snapshots": {
    "chat":                 { "entitlement", "remaining", "percent_remaining", "quota_remaining", "overage_count", "overage_permitted", "unlimited", "quota_id" },
    "completions":          { ... same fields ... },
    "premium_interactions": { ... same fields ... }
  }
}
```

- **Viable for individual?** YES. Works with the individual's own Copilot OAuth token. No admin needed.
- **Data available:** live quota state — entitlement, remaining, percent_remaining, overage counts, unlimited flag, reset date — for completions, chat, and premium interactions. Great for a "budget gauge."
- **Difficulty:** MEDIUM — main cost is obtaining the OAuth token (see token note below). The call itself is trivial.
- **Limitations:** UNDOCUMENTED/unsupported — can change without notice. It's a **point-in-time snapshot**, not historical time-series (you'd have to poll and store snapshots yourself to build trends). No raw token counts or acceptance rates.

### Token acquisition (for 2 above)
The Copilot IDE OAuth app uses **device-code flow**:
- `POST https://github.com/login/device/code` with `client_id=Iv1.b507a08c87ecfe98`, `scope=read:user` → returns `user_code` + `verification_uri`.
- Poll `POST https://github.com/login/oauth/access_token` → GitHub OAuth token.
- (For chat/completions there's a second exchange at `/copilot_internal/v2/token` → short-lived Copilot token for `api.githubcopilot.com`; NOT needed just for the quota endpoint.)

Alternatively, reuse the token the editor already stored on disk (see §2/local paths below) instead of re-authing.

---

## 3 & 4. Personal usage dashboard on github.com ✅ (scrape / CSV export)
URL: **`https://github.com/settings/billing`** → "Metered usage" (filter to Copilot) and a dedicated **"Premium request analytics"** page in the sidebar.

- **Premium request analytics** page: chart + table with **filter, "Group by", and "Timeframe"** controls, and a chart "⋯" menu to **download the data** (CSV/JSON) directly.
- **"Get usage report"** button on the Metered Usage / AI usage pages → emails a CSV report.
- The pages are backed by the same enhanced-billing JSON described in §1a (the documented endpoints are the supported way to get this programmatically — prefer them over scraping the HTML, which is a JS SPA and brittle).
- **Viable for individual?** YES — docs: *"Anyone can view usage data for their own personal account unless a license for a metered product (Copilot) is assigned to them by an organization."*
- **Limitations:** Same billing-granularity limits as §1a. The downloadable report / analytics = premium requests & credits, not acceptance rates.

---

## 5. Local files, CLI & extension APIs

### 5a. VS Code extension logs (Windows) ⚠️ LOW VALUE for metrics
- Logs on disk: `%APPDATA%\Code\logs\<timestamp>\window<N>\exthost\GitHub.copilot\GitHub Copilot.log` and `...\GitHub.copilot-chat\...` (also visible via Output panel → "GitHub Copilot" / "GitHub Copilot Chat"). Language-server logs under the extension dir.
- Auth/token on disk (lets you skip device-flow for §2): Windows `%LOCALAPPDATA%\github-copilot\` containing `apps.json` / `hosts.json` / `versions.json` (older builds: `~/.config/github-copilot/hosts.json`). These hold the OAuth token the editor uses.
- **Data available:** request/response trace lines, errors, model names, sometimes timing — but **unstructured text**, format not stable, and crucially **acceptance/rejection telemetry is transmitted to GitHub, not persisted locally** in any queryable form.
- **There is NO local SQLite DB** of Copilot usage. (VS Code has `state.vscdb` SQLite for extension global/workspace state, but Copilot does not store usage metrics there in any documented/parseable schema.) The `%APPDATA%\GitHub Copilot` path the task asked about is essentially the token/config dir, not a metrics store.
- **Difficulty:** HIGH to get anything useful; **NOT recommended** as a metrics source. Useful only to (a) lift the auth token, or (b) crudely count completion events from log lines.

### 5b. Copilot "Activity" panel
Backed by the live quota endpoint (§2) + server-side data, not a local parseable metrics file. No separate local data store to read.

### 5c. CLI / extension APIs
- **`gh copilot`** (GitHub CLI extension) and the new **`copilot` CLI**: provide suggest/explain and (in the agentic CLI) an interactive **`/usage`**-style quota view, but **no documented command that emits machine-readable historical usage stats**. Not a reliable programmatic source.
- VS Code extension API: `vscode.lm` / Language Model API exposes model access, **not** the user's Copilot usage counters. No public extension API returns usage metrics.

---

## 6. Community workarounds / open-source tools
- **`ericc-ch/copilot-api`** (TypeScript/Bun, actively maintained) — reverse-engineered proxy that exposes Copilot as an OpenAI/Anthropic-compatible API AND ships a **"Usage Dashboard" to monitor quota and detailed statistics**. Best reference implementation: shows exactly how to device-auth, hit `/copilot_internal/user` for quota, and exchange tokens. Reusable patterns (and confirms the §2 endpoint/headers). ⚠️ Its README warns that excessive automated/bulk Copilot traffic can trip GitHub abuse-detection — relevant only if you proxy completions; the quota/billing reads are low-volume and fine.
- **`B00TK1D/copilot-api`** (Python) — minimal reverse-engineered Copilot completion API with native GitHub auth; useful as a compact auth reference, no usage dashboard.
- General pattern in the community: poll `/copilot_internal/user` on a schedule and store snapshots locally to build the historical time-series GitHub doesn't give you directly.

---

## Recommendations (for Promptly)
1. **Primary adapter:** documented user billing endpoints — start with `GET /users/{username}/settings/billing/premium_request/usage` (and `/ai_credit/usage` for model-level cost). Supported, stable, historical (24 mo), per-day + per-model + dollars. Auth: fine-grained PAT with **Plan: read**. Gracefully handle the empty-response case = "license managed by org."
2. **Live gauge / richer real-time quota:** add the undocumented `GET /copilot_internal/user` for entitlement/remaining/percent across completions, chat, premium interactions. Reuse the editor's stored OAuth token (`%LOCALAPPDATA%\github-copilot\`) or run device-flow with `client_id=Iv1.b507a08c87ecfe98`. Persist snapshots to build trends. Flag as "unofficial — may break."
3. **Set expectations:** for an individual user you can deliver **premium-request volume, model mix, credit/$ cost, and remaining quota** — but **NOT inline-completion acceptance rates or raw token counts**; that data only exists at the org-admin metrics API or server-side.
4. **Skip** local-log parsing as a metrics source (use it only to harvest the auth token).
5. Reference `ericc-ch/copilot-api` for working auth + quota code.

## Issues / caveats
- `/copilot_internal/user` is undocumented and unsupported — treat as best-effort.
- Token-scope specifics for the user billing endpoints weren't shown verbatim in the docs; "Plan: read" fine-grained PAT is the current mechanism — verify with a live call against the target account.
- Acceptance-rate / suggestion-count data is genuinely unavailable to individuals; don't promise it.
