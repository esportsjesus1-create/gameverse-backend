import { DataSource } from 'typeorm';
import config from './index';
import { Item, Banner, PlayerPull, PlayerPity } from '../models';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  synchronize: config.server.nodeEnv === 'development',
  logging: config.server.nodeEnv === 'development',
  entities: [Item, Banner, PlayerPull, PlayerPity],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});

export const initializeDatabase = async (): Promise<DataSource> => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
};

export const closeDatabase = async (): Promise<void> => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
};
