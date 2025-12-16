import { createApp } from './app';
import { config } from './config';
import { runMigrations } from './db/migrations';
import { closePool } from './db/pool';
import { startAllJobs, stopAllJobs } from './jobs/reconciliationJob';

async function main(): Promise<void> {
  try {
    console.log('Running database migrations...');
    await runMigrations();
    
    const app = createApp();
    
    startAllJobs();
    
    const server = app.listen(config.port, () => {
      console.log(`GameVerse Ledger API running on port ${config.port}`);
      console.log(`Environment: ${config.env}`);
    });
    
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      
      stopAllJobs();
      
      server.close(async () => {
        console.log('HTTP server closed');
        await closePool();
        console.log('Database connections closed');
        process.exit(0);
      });
      
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
