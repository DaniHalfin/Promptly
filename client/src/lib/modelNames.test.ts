import { describe, expect, it } from 'vitest';
import { friendlyModelName } from './modelNames';

describe('friendlyModelName', () => {
  it('maps claude-sonnet-4-6 → Claude Sonnet 4.6', () =>
    expect(friendlyModelName('claude-sonnet-4-6')).toBe('Claude Sonnet 4.6'));
  it('maps claude-opus-4-8 → Claude Opus 4.8', () =>
    expect(friendlyModelName('claude-opus-4-8')).toBe('Claude Opus 4.8'));
  it('maps claude-haiku-4-5 → Claude Haiku 4.5', () =>
    expect(friendlyModelName('claude-haiku-4-5')).toBe('Claude Haiku 4.5'));
  it('maps gpt-5.5 → GPT-5.5', () =>
    expect(friendlyModelName('gpt-5.5')).toBe('GPT-5.5'));
  it('maps gpt-5.4-mini → GPT-5.4 mini', () =>
    expect(friendlyModelName('gpt-5.4-mini')).toBe('GPT-5.4 mini'));
  it('maps gpt-4o → GPT-4o', () =>
    expect(friendlyModelName('gpt-4o')).toBe('GPT-4o'));
  it('maps claude-3-5-sonnet-20241022 via exact match → Claude Sonnet 3.5', () =>
    expect(friendlyModelName('claude-3-5-sonnet-20241022')).toBe('Claude Sonnet 3.5'));
  it('returns unknown IDs unchanged', () =>
    expect(friendlyModelName('custom-enterprise-model-x')).toBe('custom-enterprise-model-x'));
  it('handles empty string gracefully', () =>
    expect(friendlyModelName('')).toBe(''));
  it('prefix-matches claude-sonnet-4-6-20250514 → Claude Sonnet 4.6', () =>
    expect(friendlyModelName('claude-sonnet-4-6-20250514')).toBe('Claude Sonnet 4.6'));
  it('prefix-matches claude-opus-4-5-20250514 → Claude Opus 4.5', () =>
    expect(friendlyModelName('claude-opus-4-5-20250514')).toBe('Claude Opus 4.5'));
});
