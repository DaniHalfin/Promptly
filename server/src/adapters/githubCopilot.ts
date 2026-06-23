import { SourceAdapter, AdapterContext, AdapterResult } from './types.js';
import {
  NormalizedCopilotBillingItem,
  NormalizedCopilotEngagement,
  NormalizedSourceData,
} from '../types/index.js';

interface GitHubUser {
  login?: string;
}

interface GitHubMembership {
  state?: string;
  organization?: {
    login?: string;
  };
}

interface GitHubBillingUsageItem {
  date?: string;
  day?: string;
  usageDate?: string;
  usage_date?: string;
  billingDate?: string;
  billedDate?: string;
  product?: string;
  sku?: string;
  model?: string;
  pricePerUnit?: number | string;
  grossQuantity?: number | string;
  quantity?: number | string;
  grossAmount?: number | string;
  discountAmount?: number | string;
  netAmount?: number | string;
}

interface GitHubBillingUsageResponse {
  usageItems?: GitHubBillingUsageItem[];
}

interface GitHubCopilotReportLinks {
  download_links?: string[];
  downloadLinks?: string[];
  download_url?: string;
  downloadUrl?: string;
  report_day?: string;
}

interface GitHubCopilotEngagementRecord {
  date?: string;
  day?: string;
  report_day?: string;
  total_suggestions_count?: number | string;
  total_acceptances_count?: number | string;
  suggestions_count?: number | string;
  acceptances_count?: number | string;
  code_generation_activity_count?: number | string;
  code_acceptance_activity_count?: number | string;
}

interface GitHubHttpResponse<T> {
  status: number;
  ok: boolean;
  headers: Headers;
  data: T | null;
  text: string;
}

class GitHubHttpError extends Error {
  status: number;

  constructor(status: number, message = `HTTP ${status}`) {
    super(message);
    this.status = status;
  }
}

const GITHUB_API_VERSION = '2026-03-10';
const DEFAULT_DAYS = 30;
const MAX_DISCOVERED_ORGS = 150;
const ORG_PROBE_LIMIT = 5;
const AI_CREDIT_TO_USD = 0.01;
const GITHUB_API_BASE = 'https://api.github.com';

const ORG_PERMISSION_MESSAGE =
  "This GitHub token does not have the required permissions to access Copilot billing data. For org-licensed Copilot, the token needs 'repo' scope and the account must be an org admin or billing manager.";
const NO_ORG_MESSAGE =
  'No GitHub organization memberships found and the individual billing endpoint returned 403/404. Ensure you have an active Copilot plan and that the token has the required scopes.';

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function ensureOptions(ctx: AdapterContext): Record<string, unknown> {
  if (!ctx.options) ctx.options = {};
  return ctx.options;
}

function getNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeDate(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return formatDate(parsed);
  }
  return fallback;
}

function billingProbeUrlForOrg(org: string): string {
  return `${GITHUB_API_BASE}/organizations/${encodeURIComponent(org)}/settings/billing/ai_credit/usage?per_page=1`;
}

function billingProbeUrlForUser(username: string): string {
  return `${GITHUB_API_BASE}/users/${encodeURIComponent(username)}/settings/billing/ai_credit/usage?per_page=1`;
}

function billingUsageUrl(resolvedOrg: string | null, username: string, startDate: string, endDate: string): string {
  const ownerPath = resolvedOrg
    ? `organizations/${encodeURIComponent(resolvedOrg)}`
    : `users/${encodeURIComponent(username)}`;
  const params = new URLSearchParams({
    startDate,
    endDate,
    per_page: '100',
  });
  return `${GITHUB_API_BASE}/${ownerPath}/settings/billing/ai_credit/usage?${params.toString()}`;
}

async function fetchWithTimeout(url: string, headers: Record<string, string> = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (err instanceof GitHubHttpError && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError;
}

async function githubRequest<T>(url: string, token: string): Promise<GitHubHttpResponse<T>> {
  const res = await fetchWithTimeout(url, githubHeaders(token));
  const text = res.status === 204 ? '' : await res.text();
  let data: T | null = null;

  if (text.trim()) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = null;
    }
  }

  return { status: res.status, ok: res.ok, headers: res.headers, data, text };
}

async function githubGetJson<T>(url: string, token: string): Promise<GitHubHttpResponse<T>> {
  return withRetry(async () => {
    const response = await githubRequest<T>(url, token);
    if (!response.ok) throw new GitHubHttpError(response.status);
    return response;
  });
}

async function githubProbe(url: string, token: string): Promise<number> {
  try {
    const response = await githubRequest<unknown>(url, token);
    return response.status;
  } catch {
    return 0;
  }
}

async function getGitHubUser(ctx: AdapterContext): Promise<GitHubUser> {
  const response = await githubGetJson<GitHubUser>(`${GITHUB_API_BASE}/user`, ctx.credential!);
  const user = response.data || {};
  const options = ensureOptions(ctx);
  if (user.login) options.githubUsername = user.login;
  return user;
}

