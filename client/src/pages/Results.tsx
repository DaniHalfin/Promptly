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
import type { SourceId } from '../types/index.js';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export function Results() {
  const { state, dispatch } = useSession();
  const report = state.report;

  if (!report) return null;

  const downloadPDF = async () => {
    let container: HTMLDivElement | null = null;
    let root: any = null;
    try {
      // 1. Create a hidden container for rendering the print layout
      container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '210mm';
      container.style.visibility = 'hidden';
      container.style.zIndex = '-1';
      document.body.appendChild(container);

      // 2. Render PrintLayout component into the container using React 18 API
      root = ReactDOM.createRoot(container);
      root.render(<PrintLayout report={report} />);

      // Wait for React to render the component
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Capture the rendered content with html2canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // 4. Create a PDF document (A4 size)
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      // 5. Calculate dimensions to fit A4
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      // 6. Add canvas image to PDF
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

      // 7. Save the PDF
      const fileName = `promptly-analysis-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      // 8. Clean up the hidden container and root (runs regardless of success/error)
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

  const totalSpend = report.cross_source_summary.total_actual_spend_usd;
  const sourceCount = report.sources.filter(s => !s.error).length;
  const hasData = report.sources.some(s => s.metrics !== null && s.connected === true);

  return (
    <div className="min-h-screen p-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <button
              onClick={() => dispatch({ phase: 'connection' })}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-3 bg-transparent border-0 cursor-pointer p-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5" />
                <path d="M12 5l-7 7 7 7" />
              </svg>
              Back
            </button>
            <h1 className="text-4xl font-bold mb-2">Analysis Results</h1>
            <p className="text-slate-600">
              {new Date(report.metadata.generated_at).toLocaleDateString()} • {sourceCount} sources analyzed
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-blue-600">${totalSpend ? totalSpend.toFixed(2) : '0.00'}</div>
            <p className="text-slate-600">Total spend</p>
          </div>
        </div>

        {report.cross_source_summary.allSourcesFailed && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-8">
            <p className="text-red-900">All sources failed. Please check your credentials and try again.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {report.sources.map(source => {
            const PanelComponent = renderSourcePanel(source.source_id);
            
            // Error state
            if (source.error) {
              return (
                <div key={source.source_id} className="border rounded-lg p-6 bg-red-50">
                  <h3 className="font-semibold mb-2 text-lg">{source.source_id}</h3>
                  <p className="text-red-600 text-sm">{source.error}</p>
                </div>
              );
            }

            // Use panel component if available, otherwise show generic view
            if (PanelComponent) {
              return <PanelComponent key={source.source_id} report={source} />;
            }

            // Fallback generic view
            return (
              <div key={source.source_id} className="border rounded-lg p-6 bg-slate-50">
                <h3 className="font-semibold mb-2 text-lg">{source.source_id}</h3>
                <p className="text-sm text-slate-600">Tier: {source.tier || 'N/A'}</p>
                {source.metrics && (
                  <div className="mt-4 space-y-1 text-sm">
                    {source.metrics.totalActualSpendUsd && <p>Spend: ${source.metrics.totalActualSpendUsd.toFixed(2)}</p>}
                    {source.metrics.estimatedTotalTokens && <p>Tokens: {source.metrics.estimatedTotalTokens.toLocaleString()}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {report.recommendations.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Recommendations</h2>
            <div className="space-y-4">
              {report.recommendations.slice(0, 5).map((rec, idx) => (
                <div key={idx} className="bg-white p-4 rounded border-l-4 border-blue-500">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{rec.title}</h3>
                      <p className="text-sm text-slate-600">{rec.body}</p>
                    </div>
                    {rec.estimatedSavingsUsd && <p className="text-green-600 font-semibold">Save ${rec.estimatedSavingsUsd.toFixed(2)}/mo</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-4 items-center">
          <button className="primary" onClick={downloadJSON} disabled={!hasData}>
            Export JSON
          </button>
          <button className="primary" onClick={downloadPDF} disabled={!hasData}>
            Export PDF
          </button>
          <button
            className="text-sm text-slate-500 hover:text-slate-700 underline bg-transparent border-0 cursor-pointer"
            onClick={() => dispatch({ phase: 'landing', sources: {} })}
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
