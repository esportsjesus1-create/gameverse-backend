import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import tenantRoutes from './routes/tenant.routes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/tenants', tenantRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: config.serviceName,
    timestamp: new Date().toISOString(),
  });
});

app.use((err: Error & { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message,
    timestamp: new Date().toISOString(),
  });
});

app.listen(config.port, () => {
  console.log(`Tenant service running on port ${config.port}`);
});

export default app;