async function discoverActiveOrgs(token: string): Promise<string[]> {
  const orgs: string[] = [];
  const seen = new Set<string>();
  let nextUrl: string | null = `${GITHUB_API_BASE}/user/memberships/orgs?state=active&per_page=100`;

  while (nextUrl && orgs.length < MAX_DISCOVERED_ORGS) {
    const currentUrl = nextUrl;
    const response: GitHubHttpResponse<GitHubMembership[]> = await githubRequest<GitHubMembership[]>(currentUrl, token);
    if (response.status === 401) throw new GitHubHttpError(401);
    if (response.status === 404) break;
    if (!response.ok) break;

    for (const membership of response.data || []) {
      const login = membership.organization?.login;
      if (login && !seen.has(login)) {
        seen.add(login);
        orgs.push(login);
        if (orgs.length >= MAX_DISCOVERED_ORGS) break;
      }
    }
    nextUrl = orgs.length >= MAX_DISCOVERED_ORGS ? null : getNextLink(response.headers.get('link'));
  }

  return orgs;
}

async function resolveBillingAccess(
  ctx: AdapterContext,
  username: string,
): Promise<{ resolvedOrg: string | null; discoveredOrgs: string[] }> {
  const token = ctx.credential!;
  const discoveredOrgs = await discoverActiveOrgs(token);
  const orgsToProbe = discoveredOrgs.slice(0, ORG_PROBE_LIMIT);

  if (orgsToProbe.length) {
    const probeResults = await Promise.all(
      orgsToProbe.map(async org => ({ org, status: await githubProbe(billingProbeUrlForOrg(org), token) })),
    );
    const accessibleOrg = probeResults.find(result => result.status === 200)?.org;
    if (accessibleOrg) {
      ensureOptions(ctx).resolvedOrg = accessibleOrg;
      return { resolvedOrg: accessibleOrg, discoveredOrgs };
    }
  }

  const userStatus = await githubProbe(billingProbeUrlForUser(username), token);
  if (userStatus === 200) {
    ensureOptions(ctx).resolvedOrg = null;
    return { resolvedOrg: null, discoveredOrgs };
  }

  throw new GitHubHttpError(
    userStatus || 404,
    discoveredOrgs.length ? ORG_PERMISSION_MESSAGE : NO_ORG_MESSAGE,
  );
}

async function resolveBillingTarget(ctx: AdapterContext): Promise<{ username: string; resolvedOrg: string | null }> {
  const user = await getGitHubUser(ctx);
  const username = user.login;
  if (!username) throw new Error('GitHub /user response did not include a login');

  if (Object.prototype.hasOwnProperty.call(ctx.options || {}, 'resolvedOrg')) {
    const resolvedOrg = ctx.options?.resolvedOrg;
    return { username, resolvedOrg: typeof resolvedOrg === 'string' ? resolvedOrg : null };
  }

  const resolved = await resolveBillingAccess(ctx, username);
  return { username, resolvedOrg: resolved.resolvedOrg };
}

function mapBillingItem(item: GitHubBillingUsageItem, fallbackDate: string): NormalizedCopilotBillingItem {
  const grossAmount = toNumber(item.grossAmount);
  const discountAmount = toNumber(item.discountAmount);
  const netAmount = toNumber(item.netAmount);

  return {
    date: normalizeDate(
      item.date ?? item.day ?? item.usageDate ?? item.usage_date ?? item.billingDate ?? item.billedDate,
      fallbackDate,
    ),
    product: item.product || item.sku || 'unknown',
    model: item.model || 'unknown',
    pricePerUnit: toNumber(item.pricePerUnit),
    grossQuantity: toNumber(item.grossQuantity ?? item.quantity),
    grossAmountUsd: grossAmount * AI_CREDIT_TO_USD,
    discountAmountUsd: discountAmount * AI_CREDIT_TO_USD,
    netAmountUsd: netAmount * AI_CREDIT_TO_USD,
  };
}

async function fetchAllBillingItems(
  resolvedOrg: string | null,
  username: string,
  token: string,
  startDate: string,
  endDate: string,
): Promise<NormalizedCopilotBillingItem[]> {
  const items: NormalizedCopilotBillingItem[] = [];
  let nextUrl: string | null = billingUsageUrl(resolvedOrg, username, startDate, endDate);

  while (nextUrl) {
    const response = await githubGetJson<GitHubBillingUsageResponse>(nextUrl, token);
    for (const item of response.data?.usageItems || []) {
      items.push(mapBillingItem(item, startDate));
    }
    nextUrl = getNextLink(response.headers.get('link'));
  }

  return items;
}

function parseRecordText(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  }

  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as GitHubCopilotReportLinks & { records?: unknown[]; data?: unknown[] };
    if (Array.isArray(parsed.records)) return parsed.records;
    if (Array.isArray(parsed.data)) return parsed.data;
    return [parsed];
  }

  return trimmed
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line) as unknown);
}

async function fetchReportText(url: string, token?: string): Promise<string> {
  const headers = token ? githubHeaders(token) : {};
  const response = await fetchWithTimeout(url, headers);
  if (!response.ok) throw new GitHubHttpError(response.status);
  return response.text();
}

