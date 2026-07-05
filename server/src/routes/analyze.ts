import { Router, Request, Response } from 'express';
import multer from 'multer';
import { getAdapter } from '../adapters/registry.js';
import { loadPriceMap } from '../data/priceMap.js';
import { classifyTier } from '../engine/tiers.js';
import { computeSourceMetrics, computeCrossSourceMetrics, selectTopRecommendation } from '../engine/metrics/index.js';
import { generateRecommendations } from '../engine/recommendations/index.js';
import { AnalysisReport, SourceReport, SourceConfig, SourceMetrics, SourceId } from '../types/index.js';
import { parseAndValidateDateWindow } from '../lib/dateWindow.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const router = Router();

// Active assumptions text (used by both the per-source and compatibility routes)
const ANALYSIS_ASSUMPTIONS = [
  'OpenAI model cost shares are estimated from usage tokens and the LiteLLM price map',
  'Anthropic and Claude Code costs include cache creation/read token pricing when present in the LiteLLM price map',
  'Claude Code usage is read from local session JSONL files under the server process user profile',
  'GitHub Copilot usage is read from local session JSONL files under ~/.copilot/session-state/. No credentials required.',
  'ChatGPT Export cost is estimated using a baseline model (gpt-4o) applied to token volume; actual spend may differ',
  'ChatGPT conversation data is processed in memory and no message text is persisted',
  'Claude.ai export analysis is not available in this version (disabled)',
];

