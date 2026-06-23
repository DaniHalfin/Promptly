import { RecommendationResult } from '../../types/index.js';
import type { Rule, RuleContext } from './index.js';

export const R4: Rule = {
  id: 'R4',
  severity: 'Low',
  evaluate(ctx: RuleContext): RecommendationResult[] {
    const claudeCode = ctx.sources.find(source => source.sourceId === 'claude_code');
    if (!claudeCode) return [];

    const peakFraction = claudeCode.claudeCodePeakHourFraction;
    const sessionCount = claudeCode.claudeCodeSessionCount ?? 0;
    const dataWindowDays = computeDataWindowDays(claudeCode.periodStart, claudeCode.periodEnd);

    if (peakFraction === undefined || peakFraction <= 0.7 || sessionCount < 20 || dataWindowDays < 7) {
      return [];
    }

    return [
      {
        id: 'R4',
        severity: 'Low',
        title: 'Most Claude Code sessions run during peak hours',
        body:
          `${Math.round(peakFraction * 100)}% of your Claude Code sessions start between 08:00–18:00 on weekdays. ` +
          'Shifting batch or long-context workloads to evenings or weekends can reduce response latency and improve throughput during high-demand periods.',
        triggeringMetric: 'claudeCodePeakHourFraction',
        triggeringValue: peakFraction,
        estimatedSavingsUsd: null,
        sourceIds: ['claude_code'],
      },
    ];
  },
};

export function computeDataWindowDays(start: string, end: string): number {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
}
