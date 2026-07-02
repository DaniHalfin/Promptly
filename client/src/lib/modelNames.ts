/**
 * IMPORTANT — key ordering is semantically significant.
 *
 * `friendlyModelName()` performs a prefix-match scan from top to bottom and
 * returns on the FIRST match. More-specific keys (longer, more-specific
 * prefixes) MUST appear BEFORE less-specific keys, or a shorter prefix will
 * silently swallow a more-specific model ID and return the wrong name.
 *
 * ✅ Correct:  'claude-sonnet-4.6' before 'claude-sonnet'
 * ❌ Wrong:   'claude-sonnet' before 'claude-sonnet-4.6'
 *             (claude-sonnet-4.6-20250514 would match 'claude-sonnet' and
 *              return "Claude Sonnet" instead of "Claude Sonnet 4.6")
 */

/**
 * Maps known raw model IDs to user-friendly display names.
 * Unknown IDs are returned unchanged.
 */
const MODEL_FRIENDLY_NAMES: Record<string, string> = {
  // Anthropic — Claude 4 family
  'claude-opus-4.8':        'Claude Opus 4.8',
  'claude-opus-4.7':        'Claude Opus 4.7',
  'claude-opus-4.6':        'Claude Opus 4.6',
  'claude-opus-4.5':        'Claude Opus 4.5',
  'claude-opus-4':          'Claude Opus 4',
  'claude-sonnet-4.6':      'Claude Sonnet 4.6',
  'claude-sonnet-4.5':      'Claude Sonnet 4.5',
  'claude-sonnet-4':        'Claude Sonnet 4',
  'claude-haiku-4.5':       'Claude Haiku 4.5',
  'claude-haiku-4':         'Claude Haiku 4',
  // Anthropic — Claude 3.5 family
  'claude-3-5-sonnet-20241022': 'Claude Sonnet 3.5',
  'claude-3-5-sonnet':      'Claude Sonnet 3.5',
  'claude-3-5-haiku-20241022':  'Claude Haiku 3.5',
  'claude-3-5-haiku':       'Claude Haiku 3.5',
  // Anthropic — Claude 3 family
  'claude-3-opus-20240229': 'Claude Opus 3',
  'claude-3-opus':          'Claude Opus 3',
  'claude-3-sonnet':        'Claude Sonnet 3',
  'claude-3-haiku-20240307': 'Claude Haiku 3',
  'claude-3-haiku':         'Claude Haiku 3',
  // OpenAI — GPT-5 family
  'gpt-5.5':                'GPT-5.5',
  'gpt-5.4':                'GPT-5.4',
  'gpt-5.4-mini':           'GPT-5.4 mini',
  'gpt-5.3-codex':          'GPT-5.3 Codex',
  'gpt-5-mini':             'GPT-5 mini',
  // OpenAI — GPT-4o family
  'gpt-4o-2024-11-20':      'GPT-4o',
  'gpt-4o-mini':            'GPT-4o mini',
  'gpt-4o':                 'GPT-4o',
  'gpt-4.1-mini':           'GPT-4.1 mini',
  'gpt-4.1-nano':           'GPT-4.1 nano',
  'gpt-4.1':                'GPT-4.1',
  // OpenAI — o-series
  'o1-mini':                'o1 mini',
  'o1':                     'o1',
  'o3-mini':                'o3 mini',
  'o3':                     'o3',
  'o4-mini':                'o4 mini',
};

/**
 * Returns a user-friendly display name for a model ID.
 * Falls back to the raw ID if the model is not in the lookup table.
 */
export function friendlyModelName(modelId: string): string {
  if (!modelId) return modelId;
  // Exact match first
  if (MODEL_FRIENDLY_NAMES[modelId]) return MODEL_FRIENDLY_NAMES[modelId];
  // Prefix match for dated variants (e.g. "claude-3-opus-20240229-..." → look for prefix)
  const prefixMatch = Object.keys(MODEL_FRIENDLY_NAMES).find(
    key => modelId.startsWith(key + '-') || modelId.startsWith(key + ':')
  );
  if (prefixMatch) return MODEL_FRIENDLY_NAMES[prefixMatch];
  return modelId;
}

// ─── Source display names ─────────────────────────────────────────────────────

/**
 * Maps source IDs to user-friendly display names.
 * Falls back to underscore-replaced ID for unknown sources.
 *
 * WP-14: Replaces source_id.replace('_', ' ') calls in PrintLayout and elsewhere
 * which produced lowercase "github copilot" / "claude code" instead of proper casing.
 */
const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  openai:          'OpenAI',
  anthropic:       'Anthropic',
  github_copilot:  'GitHub Copilot',
  chatgpt_export:  'ChatGPT Export',
  claude_export:   'Claude Export',
  claude_code:     'Claude Code',
};

export function friendlySourceName(sourceId: string): string {
  return SOURCE_DISPLAY_NAMES[sourceId] ?? sourceId.replace(/_/g, ' ');
}
