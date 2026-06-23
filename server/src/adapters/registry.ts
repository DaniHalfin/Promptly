import { SourceAdapter } from './types.js';
import openaiAdapter from './openai.js';
import anthropicAdapter from './anthropic.js';
import githubCopilotAdapter from './githubCopilot.js';
import chatgptExportAdapter from './chatgptExport.js';
import claudeExportAdapter from './claudeExport.js';
import claudeCodeAdapter from './claudeCode.js';

export const adapterRegistry: Map<string, SourceAdapter> = new Map([
  ['openai', openaiAdapter],
  ['anthropic', anthropicAdapter],
  ['github_copilot', githubCopilotAdapter],
  ['chatgpt_export', chatgptExportAdapter],
  ['claude_export', claudeExportAdapter],
  ['claude_code', claudeCodeAdapter],
]);

export function getAdapter(sourceId: string): SourceAdapter | undefined {
  return adapterRegistry.get(sourceId);
}
