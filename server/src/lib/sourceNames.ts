const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  github_copilot: 'GitHub Copilot',
  chatgpt_export: 'ChatGPT (Export)',
  claude_export: 'Claude.ai (Export)',
  claude_code: 'Claude Code',
};

export function getSourceDisplayName(sourceId: string): string {
  return SOURCE_DISPLAY_NAMES[sourceId] ?? sourceId.replace(/_/g, ' ');
}
