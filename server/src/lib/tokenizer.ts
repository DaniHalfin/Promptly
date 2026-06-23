import { encoding_for_model } from 'tiktoken';

let tokenizer: ReturnType<typeof encoding_for_model> | null = null;

export async function getTokenizer() {
  if (!tokenizer) {
    tokenizer = encoding_for_model('gpt-3.5-turbo');
  }
  return tokenizer;
}

export function encodeTokens(text: string): number {
  if (!tokenizer) {
    tokenizer = encoding_for_model('gpt-3.5-turbo');
  }
  return tokenizer.encode(text).length;
}
