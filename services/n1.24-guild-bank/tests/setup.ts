// Jest setup file
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.DEFAULT_APPROVAL_THRESHOLD = '2';
  process.env.DEFAULT_DAILY_WITHDRAWAL_LIMIT = '10000';
  process.env.DEFAULT_SINGLE_WITHDRAWAL_LIMIT = '5000';
});

afterAll(() => {
  // Cleanup after all tests
});
