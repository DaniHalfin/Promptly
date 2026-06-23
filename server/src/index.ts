import express, { Request, Response, NextFunction, Application } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPriceMap, getPriceMapMeta } from './data/priceMap.js';
import { getTokenizer } from './lib/tokenizer.js';
import healthRouter from './routes/health.js';
import priceMapRouter from './routes/priceMap.js';
import validateRouter from './routes/validate.js';
import analyzeRouter from './routes/analyze.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.EXPRESS_PORT || '3001', 10);

export async function createApp(): Promise<Application> {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // CORS
  const allowedOrigins = [
    'http://localhost:5173',
    `http://localhost:${process.env.VITE_PORT || 5173}`,
    'http://127.0.0.1:5173',
  ];
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,X-Source-Credential,X-Credential-OpenAI,X-Credential-Anthropic,X-Credential-GitHub');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // Load dependencies
  await loadPriceMap();
  await getTokenizer();

  // Routes
  app.use('/api/health', healthRouter);
  app.use('/api/price-map', priceMapRouter);
  app.use('/api/sources', validateRouter);
  app.use('/api', analyzeRouter);

  // Error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[error]', err.message);
    res.status(err.status || 500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message || 'Internal server error' },
    });
  });

  return app;
}

async function main() {
  const app = await createApp();
  app.listen(PORT, () => {
    console.log(`✓ Promptly server listening on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
