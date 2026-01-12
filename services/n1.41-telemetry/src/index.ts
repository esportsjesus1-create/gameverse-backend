import { createApp, startServer } from './app';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

const app = createApp();
const server = startServer(app, PORT);

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});
