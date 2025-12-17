import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initializeDatabase } from './config/database';

dotenv.config();

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'GameVerse Party Module N1.23 is running',
    version: '1.23.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export async function startServer(port: number = 3000): Promise<void> {
  try {
    await initializeDatabase();
    app.listen(port, () => {
      console.log(`GameVerse Party Module N1.23 running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

export default app;
