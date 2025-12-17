import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import tournamentRoutes from './routes/tournament.routes';
import { TournamentError } from './types';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/tournaments', tournamentRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: config.serviceName,
    timestamp: new Date().toISOString(),
  });
});

app.use((err: Error & { statusCode?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof TournamentError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

app.listen(config.port, () => {
  console.log(`Tournament service running on port ${config.port}`);
});

export default app;
