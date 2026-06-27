import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, vi, expect, beforeEach, type MockInstance } from 'vitest';
import { Results } from '../src/pages/Results';

// ─── Hoisted mock functions (must be hoisted for use inside vi.mock factories) ─
const { mockSave, mockAddImage, mockAddPage, mockHtml2canvas } = vi.hoisted(() => ({
  mockSave:        vi.fn(),
  mockAddImage:    vi.fn(),
  mockAddPage:     vi.fn(),
  mockHtml2canvas: vi.fn(),
}));

// ─── jsPDF mock ────────────────────────────────────────────────────────────────
// Must use a regular function (not arrow) so `new jsPDF()` works as a constructor.
vi.mock('jspdf', () => ({
  default: vi.fn(function (this: unknown) {
    return {
      internal: {
        pageSize: {
          getWidth:  () => 210,
          getHeight: () => 297,
        },
      },
      addImage: mockAddImage,
      addPage:  mockAddPage,
      save:     mockSave,
    };
  }),
}));

// ─── html2canvas mock ──────────────────────────────────────────────────────────
let capturedContainer: HTMLElement | null = null;

const mockCanvasDefault = {
  width:     800,
  height:    1000,
  toDataURL: vi.fn(() => 'data:image/png;base64,FAKE'),
};

vi.mock('html2canvas', () => ({ default: mockHtml2canvas }));

// ─── ReactDOM.createRoot mock ──────────────────────────────────────────────────
vi.mock('react-dom/client', () => ({
  default: {
    createRoot: vi.fn(() => ({
      render:  vi.fn(),
      unmount: vi.fn(),
    })),
  },
}));

// ─── Component mocks ──────────────────────────────────────────────────────────
vi.mock('../src/components/export/PrintLayout.js',             () => ({ PrintLayout:      () => null }));
vi.mock('../src/components/ThemeToggle.js',                    () => ({ ThemeToggle:       () => null }));
vi.mock('../src/components/Results/panels/OpenAIPanel.js',     () => ({ OpenAIPanel:       () => null }));
vi.mock('../src/components/Results/panels/AnthropicPanel.js',  () => ({ AnthropicPanel:    () => null }));
vi.mock('../src/components/Results/panels/CopilotPanel.js',    () => ({ CopilotPanel:      () => null }));
vi.mock('../src/components/Results/panels/ClaudeCodePanel.js', () => ({ ClaudeCodePanel:   () => null }));
vi.mock('../src/components/Results/panels/FileExportPanel.js', () => ({ FileExportPanel:   () => null }));

// ─── SessionContext mock ───────────────────────────────────────────────────────
const mockReport = {
  metadata: { generated_at: '2026-06-01T00:00:00Z' },
  sources: [
    {
      source_id: 'openai',
      tier: 'B',
      connected: true,
      error: null,
      metrics: { totalActualSpendUsd: 80 },
    },
  ],
  cross_source_summary: {
    total_actual_spend_usd: 80,
    allSourcesFailed: false,
  },
  recommendations: [],
};

const mockDispatch = vi.fn();

vi.mock('../src/context/SessionContext.js', () => ({
  useSession: vi.fn(() => ({
    state:    { report: mockReport },
    dispatch: mockDispatch,
  })),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('Results - downloadPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedContainer = null;
    mockHtml2canvas.mockImplementation((el: HTMLElement) => {
      capturedContainer = el;
      return Promise.resolve(mockCanvasDefault);
    });
  });

  it('calls html2canvas with a container that does NOT have visibility:hidden', async () => {
    render(<Results />);
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));
    await waitFor(() => {
      expect(capturedContainer).not.toBeNull();
    });
    expect(capturedContainer!.style.visibility).not.toBe('hidden');
  });

  it('calls pdf.save() with a filename matching the promptly-analysis-YYYY-MM-DD.pdf pattern', async () => {
    render(<Results />);
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledOnce();
    });
    expect(mockSave).toHaveBeenCalledWith(
      expect.stringMatching(/^promptly-analysis-\d{4}-\d{2}-\d{2}\.pdf$/)
    );
  });

  it('shows an alert and does NOT call pdf.save() when html2canvas returns an empty canvas', async () => {
    mockHtml2canvas.mockImplementation((el: HTMLElement) => {
      capturedContainer = el;
      return Promise.resolve({ width: 0, height: 0, toDataURL: vi.fn() });
    });

    const alertSpy: MockInstance = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<Results />);
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledOnce();
    });

    expect(alertSpy).toHaveBeenCalledWith('Failed to generate PDF. Please try again.');
    expect(mockSave).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
