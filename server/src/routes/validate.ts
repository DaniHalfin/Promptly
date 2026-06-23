import { Router, Request, Response } from 'express';
import { getAdapter } from '../adapters/registry.js';
import { loadPriceMap } from '../data/priceMap.js';

const router = Router();

router.post('/:sourceId/validate', async (req: Request, res: Response, next) => {
  try {
    const { sourceId } = req.params;
    const { startDate, endDate } = req.body;
    
    // Extract credential from the appropriate header based on sourceId
    let credential: string | undefined;
    if (sourceId === 'openai') credential = req.headers['x-credential-openai'] as string;
    else if (sourceId === 'anthropic') credential = req.headers['x-credential-anthropic'] as string;
    else if (sourceId === 'github_copilot') credential = req.headers['x-credential-github'] as string;

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
  } catch (err: any) {
    next(err);
  }
});

export default router;
