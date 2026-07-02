import React from 'react';
import ReactDOM from 'react-dom/client';
import { useSession } from '../context/SessionContext.js';
import { OpenAIPanel } from '../components/Results/panels/OpenAIPanel.js';
import { AnthropicPanel } from '../components/Results/panels/AnthropicPanel.js';
import { CopilotPanel } from '../components/Results/panels/CopilotPanel.js';
import { ClaudeCodePanel } from '../components/Results/panels/ClaudeCodePanel.js';
import { FileExportPanel } from '../components/Results/panels/FileExportPanel.js';
import { PrintLayout } from '../components/export/PrintLayout.js';
import { transformReportForExport } from '../lib/exportTransform.js';
import { ThemeToggle } from '../components/ThemeToggle.js';
import { friendlyModelName } from '../lib/modelNames.js';
import type { SourceId } from '../types/index.js';
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

  const renderSourcePanel = (sourceId: SourceId) => {
    switch (sourceId) {
      case 'openai':
        return OpenAIPanel;
      case 'anthropic':
        return AnthropicPanel;
      case 'github_copilot':
        return CopilotPanel;
      case 'claude_code':
        return ClaudeCodePanel;
      case 'chatgpt_export':
      case 'claude_export':
        return FileExportPanel;
      default:
        return null;
    }
  };

  const hasData = report.sources.some(s => s.metrics !== null && s.connected === true);
  const totalSpend = report.cross_source_summary.total_actual_spend_usd;
  const sourceCount = report.sources.filter(s => !s.error).length;

  // Hero mini-tile values
  const totalTokens = report.sources.reduce((sum, s) => {
    const t = (s.metrics as any)?.estimatedTotalTokens ?? (s.metrics as any)?.copilotTokenBreakdownByModel?.reduce((a: number, m: any) => a + m.inputTokens + m.outputTokens, 0) ?? 0;
    return sum + t;
  }, 0);

  const copilotCacheMetrics = report.sources.find(s => s.source_id === 'github_copilot')?.metrics as any;
  const cacheHitPct = copilotCacheMetrics?.copilotCachedTokenFraction?.aggregate != null
    ? (copilotCacheMetrics.copilotCachedTokenFraction.aggregate * 100).toFixed(1) + '%'
    : '—';

  const allModels: Array<{ model: string; costUsd: number }> = [];
  report.sources.forEach(s => {
    const m = s.metrics as any;
    if (m?.copilotModelCostBreakdown) {
      m.copilotModelCostBreakdown.forEach((r: any) => allModels.push({ model: r.model, costUsd: r.costUsd }));
    }
  });
  const topModel = allModels.sort((a, b) => b.costUsd - a.costUsd)[0];

  const recColor = (rec: any) => {
    if ((rec.estimatedSavingsUsd ?? 0) > 0) return 'var(--color-warning)';
    const text = (rec.title + rec.body).toLowerCase();
    if (text.includes('critical') || text.includes('act now')) return 'var(--color-critical)';
    return 'var(--color-info)';
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
        borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.09))',
        background: 'var(--color-bg-elevated)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        <button onClick={() => dispatch({ phase: 'connection' })} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'var(--text-body)', padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/>
          </svg>
          Back
        </button>
        <span style={{ fontWeight: 700, fontSize: 'var(--text-body)', color: 'var(--text-muted)', letterSpacing: '-0.01em' }}>Promptly</span>
        <ThemeToggle />
      </div>

      <div style={{ maxWidth: 960, width: '100%', margin: '0 auto', padding: '32px 24px', boxSizing: 'border-box' }}>
        {/* WP-1: Visually-hidden h1 provides page title for AT — Results has no visible heading otherwise */}
        <h1 id="results-heading" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
          Analysis Results
        </h1>
        {/* Hero */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div className="kpi-hero num" style={{ color: 'var(--color-accent)', marginBottom: 4 }}>
            ${totalSpend != null ? totalSpend.toFixed(2) : '0.00'}
          </div>
          <p style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Total AI Spend · {sourceCount} {sourceCount === 1 ? 'source' : 'sources'} · {new Date(report.metadata.generated_at).toLocaleDateString()}
          </p>

          {/* Mini tiles row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Tokens', value: totalTokens > 0 ? totalTokens.toLocaleString() : '—' },
              { label: 'Cache Hit', value: cacheHitPct },
              { label: 'Top Model', value: topModel ? friendlyModelName(topModel.model) : '—' },
            ].map(tile => (
              <div key={tile.label} className="card" style={{ padding: '12px 20px', minWidth: 120, maxWidth: 180, flex: '1 1 120px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div className="num" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.3 }}>{tile.value}</div>
                <div style={{ fontSize: 'var(--text-note)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 4 }}>{tile.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {report.cross_source_summary.allSourcesFailed && (
          <div style={{ background: 'var(--color-critical-muted)', border: '1px solid var(--color-critical)', borderRadius: 'var(--radius-lg)', padding: 16, marginBottom: 24 }}>
            <p style={{ color: 'var(--color-critical-text)', margin: 0, fontSize: '0.875rem' }}>All sources failed. Please check your credentials and try again.</p>
          </div>
        )}

        {/* Source panels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 24 }}>
          {report.sources.map(source => {
            const PanelComponent = renderSourcePanel(source.source_id);
            if (source.error) {
              return (
                <div key={source.source_id} className="card" style={{ borderColor: 'var(--color-critical-muted)' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{source.source_id}</h3>
                  <p style={{ margin: 0, color: 'var(--color-critical-text)', fontSize: '0.875rem' }}>{source.error}</p>
                </div>
              );
            }
            if (PanelComponent) return <PanelComponent key={source.source_id} report={source} />;
            return (
              <div key={source.source_id} className="card">
                <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 600 }}>{source.source_id}</h3>
              </div>
            );
          })}
        </div>

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.01em' }}>Recommendations</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {report.recommendations.slice(0, 5).map((rec, idx) => (
                <div key={idx} className="card" style={{ borderLeft: `4px solid ${recColor(rec)}`, paddingLeft: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: 'var(--text-heading)', fontWeight: 600, color: 'var(--text-primary)' }}>{rec.title}</h3>
                      <p style={{ margin: 0, fontSize: 'var(--text-body)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rec.body}</p>
                    </div>
                    {rec.estimatedSavingsUsd != null && (
                      <span className="num" style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-positive-text)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Save ${rec.estimatedSavingsUsd.toFixed(2)}/mo
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action bar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
          <button className="primary" onClick={downloadJSON} disabled={!hasData}>Export JSON</button>
          <button className="primary" onClick={downloadPDF} disabled={!hasData}>Export PDF</button>
        </div>
      </div>
    </div>
  );
}

