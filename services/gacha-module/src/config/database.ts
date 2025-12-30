import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from './index';
import {
  Item,
  Pool,
  Banner,
  PlayerPity,
  PlayerPull,
  PlayerCurrency,
  CurrencyTransaction,
  PlayerInventory,
  PlayerSpending,
  PlayerAgeVerification,
  NFTReward,
  DropRateDisclosure,
} from '../models';

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  entities: [
    Item,
    Pool,
    Banner,
    PlayerPity,
    PlayerPull,
    PlayerCurrency,
    CurrencyTransaction,
    PlayerInventory,
    PlayerSpending,
    PlayerAgeVerification,
    NFTReward,
    DropRateDisclosure,
  ],
  synchronize: config.server.nodeEnv === 'development',
  logging: config.server.nodeEnv === 'development',
  migrations: ['src/migrations/*.ts'],
  migrationsRun: true,
  poolSize: 20,
  extra: {
    max: 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },
};

export const AppDataSource = new DataSource(dataSourceOptions);

let isInitialized = false;

export const initializeDatabase = async (): Promise<DataSource> => {
  if (!isInitialized) {
    await AppDataSource.initialize();
    isInitialized = true;
  }
  return AppDataSource;
};

export const getDataSource = (): DataSource => {
  if (!isInitialized) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return AppDataSource;
};

export default AppDataSource;