async function fetchEngagementRecords(org: string, token: string): Promise<GitHubCopilotEngagementRecord[]> {
  const url = `${GITHUB_API_BASE}/orgs/${encodeURIComponent(org)}/copilot/metrics/reports/organization-1-day`;
  const reportText = await fetchReportText(url, token);
  const parsed = parseRecordText(reportText);

  if (
    parsed.length === 1 &&
    typeof parsed[0] === 'object' &&
    parsed[0] !== null &&
    ('download_links' in parsed[0] || 'downloadLinks' in parsed[0] || 'download_url' in parsed[0] || 'downloadUrl' in parsed[0])
  ) {
    const links = parsed[0] as GitHubCopilotReportLinks;
    const downloadLinks = [
      ...(links.download_links || []),
      ...(links.downloadLinks || []),
      ...(links.download_url ? [links.download_url] : []),
      ...(links.downloadUrl ? [links.downloadUrl] : []),
    ];
    const records: GitHubCopilotEngagementRecord[] = [];
    for (const link of downloadLinks) {
      records.push(...(parseRecordText(await fetchReportText(link)) as GitHubCopilotEngagementRecord[]));
    }
    return records;
  }

  return parsed as GitHubCopilotEngagementRecord[];
}

async function fetchCopilotEngagement(org: string, token: string, warnings: string[]): Promise<NormalizedCopilotEngagement[]> {
  try {
    const records = await fetchEngagementRecords(org, token);
    return records.map(record => ({
      date: normalizeDate(record.date ?? record.day ?? record.report_day, formatDate(new Date())),
      suggestionsCount: toNumber(record.total_suggestions_count ?? record.suggestions_count ?? record.code_generation_activity_count),
      acceptancesCount: toNumber(record.total_acceptances_count ?? record.acceptances_count ?? record.code_acceptance_activity_count),
    }));
  } catch (err) {
    if (err instanceof GitHubHttpError && err.status === 404) {
      const warning = 'Engagement data unavailable (org metrics endpoint returned 404). Acceptance rate will not be shown.';
      console.warn(warning);
      warnings.push(warning);
      return [];
    }
    throw err;
  }
}

const githubCopilotAdapter: SourceAdapter = {
  id: 'github_copilot',

  async validate(ctx: AdapterContext) {
    if (!ctx.credential) {
      return { valid: false, error: { code: 'MISSING_CREDENTIAL', message: 'No token provided', retriable: false } };
    }

    try {
      const userResponse = await githubRequest<GitHubUser>(`${GITHUB_API_BASE}/user`, ctx.credential);
      if (userResponse.status === 401) {
        return { valid: false, error: { code: 'INVALID_KEY', message: 'Invalid GitHub token', retriable: false } };
      }
      if (!userResponse.ok) throw new GitHubHttpError(userResponse.status);

      const username = userResponse.data?.login;
      if (!username) throw new Error('GitHub /user response did not include a login');
      ensureOptions(ctx).githubUsername = username;

      await resolveBillingAccess(ctx, username);
      return { valid: true, error: null, daysAvailable: DEFAULT_DAYS };
    } catch (err: unknown) {
      if (err instanceof GitHubHttpError) {
        if (err.status === 401) {
          return { valid: false, error: { code: 'INVALID_KEY', message: 'Invalid GitHub token', retriable: false } };
        }
        if (err.status === 403 || err.status === 404 || err.message === ORG_PERMISSION_MESSAGE || err.message === NO_ORG_MESSAGE) {
          return { valid: false, error: { code: 'NOT_FOUND', message: err.message, retriable: false } };
        }
      }
      const message = err instanceof Error ? err.message : String(err);
      return { valid: false, error: { code: 'NETWORK_ERROR', message, retriable: true } };
    }
  },

  async run(ctx: AdapterContext): Promise<AdapterResult> {
    if (!ctx.credential) {
      return {
        sourceId: 'github_copilot',
        tier: null,
        connected: false,
        error: { code: 'MISSING_CREDENTIAL', message: 'No token provided', retriable: false },
        raw: null,
        warnings: [],
      };
    }

    try {
      const endDate = formatDate(ctx.endDate || new Date());
      const startDate = formatDate(ctx.startDate || addDays(new Date(endDate), -(DEFAULT_DAYS - 1)));
      const { username, resolvedOrg } = await resolveBillingTarget(ctx);
      const warnings: string[] = [];

      const copilotBillingItems = await fetchAllBillingItems(
        resolvedOrg,
        username,
        ctx.credential,
        startDate,
        endDate,
      );
      const copilotEngagement = resolvedOrg
        ? await fetchCopilotEngagement(resolvedOrg, ctx.credential, warnings)
        : [];

      const raw: NormalizedSourceData = {
        sourceId: 'github_copilot',
        copilotBillingItems,
        copilotEngagement,
        periodStart: startDate,
        periodEnd: endDate,
      };

      return {
        sourceId: 'github_copilot',
        tier: 'B',
        connected: true,
        error: null,
        raw,
        warnings,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        sourceId: 'github_copilot',
        tier: null,
        connected: false,
        error: { code: 'FETCH_ERROR', message, retriable: true },
        raw: null,
        warnings: [],
      };
    }
  },
};

export default githubCopilotAdapter;
