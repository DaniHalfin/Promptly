import React from 'react';
import ReactDOM from 'react-dom/client';
import { useSession } from '../context/SessionContext.js';
import { AnalysisHeader } from '../components/Results/AnalysisHeader.js';
import { MoneyByToolSection } from '../components/Results/MoneyByToolSection.js';
import { SpendingTrendSection } from '../components/Results/SpendingTrendSection.js';
import { ToolSpendCard } from '../components/Results/ToolSpendCard.js';
import { PrintLayout } from '../components/export/PrintLayout.js';
import { transformReportForExport } from '../lib/exportTransform.js';
import { ThemeToggle } from '../components/ThemeToggle.js';
import type { SourceId, TopRecommendationEntry } from '../types/index.js';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const PDF_EXPORT_COLOR_OVERRIDES = {
  '--color-accent': '#7281fb',
  '--color-accent-muted': 'rgba(122, 136, 216, 0.15)',
  '--color-accent-border': 'rgba(118, 133, 233, 0.35)',
  '--color-accent-light': '#a7b7ff',
  '--color-positive': '#20b46b',
  '--color-positive-muted': 'rgba(98, 171, 125, 0.15)',
  '--color-positive-text': '#6cd092',
  '--color-warning': '#eb8a00',
  '--color-warning-muted': 'rgba(208, 151, 95, 0.15)',
  '--color-warning-text': '#ffb059',
  '--color-critical': '#e64343',
  '--color-critical-muted': 'rgba(196, 103, 97, 0.15)',
  '--color-critical-text': '#ff8179',
  '--color-info': '#00a7dd',
  '--color-info-muted': 'rgba(97, 162, 192, 0.15)',
  '--text-primary': '#dfe6eb',
  '--text-secondary': '#839caf',
  '--text-muted': '#4f6778',
  '--text-disabled': '#344551',
  '--text-on-accent': '#ffffff',
} as const;

function applyPdfExportColorOverrides(container: HTMLElement) {
  for (const [name, value] of Object.entries(PDF_EXPORT_COLOR_OVERRIDES)) {
    container.style.setProperty(name, value);
  }
  container.style.color = PDF_EXPORT_COLOR_OVERRIDES['--text-primary'];
  container.style.backgroundColor = '#ffffff';
}

