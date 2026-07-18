import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SNAPSHOT_PATH = join(__dirname, '../src/data/snapshot/model_prices_and_context_window.json');
const META_PATH     = join(__dirname, '../src/data/snapshot/snapshot-meta.json');
const REMOTE =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const FETCH_TIMEOUT_MS = 10_000;

function isValidPriceEntry(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return typeof e['input_cost_per_token'] === 'number' &&
         typeof e['output_cost_per_token'] === 'number';
}

export async function run(): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(REMOTE, { signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} from LiteLLM — snapshot not updated`);

  const raw = await res.json();
  if (!raw || typeof raw !== 'object') throw new Error('Unexpected response shape from LiteLLM');

  const modelCount = Object.values(raw as Record<string, unknown>).filter(isValidPriceEntry).length;
  const fetchedAt = new Date().toISOString();

  await writeFile(SNAPSHOT_PATH, JSON.stringify(raw, null, 2) + '\n', 'utf-8');
  await writeFile(META_PATH, JSON.stringify({ fetchedAt, modelCount }, null, 2) + '\n', 'utf-8');

  console.log(`✓ Snapshot refreshed: ${modelCount} models, fetchedAt=${fetchedAt}`);
}

const isDirectRun = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isDirectRun) {
  run().catch((err: unknown) => {
    console.error('refresh-snapshot failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
