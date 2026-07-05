import { Router, Request, Response } from 'express';
import multer from 'multer';
import { getAdapter } from '../adapters/registry.js';
import { loadPriceMap } from '../data/priceMap.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── ChatGPT Export validation (multipart file upload) ────────────────────────
router.post('/chatgpt_export/validate', upload.single('file'), async (req: Request, res: Response, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ valid: false, error: 'No file provided' });
    }

    // 1. Must be parseable JSON
    let data: unknown;
    try {
      const text = req.file.buffer.toString('utf-8');
      data = JSON.parse(text);
    } catch {
      return res.json({ valid: false, error: 'File is not valid JSON' });
    }

    // 2. Must be a ChatGPT conversations array
    if (!Array.isArray(data)) {
      return res.json({ valid: false, error: 'File must contain an array of conversations' });
    }

    // 3. If date range provided, at least one conversation must fall within it
    const { startDate, endDate } = req.body as { startDate?: string; endDate?: string };
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (end) end.setUTCHours(23, 59, 59, 999);

      const hasConvInPeriod = (data as Record<string, unknown>[]).some(conv => {
        const ut = conv.update_time;
        if (ut == null) return false;
        let ts: Date;
        if (typeof ut === 'number') {
          ts = new Date(ut * 1000);
        } else if (typeof ut === 'string') {
          const n = Number(ut);
          ts = Number.isFinite(n) ? new Date(n * 1000) : new Date(ut);
        } else {
          return false;
        }
        if (start && ts < start) return false;
        if (end && ts > end) return false;
        return true;
      });

      if (!hasConvInPeriod) {
        return res.json({ valid: false, error: 'No conversations found in the selected period' });
      }
    }

    return res.json({ valid: true });
  } catch (err: unknown) {
    next(err);
  }
});

// ── Generic source validation (JSON body) ───────────────────────────────────
router.post('/:sourceId/validate', async (req: Request, res: Response, next) => {
  try {
    const { sourceId } = req.params;
    const { startDate, endDate } = req.body;
    
    // Extract credential from the appropriate header based on sourceId
    let credential: string | undefined;
    if (sourceId === 'openai') credential = req.headers['x-credential-openai'] as string;
    else if (sourceId === 'anthropic') credential = req.headers['x-credential-anthropic'] as string;

    const adapter = getAdapter(sourceId);
    if (!adapter) {
      return res.status(400).json({ valid: false, errorCode: 'UNKNOWN_SOURCE', errorMessage: `Unknown source: ${sourceId}` });
    }

    const priceMap = await loadPriceMap();
    const result = await adapter.validate({
      credential,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      priceMap,
    });

    if (result.valid) {
      res.json({ valid: true, sourceId, daysAvailable: result.daysAvailable || 30, warnings: [] });
    } else {
      res.status(400).json({
        valid: false,
        sourceId,
        errorCode: result.error?.code,
        errorMessage: result.error?.message,
      });
    }
  } catch (err: unknown) {
    next(err);
  }
});

export default router;

