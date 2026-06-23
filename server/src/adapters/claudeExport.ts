import { SourceAdapter, AdapterResult } from './types.js';

const claudeExportAdapter: SourceAdapter = {
  id: 'claude_export',

  async validate() {
    return {
      valid: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Claude.ai export not available in MVP.',
        retriable: false,
      },
    };
  },

  async run(): Promise<AdapterResult> {
    return {
      sourceId: 'claude_export',
      tier: null,
      connected: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Claude.ai export not available in MVP — coming in a future release.',
        retriable: false,
      },
      raw: null,
      warnings: [],
    };
  },
};

export default claudeExportAdapter;
