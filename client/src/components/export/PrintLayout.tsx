import React from 'react';
import type { AnalysisReport } from '../../types/index.js';
import { friendlySourceName, friendlyModelName } from '../../lib/modelNames.js';

interface PrintLayoutProps {
  report: AnalysisReport;
}

export function PrintLayout({ report }: PrintLayoutProps) {
  const totalSpend = report.cross_source_summary.total_actual_spend_usd;
  const sourcesAnalyzed = report.sources.filter(s => !s.error).length;
  const generatedDate = new Date(report.metadata.generated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const periodStart = new Date(report.metadata.analysis_period_start).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const periodEnd = new Date(report.metadata.analysis_period_end).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      lineHeight: '1.5',
      color: '#1f2937',
      backgroundColor: '#ffffff',
      padding: '40px',
      width: '210mm',
      minHeight: '297mm',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '40px', borderBottom: '2px solid #e5e7eb', paddingBottom: '20px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#0066cc' }}>
          Promptly
        </h1>
        <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
          AI Spend Analysis Report
        </p>
      </div>

      {/* Summary Info */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '30px',
        backgroundColor: '#f9fafb',
        padding: '20px',
        borderRadius: '8px'
      }}>
        <div>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' }}>
            Generated
          </p>
          <p style={{ margin: '0', fontSize: '16px', fontWeight: '500' }}>
            {generatedDate}
          </p>
        </div>
        <div>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' }}>
            Period Analyzed
          </p>
          <p style={{ margin: '0', fontSize: '16px', fontWeight: '500' }}>
            {periodStart} — {periodEnd}
          </p>
        </div>
        <div>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' }}>
            Total Spend
          </p>
          <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold', color: '#0066cc' }}>
            ${totalSpend.toFixed(2)}
          </p>
        </div>
        <div>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' }}>
            Sources Analyzed
          </p>
          <p style={{ margin: '0', fontSize: '16px', fontWeight: '500' }}>
            {sourcesAnalyzed}
          </p>
        </div>
      </div>

      {/* Per-Source Sections */}
      {report.sources.map((source) => {
        if (source.error) {
          return (
            <div 
              key={source.source_id}
              style={{
                marginBottom: '24px',
                padding: '16px',
                border: '1px solid #fee2e2',
                backgroundColor: '#fef2f2',
                borderRadius: '6px'
              }}
            >
              <h3 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '18px', 
                fontWeight: '600',
                textTransform: 'capitalize'
              }}>
                {/* WP-14: friendlySourceName gives proper casing ("GitHub Copilot" not "github copilot") */}
                {friendlySourceName(source.source_id)}
              </h3>
              <p style={{ margin: '0', fontSize: '14px', color: '#991b1b' }}>
                Error: {source.error}
              </p>
            </div>
          );
        }

        if (!source.metrics) {
          return (
            <div 
              key={source.source_id}
              style={{
                marginBottom: '24px',
                padding: '16px',
                border: '1px solid #d1d5db',
                backgroundColor: '#f3f4f6',
                borderRadius: '6px'
              }}
            >
              <h3 style={{ 
                margin: '0', 
                fontSize: '18px', 
                fontWeight: '600',
                textTransform: 'capitalize'
              }}>
                {friendlySourceName(source.source_id)}
              </h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                No data available
              </p>
            </div>
          );
        }

        const metrics = source.metrics;

        return (
          <div 
            key={source.source_id}
            style={{
              marginBottom: '24px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              overflow: 'hidden'
            }}
          >
            {/* Source Header */}
            <div style={{
              backgroundColor: '#f3f4f6',
              padding: '16px',
              borderBottom: '1px solid #d1d5db'
            }}>
              <h3 style={{ 
                margin: '0 0 4px 0', 
                fontSize: '18px', 
                fontWeight: '600',
                textTransform: 'capitalize'
              }}>
                {friendlySourceName(source.source_id)}
              </h3>
            </div>

            {/* Metrics Grid */}
            <div style={{
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px'
            }}>
              {(metrics.totalSpendUsd ?? metrics.totalActualSpendUsd ?? metrics.copilotTotalCostUsd) !== undefined && (
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                    TOTAL SPEND
                  </p>
                  <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold', color: '#0066cc' }}>
                    ${(metrics.totalSpendUsd ?? metrics.totalActualSpendUsd ?? metrics.copilotTotalCostUsd ?? 0).toFixed(2)}
                  </p>
                </div>
              )}

              {metrics.avgDailySpendUsd !== undefined && (
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                    AVG DAILY SPEND
                  </p>
                  <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>
                    ${metrics.avgDailySpendUsd.toFixed(2)}
                  </p>
                </div>
              )}

              {metrics.peakSpendDay && (
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                    PEAK SPEND DAY
                  </p>
                  <p style={{ margin: '0', fontSize: '16px', fontWeight: '500' }}>
                    ${metrics.peakSpendDay.spendUsd.toFixed(2)} ({new Date(metrics.peakSpendDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                  </p>
                </div>
              )}

              {(metrics.totalActualTokens ?? metrics.estimatedTotalTokens) !== undefined && (
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                    TOTAL TOKENS
                  </p>
                  <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>
                    {(metrics.totalActualTokens ?? metrics.estimatedTotalTokens ?? 0).toLocaleString()}
                  </p>
                </div>
              )}

              {metrics.momChangePct !== null && metrics.momChangePct !== undefined && (
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                    MOM CHANGE
                  </p>
                  <p style={{ 
                    margin: '0', 
                    fontSize: '18px', 
                    fontWeight: 'bold',
                    color: metrics.momChangePct >= 0 ? '#dc2626' : '#16a34a'
                  }}>
                    {metrics.momChangePct >= 0 ? '+' : ''}{metrics.momChangePct.toFixed(1)}%
                  </p>
                </div>
              )}

              {(metrics.cachedTokenSavingsUsdAnthropic !== undefined || metrics.cachedTokenSavingsUsdClaudeCode !== undefined) && (
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                    CACHE SAVINGS
                  </p>
                  <p style={{ margin: '0', fontSize: '16px', fontWeight: 'bold', color: '#16a34a' }}>
                    ${(metrics.cachedTokenSavingsUsdAnthropic ?? metrics.cachedTokenSavingsUsdClaudeCode ?? 0).toFixed(2)}
                  </p>
                </div>
              )}

              {metrics.conversationCount !== undefined && (
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                    CONVERSATIONS
                  </p>
                  <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>
                    {metrics.conversationCount.toLocaleString()}
                  </p>
                </div>
              )}

              {metrics.copilotSessionCount !== undefined && (
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                    SESSIONS
                  </p>
                  <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold' }}>
                    {metrics.copilotSessionCount.toLocaleString()}
                  </p>
                </div>
              )}
              {metrics.copilotTotalCostUsd !== undefined && (
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                    TOTAL COST
                  </p>
                  <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold', color: '#0066cc' }}>
                    ${metrics.copilotTotalCostUsd.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {/* Model Breakdown */}
            {metrics.modelBreakdown && metrics.modelBreakdown.length > 0 && (
              <div style={{
                padding: '16px',
                borderTop: '1px solid #d1d5db',
                backgroundColor: '#fafafa'
              }}>
                <p style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '12px', 
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase'
                }}>
                  Model Breakdown
                </p>
                {metrics.modelBreakdown.slice(0, 5).map((model, idx) => (
                  <div 
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.5fr 0.8fr 0.7fr',
                      gap: '12px',
                      padding: '8px 0',
                      borderBottom: idx < metrics.modelBreakdown!.length - 1 ? '1px solid #e5e7eb' : 'none',
                      fontSize: '13px'
                    }}
                  >
                    <div>
                      {/* WP-14: friendlyModelName for proper model display names */}
                      <p style={{ margin: '0', fontWeight: '500' }}>{friendlyModelName(model.model)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0', color: '#6b7280' }}>
                        {(model.estimatedCostShare * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0', fontWeight: '500', color: '#0066cc' }}>
                        ${model.estimatedCostUsd.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Copilot: Token Breakdown by Model */}
            {metrics.copilotTokenBreakdownByModel && metrics.copilotTokenBreakdownByModel.length > 0 && (
              <div style={{
                padding: '16px',
                borderTop: '1px solid #d1d5db',
                backgroundColor: '#fafafa'
              }}>
                <p style={{
                  margin: '0 0 12px 0',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase'
                }}>
                  Token Breakdown by Model
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      {(['Model', 'Input Tokens', 'Output Tokens', 'Cache Read', 'Cache Write', 'Reasoning', 'Requests', 'Cost'] as const).map((col, i) => (
                        <th key={col} style={{
                          textAlign: i === 0 ? 'left' : 'right',
                          padding: '6px 8px',
                          fontWeight: '600',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          fontSize: '11px',
                          borderBottom: '1px solid #e2e8f0',
                          whiteSpace: 'nowrap'
                        }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.copilotTokenBreakdownByModel.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px', color: '#1e293b', fontWeight: '500' }}>{row.model}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1e293b' }}>{row.inputTokens.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1e293b' }}>{row.outputTokens.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1e293b' }}>{row.cacheReadTokens.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1e293b' }}>{row.cacheWriteTokens.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1e293b' }}>{row.reasoningTokens.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1e293b' }}>{row.requestCount.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1e293b' }}>${row.requestCost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Copilot: Model Spend */}
            {metrics.copilotModelCostBreakdown && metrics.copilotModelCostBreakdown.length > 0 && (
              <div style={{
                padding: '16px',
                borderTop: '1px solid #d1d5db',
                backgroundColor: '#fafafa'
              }}>
                <p style={{
                  margin: '0 0 12px 0',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase'
                }}>
                  Model Spend
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>Model</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>Net Spend ($)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...metrics.copilotModelCostBreakdown]
                      .sort((a, b) => b.costUsd - a.costUsd)
                      .map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px 8px', color: '#1e293b', fontWeight: '500' }}>{row.model}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1e293b' }}>${row.costUsd.toFixed(2)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1e293b' }}>{(row.costShare * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Copilot: Cache Read Fraction by Model */}
            {metrics.copilotCachedTokenFraction && metrics.copilotCachedTokenFraction.perModel.length > 0 && (
              <div style={{
                padding: '16px',
                borderTop: '1px solid #d1d5db',
                backgroundColor: '#fafafa'
              }}>
                <p style={{
                  margin: '0 0 12px 0',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase'
                }}>
                  Cache Read Fraction by Model
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>Model</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>Cache Read %</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>Cache Read Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.copilotCachedTokenFraction.perModel.map((entry, idx) => {
                      const tokenRow = metrics.copilotTokenBreakdownByModel?.find(r => r.model === entry.model);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px 8px', color: '#1e293b', fontWeight: '500' }}>{entry.model}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1e293b' }}>{(entry.fraction * 100).toFixed(1)}%</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1e293b' }}>
                            {tokenRow ? tokenRow.cacheReadTokens.toLocaleString() : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>
                  Aggregate cache-read fraction: {(metrics.copilotCachedTokenFraction.aggregate * 100).toFixed(1)}%
                </p>
              </div>
            )}

          </div>
        );
      })}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ 
            fontSize: '22px', 
            fontWeight: 'bold', 
            margin: '30px 0 16px 0',
            paddingTop: '20px',
            borderTop: '2px solid #e5e7eb'
          }}>
            Recommendations
          </h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {report.recommendations.slice(0, 3).map((rec, idx) => (
              <div 
                key={idx}
                style={{
                  padding: '12px',
                  border: '1px solid #dbeafe',
                  borderLeft: '4px solid #0066cc',
                  borderRadius: '4px',
                  backgroundColor: '#eff6ff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ 
                      margin: '0 0 4px 0', 
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1e40af'
                    }}>
                      {rec.title}
                    </p>
                    <p style={{ margin: '0', fontSize: '13px', color: '#1e3a8a', lineHeight: '1.4' }}>
                      {rec.body}
                    </p>
                  </div>
                  {rec.estimatedSavingsUsd && (
                    <div style={{ 
                      textAlign: 'right',
                      padding: '4px 8px',
                      backgroundColor: '#dcfce7',
                      borderRadius: '4px'
                    }}>
                      <p style={{ margin: '0', fontSize: '12px', fontWeight: '600', color: '#15803d' }}>
                        Save ${rec.estimatedSavingsUsd.toFixed(2)}/mo
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Footer */}
      <div style={{
        marginTop: '40px',
        paddingTop: '20px',
        borderTop: '1px solid #e5e7eb',
        textAlign: 'center',
        fontSize: '12px',
        color: '#9ca3af'
      }}>
        <p style={{ margin: '0' }}>
          Generated by Promptly — local analysis, no data stored
        </p>
      </div>
    </div>
  );
}