export function Results() {
  const { state, dispatch } = useSession();
  const report = state.report;

  if (!report) return null;

  const downloadPDF = async () => {
    let container: HTMLDivElement | null = null;
    let root: any = null;
    try {
      container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '210mm';
      container.style.zIndex = '-1';
      applyPdfExportColorOverrides(container);
      document.body.appendChild(container);

      root = ReactDOM.createRoot(container);
      root.render(<PrintLayout report={report} />);

      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('html2canvas returned an empty canvas — content was not rendered');
      }

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      const imgData = canvas.toDataURL('image/png');
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const fileName = `promptly-analysis-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      try {
        if (root) root.unmount();
        if (container && document.body.contains(container)) {
          document.body.removeChild(container);
        }
      } catch {}
    }
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(transformReportForExport(report), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promptly-analysis-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const css = report.cross_source_summary;
  const hasData = report.sources.some(s => s.metrics !== null && s.connected === true);

  // ADR-9: use estimated spend (includes Tier C) as the hero figure
  const totalSpend = (css.total_estimated_spend_usd || 0) > 0
    ? css.total_estimated_spend_usd
    : css.total_actual_spend_usd;
  const heroSpendLabel: 'Spend' | 'Estimated spend' = css.includes_estimates === true ? 'Estimated spend' : 'Spend';
  const sourceCount = report.sources.filter(s => !s.error).length;

  // Analysis period from metadata
  const periodStart = report.metadata.analysis_period_start ?? '';
  const periodEnd = report.metadata.analysis_period_end ?? '';

  // Sort sources by spend_by_tool rank (ascending = highest first)
  const spendByTool = css.spend_by_tool ?? [];
  const sourceOrder = new Map(spendByTool.map(e => [e.source_id as string, e.rank]));
  const sortedSources = [...report.sources].sort((a, b) => {
    const ra = sourceOrder.get(a.source_id) ?? 999;
    const rb = sourceOrder.get(b.source_id) ?? 999;
    return ra - rb;
  });
  const initialHighestSpendSourceId = sortedSources[0]?.source_id;
  const [expandedSourceIds, setExpandedSourceIds] = React.useState<Set<SourceId>>(
    () => new Set(initialHighestSpendSourceId ? [initialHighestSpendSourceId] : []),
  );

  React.useEffect(() => {
    if (initialHighestSpendSourceId) {
      setExpandedSourceIds(prev => {
        if (prev.size > 0) return prev;
        return new Set([initialHighestSpendSourceId]);
      });
    }
  }, [initialHighestSpendSourceId]);

  // Recommendations scoped per source
  const recsForSource = (sourceId: SourceId) =>
    report.recommendations.filter(r => r.sourceIds.includes(sourceId));

  const handleTopRecommendationClick = (rec: TopRecommendationEntry) => {
    setExpandedSourceIds(prev => {
      const next = new Set(prev);
      next.add(rec.source_id);
      return next;
    });

    window.requestAnimationFrame(() => {
      const selector = rec.target_recommendation_anchor || rec.target_card_anchor;
      const target =
        (selector ? document.querySelector<HTMLElement>(selector) : null) ||
        document.querySelector<HTMLElement>(rec.target_card_anchor);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.focus({ preventScroll: true });
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-base)' }}>
      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-elevated)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        <button
          onClick={() => dispatch({ phase: 'landing' })}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'var(--text-body)', minHeight: 44, padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/>
          </svg>
          Back
        </button>
        <span style={{ fontWeight: 700, fontSize: 'var(--text-body)', color: 'var(--text-muted)', letterSpacing: '-0.01em' }}>Promptly</span>
        <ThemeToggle />
      </div>

      <div style={{ maxWidth: 960, width: '100%', margin: '0 auto', padding: '32px 24px', boxSizing: 'border-box' }}>
        {/* WP-7: tabIndex={-1} + data-focus-on-mount enables programmatic focus on phase transition */}
        {/* W13: h1 is now visible as an eyebrow label above the hero — removes the dead invisible heading */}
        <h1
          id="results-heading"
          tabIndex={-1}
          data-focus-on-mount
          className="focus-target"
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
            margin: '0 0 8px',
          }}
        >
          Analysis Results
        </h1>

        {/* Error banner */}
        {css.allSourcesFailed && (
          <div style={{ background: 'var(--color-critical-muted)', border: '1px solid var(--color-critical)', borderRadius: 'var(--radius-lg)', padding: 16, marginBottom: 24 }}>
            <p style={{ color: 'var(--color-critical-text)', margin: 0, fontSize: '0.875rem' }}>All sources failed. Please check your credentials and try again.</p>
          </div>
        )}

        {/* § 1 — AnalysisHeader */}
        <AnalysisHeader
          totalSpend={totalSpend}
          spendLabel={heroSpendLabel}
          dateRange={{ start: periodStart, end: periodEnd }}
          sourceCount={sourceCount}
          totalPotentialSavingsUsd={css.total_potential_savings_usd}
          actionableRecommendationCount={css.actionable_recommendation_count}
        />

        {/* § 2 — MoneyByToolSection */}
        <MoneyByToolSection
          spendByTool={spendByTool}
          topRecommendations={css.top_recommendations ?? []}
          onTopRecommendationClick={handleTopRecommendationClick}
        />

        {/* § 3 — SpendingTrendSection */}
        <SpendingTrendSection
          dailySpend={css.daily_spend ?? []}
          trend={css.trend}
          spikeCallout={css.spike_callout}
        />

        {/* § 4 — Sorted ToolSpendCards */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 'var(--text-title)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 16,
            letterSpacing: '-0.01em',
          }}>
            AI Sources
          </h2>
          {sortedSources.map(source => (
            <ToolSpendCard
              key={source.source_id}
              source={source}
              recommendations={recsForSource(source.source_id)}
              spendEntry={spendByTool.find(e => e.source_id === source.source_id)}
              expanded={expandedSourceIds.has(source.source_id)}
              onExpandedChange={(expanded) => {
                setExpandedSourceIds(prev => {
                  const next = new Set(prev);
                  if (expanded) next.add(source.source_id);
                  else next.delete(source.source_id);
                  return next;
                });
              }}
            />
          ))}
        </section>

        {/* § 5 — Export actions */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--color-border-subtle)', flexWrap: 'wrap' }}>
          <button className="primary" onClick={downloadJSON} disabled={!hasData}>Export JSON</button>
          <button className="primary" onClick={downloadPDF} disabled={!hasData}>Export PDF</button>
        </div>
      </div>
    </div>
  );
}
