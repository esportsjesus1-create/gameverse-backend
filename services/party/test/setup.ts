import { config } from 'dotenv';

config({ path: '.env.test' });

jest.setTimeout(30000);

beforeAll(async () => {
  console.log('E2E Test Suite Starting...');
});

afterAll(async () => {
  console.log('E2E Test Suite Complete');
});