/** Build a SourceReport for a single adapter run result. */
async function runSourceAdapter(
  sourceId: string,
  req: Request,
  startDateStr?: string,
  endDateStr?: string
): Promise<SourceReport> {
  const adapter = getAdapter(sourceId);
  if (!adapter) {
    return { source_id: sourceId as SourceId, tier: null, connected: false, error: `Unknown source: ${sourceId}`, metrics: null };
  }

  const priceMap = await loadPriceMap();

  let credential: string | undefined;
  if (sourceId === 'openai') credential = req.headers['x-credential-openai'] as string;
  else if (sourceId === 'anthropic') credential = req.headers['x-credential-anthropic'] as string;

  let fileBuffer: Buffer | undefined;
  if (sourceId === 'chatgpt_export') {
    const file = req.file ?? (req.files as Express.Multer.File[])?.find(f => f.fieldname === sourceId);
    if (file) fileBuffer = file.buffer;
  }

  const ctx = {
    credential,
    startDate: startDateStr ? new Date(startDateStr) : undefined,
    endDate: endDateStr ? new Date(endDateStr) : undefined,
    fileBuffer,
    priceMap,
  };

  try {
    const adapterResult = await adapter.run(ctx);
    const tier = adapterResult.tier ?? classifyTier(adapterResult.raw);
    let metrics: SourceMetrics | null = null;

    if ((tier === 'B' || tier === 'C') && adapterResult.raw) {
      const computed = computeSourceMetrics(adapterResult.raw, priceMap);
      metrics = {
        sourceId,
        tier: tier || null,
        periodStart: adapterResult.raw.periodStart,
        periodEnd: adapterResult.raw.periodEnd,
        warnings: adapterResult.warnings,
        ...computed,
      } as SourceMetrics;
    }

    return {
      source_id: sourceId as SourceId,
      tier: tier || null,
      connected: adapterResult.connected,
      error: adapterResult.error ? adapterResult.error.message : null,
      metrics,
      warnings: adapterResult.warnings,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { source_id: sourceId as SourceId, tier: null, connected: false, error: msg, metrics: null };
  }
}

// ── POST /api/analyze/recommendations ──────────────────────────────────────
// Must be registered BEFORE /:sourceId to avoid the param catching "recommendations"
router.post('/analyze/recommendations', async (req: Request, res: Response, next) => {
  try {
    const { sources: settledSources } = req.body as { sources?: SourceReport[] };
    if (!Array.isArray(settledSources)) {
      return res.status(400).json({ error: 'Request body must include "sources" array of SourceReport' });
    }

    const priceMap = await loadPriceMap();
    const crossSource = computeCrossSourceMetrics(settledSources, priceMap);
    const recommendations = generateRecommendations(settledSources, priceMap);
    crossSource.top_recommendation = selectTopRecommendation(recommendations);

    const now = new Date();
    const report: AnalysisReport = {
      metadata: {
        generated_at: now.toISOString(),
        analysis_period_start: settledSources.map(s => s.metrics?.periodStart).filter(Boolean).sort()[0] ?? now.toISOString().split('T')[0],
        analysis_period_end: settledSources.map(s => s.metrics?.periodEnd).filter(Boolean).sort().at(-1) ?? now.toISOString().split('T')[0],
        promptly_version: '0.1.0',
        litellm_price_map_date: now.toISOString().split('T')[0],
      },
      sources: settledSources,
      cross_source_summary: crossSource,
      recommendations,
      assumptions: ANALYSIS_ASSUMPTIONS,
    };

    res.json(report);
  } catch (err: unknown) {
    next(err);
  }
});

// ── POST /api/analyze/:sourceId ────────────────────────────────────────────
// Per-source endpoint. ChatGPT Export uses multipart; others use JSON body.
router.post('/analyze/:sourceId', upload.any(), async (req: Request, res: Response, next) => {
  try {
    const { sourceId } = req.params;
    const { startDate, endDate } = req.body ?? {};
    const window = parseAndValidateDateWindow(startDate, endDate);
    if (!window.ok) {
      return res.status(400).json({ error: window.error });
    }
    const report = await runSourceAdapter(sourceId, req, startDate, endDate);
    res.json(report);
  } catch (err: unknown) {
    next(err);
  }
});

// ── POST /api/analyze (compatibility wrapper) ───────────────────────────────
router.post('/analyze', upload.any(), async (req: Request, res: Response, next) => {
  try {
    const { config: configStr } = req.body;
    const config = JSON.parse(configStr);
    const priceMap = await loadPriceMap();

    // Validate each source's analysis window up front (A4: reject invalid windows with 400)
    for (const src of config.sources as SourceConfig[]) {
      const window = parseAndValidateDateWindow(src.startDate, src.endDate);
      if (!window.ok) {
        return res.status(400).json({ error: `Invalid analysis window for ${src.sourceId}: ${window.error}` });
      }
    }

    // Run all adapters in parallel
    const results = await Promise.allSettled(
      config.sources.map(async (src: SourceConfig) => {
        const adapter = getAdapter(src.sourceId);
        if (!adapter) throw new Error(`Unknown source: ${src.sourceId}`);

        let credential: string | undefined;
        if (src.sourceId === 'openai') credential = req.headers['x-credential-openai'] as string;
        else if (src.sourceId === 'anthropic') credential = req.headers['x-credential-anthropic'] as string;

        let fileBuffer: Buffer | undefined;
        if (src.sourceId === 'chatgpt_export') {
          const file = (req.files as Express.Multer.File[])?.find(f => f.fieldname === src.sourceId);
          if (file) fileBuffer = file.buffer;
        }

        const ctx = {
          credential,
          startDate: src.startDate ? new Date(src.startDate) : undefined,
          endDate: src.endDate ? new Date(src.endDate) : undefined,
          options: src.options,
          fileBuffer,
          priceMap,
        };

        return adapter.run(ctx);
      })
    );

    // Build reports and compute metrics
    const reports: SourceReport[] = [];
    let allSourcesFailed = true;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const sourceId = config.sources[i].sourceId;

      if (result.status === 'fulfilled') {
        const adapterResult = result.value;
        if (!adapterResult.error) allSourcesFailed = false;

        const tier = adapterResult.tier ?? classifyTier(adapterResult.raw);
        let metrics: SourceMetrics | null = null;

        if (tier === 'B' && adapterResult.raw) {
          const tierBMetrics = computeSourceMetrics(adapterResult.raw, priceMap);
          metrics = { sourceId, tier: 'B', periodStart: adapterResult.raw.periodStart, periodEnd: adapterResult.raw.periodEnd, warnings: adapterResult.warnings, ...tierBMetrics } as SourceMetrics;
        } else if (tier === 'C' && adapterResult.raw) {
          const tierCMetrics = computeSourceMetrics(adapterResult.raw, priceMap);
          metrics = { sourceId, tier: 'C', periodStart: adapterResult.raw.periodStart, periodEnd: adapterResult.raw.periodEnd, warnings: adapterResult.warnings, ...tierCMetrics } as SourceMetrics;
        }

        reports.push({
          source_id: sourceId,
          tier: tier || null,
          connected: adapterResult.connected,
          error: adapterResult.error ? adapterResult.error.message : null,
          metrics,
        });
      } else {
        reports.push({ source_id: sourceId, tier: null, connected: false, error: result.reason?.message || 'Unknown error', metrics: null });
      }
    }

    // Compute cross-source metrics
    const crossSource = computeCrossSourceMetrics(reports, priceMap);
    if (allSourcesFailed) crossSource.allSourcesFailed = true;

    // Generate recommendations
    const recommendations = generateRecommendations(reports, priceMap);
    crossSource.top_recommendation = selectTopRecommendation(recommendations);

    // Build analysis report
    const now = new Date();
    const report: AnalysisReport = {
      metadata: {
        generated_at: now.toISOString(),
        analysis_period_start: config.sources[0]?.startDate || new Date(now.getTime() - 86400000 * 30).toISOString().split('T')[0],
        analysis_period_end: config.sources[0]?.endDate || now.toISOString().split('T')[0],
        promptly_version: '0.1.0',
        litellm_price_map_date: new Date().toISOString().split('T')[0],
      },
      sources: reports,
      cross_source_summary: crossSource,
      recommendations,
      assumptions: ANALYSIS_ASSUMPTIONS,
    };

    res.json(report);
  } catch (err: unknown) {
    next(err);
  }
});

export default router;

