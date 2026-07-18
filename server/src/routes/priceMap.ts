import { Router, Request, Response } from 'express';
import { getPriceMapMeta } from '../data/priceMap.js';

const router = Router();

router.get('/meta', (req: Request, res: Response) => {
  const meta = getPriceMapMeta();
  res.json({
    loadedAt: meta.loadedAt,
    source: meta.source,
    modelCount: meta.modelCount,
    sourceDate: meta.sourceDate,
    snapshotAgeDays: meta.snapshotAgeDays ?? null,
    lastRevalidatedAt: meta.lastRevalidatedAt ?? null,
  });
});

export default router;
