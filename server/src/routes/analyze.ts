import { Router, Request, Response } from 'express';
import multer from 'multer';
import { getAdapter } from '../adapters/registry.js';
import { loadPriceMap } from '../data/priceMap.js';
import { classifyTier } from '../engine/tiers.js';
import { computeSourceMetrics, computeCrossSourceMetrics } from '../engine/metrics/index.js';
import { generateRecommendations } from '../engine/recommendations/index.js';
import { AnalysisReport, SourceReport, SourceConfig, SourceMetrics } from '../types/index.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const router = Router();

router.post('/analyze', upload.any(), async (req: Request, res: Response, next) => {
  try {
    const { config: configStr } = req.body;
    const config = JSON.parse(configStr);
    const priceMap = await loadPriceMap();

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

        if (src.sourceId === 'claude_code') {
          const validation = await adapter.validate(ctx);
          if (!validation.valid) {
            return {
              sourceId: src.sourceId,
              tier: null,
              connected: false,
              error: validation.error,
              raw: null,
              warnings: [],
            };
          }
        }

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
      assumptions: [
        'OpenAI model cost shares are estimated from usage tokens and the LiteLLM price map',
        'Anthropic and Claude Code costs include cache creation/read token pricing when present in the LiteLLM price map',
        'Claude Code usage is read from local session JSONL files under the server process user profile',
        'GitHub Copilot usage is read from local session JSONL files under ~/.copilot/session-state/. No credentials required.',
        'ChatGPT and Claude.ai export analysis is deferred from the MVP',
      ],
    };

    res.json(report);
  } catch (err: any) {
    next(err);
  }
});

export default router;
