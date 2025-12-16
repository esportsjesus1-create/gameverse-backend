import express, { Express, Request, Response, NextFunction } from 'express';
import routes from './routes';

export function createApp(): Express {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
  
  app.use('/api/v1', routes);
  
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err.message);
    
    if (err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
      return;
    }
    
    if (err.message.includes('not balanced') || 
        err.message.includes('Missing required') ||
        err.message.includes('Invalid') ||
        err.message.includes('Cannot')) {
      res.status(400).json({ error: err.message });
      return;
    }
    
    res.status(500).json({ error: 'Internal server error' });
  });
  
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });
  
  return app;
}
