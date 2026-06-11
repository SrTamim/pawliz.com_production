process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.PORT = '5001';

// Mock DB pool to avoid needing a real DB in unit tests
jest.mock('../config/database', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  const mockPool = {
    query: jest.fn(),
    end: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient),
    _mockClient: mockClient,
  };
  return mockPool;
});

// Bust auth middleware user cache before every test so mock DB calls are consumed correctly.
// The auth middleware caches users in-process; without this, the 2nd test in a suite
// uses the cached user and skips the mock pool.query call, throwing off all subsequent mocks.
beforeEach(() => {
  // Reset all mock implementations AND queued mockResolvedValueOnce values
  // between tests. clearAllMocks() only clears call history, not the queues.
  // Without this, unconsumed queue items from one test leak into the next.
  jest.resetAllMocks();

  // Re-wire pool.connect() and mockClient after resetAllMocks() clears their implementations
  try {
    const pool = require('../config/database');
    if (pool._mockClient && pool.connect) {
      pool.connect.mockResolvedValue(pool._mockClient);
      // mockClient.query needs a default too — individual tests override with mockResolvedValueOnce
      if (pool._mockClient.query && !pool._mockClient.query.getMockImplementation()) {
        pool._mockClient.query.mockResolvedValue({ rows: [] });
      }
    }
  } catch {}

  try {
    const { evictUser } = require('../middleware/auth');
    // Evict common test user IDs so auth middleware re-queries DB each test
    // Include 99 and common test IDs used across test files
    for (let i = 1; i <= 20; i++) evictUser(i);
    evictUser(99); // comments.test.js default userId
    evictUser(100);
  } catch {}
});
