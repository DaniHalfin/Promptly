import React, { ReactNode, useState } from 'react';
import { SourceConfig, AnalysisReport, SourceId } from '../types/index.js';

export type SourceStatus = 'pending' | 'ready' | 'connected' | 'error';

type ApiSourceState = Partial<SourceConfig> & {
  credential?: string;
  status: SourceStatus;
  error?: string | null;
};

type FileSourceState = Partial<SourceConfig> & {
  file?: File;
  status: SourceStatus;
  error?: string | null;
};

type LocalSourceState = {
  enabled: boolean;
  status: SourceStatus;
  error?: string | null;
};

export type SourceValidationStatus = 'idle' | 'validating' | 'full' | 'partial' | 'none' | 'error';

export interface SourceValidationState {
  status: SourceValidationStatus;
  daysAvailable?: number;
  daysRequested?: number;
  message?: string;
  validatedRange?: { start: string; end: string };
  excluded?: boolean;
}

type SourceState = (ApiSourceState | FileSourceState | LocalSourceState) & {
  credential?: string;
  file?: File;
  enabled?: boolean;
  validation?: SourceValidationState;
};

export interface PendingAnalysis {
  config: { sources: SourceConfig[] };
}

export interface LandingSourceError {
  sourceId: SourceId;
  error?: string | null;
  warnings?: string[];
}

interface SessionState {
  phase?: 'landing' | 'analyzing' | 'results' | 'error';
  sources: Partial<Record<SourceId, SourceState>>;
  report?: AnalysisReport;
  analysisError?: string;
  analysisErrors?: LandingSourceError[];
  pendingAnalysis?: PendingAnalysis;
}

interface SessionContextType {
  state: SessionState;
  dispatch: React.Dispatch<Partial<SessionState>>;
  updateSource: (id: SourceId, data: Partial<SourceState>) => void;
  clearSession: () => void;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

export const SessionContext = React.createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    phase: 'landing',
    sources: {},
  });

  const abortControllerRef = React.useRef<AbortController | null>(null);

  const dispatch = (updates: Partial<SessionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const updateSource = (id: SourceId, data: Partial<SourceState>) => {
    setState(prev => ({
      ...prev,
      sources: {
        ...prev.sources,
        [id]: { ...prev.sources[id], ...data },
      },
    }));
  };

  const clearSession = () => {
    setState({ phase: 'landing', sources: {} });
  };

  return <SessionContext.Provider value={{ state, dispatch, updateSource, clearSession, abortControllerRef }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}