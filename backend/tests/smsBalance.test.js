require('./setup');

jest.mock('https');

let smsService;
let pool;
let https;

beforeEach(() => {
  jest.resetModules();
  jest.mock('https');
  jest.mock('../config/database', () => ({ query: jest.fn() }));
  https = require('https');
  smsService = require('../services/smsService');
  pool = require('../config/database');
  jest.clearAllMocks();
});

function mockGetBalance(body) {
  https.request.mockImplementationOnce((options, cb) => {
    const res = { statusCode: 200, on: jest.fn() };
    res.on.mockImplementation((event, handler) => {
      if (event === 'data') handler(JSON.stringify(body));
      if (event === 'end') handler();
      return res;
    });
    cb(res);
    return { on: jest.fn(), end: jest.fn() };
  });
}

function mockSendSmsSuccess() {
  https.request.mockImplementationOnce((options, cb) => {
    const res = { statusCode: 200, on: jest.fn() };
    res.on.mockImplementation((event, handler) => {
      if (event === 'data') handler(JSON.stringify({ ErrorCode: '0' }));
      if (event === 'end') handler();
      return res;
    });
    cb(res);
    return { on: jest.fn(), end: jest.fn() };
  });
}

describe('checkAndAlertLowBalance', () => {
  it('sends alert when balance < 100', async () => {
    mockGetBalance({ balance: '45.00' });
    pool.query
      .mockResolvedValueOnce({ rows: [{ value: 'true' }] })
      .mockResolvedValueOnce({ rows: [{ value: '01700000000' }] });
    mockSendSmsSuccess();

    await smsService.checkAndAlertLowBalance();
    expect(https.request).toHaveBeenCalledTimes(2);
  });

  it('does not send SMS when balance >= 100', async () => {
    mockGetBalance({ balance: '250.00' });

    await smsService.checkAndAlertLowBalance();
    expect(https.request).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('handles Balance (capital B) field', async () => {
    mockGetBalance({ Balance: '20' });
    pool.query
      .mockResolvedValueOnce({ rows: [{ value: 'true' }] })
      .mockResolvedValueOnce({ rows: [{ value: '01700000000' }] });
    mockSendSmsSuccess();

    await smsService.checkAndAlertLowBalance();
    expect(https.request).toHaveBeenCalledTimes(2);
  });

  it('handles credit field', async () => {
    mockGetBalance({ credit: '50' });
    pool.query
      .mockResolvedValueOnce({ rows: [{ value: 'true' }] })
      .mockResolvedValueOnce({ rows: [{ value: '01700000000' }] });
    mockSendSmsSuccess();

    await smsService.checkAndAlertLowBalance();
    expect(https.request).toHaveBeenCalledTimes(2);
  });

  it('does not crash on unparseable response — no known field', async () => {
    mockGetBalance({ status: 'ok' });

    await smsService.checkAndAlertLowBalance();
    expect(https.request).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('does not crash when getBalance throws (network error)', async () => {
    https.request.mockImplementationOnce(() => {
      const req = {
        on: jest.fn((event, handler) => {
          if (event === 'error') handler(new Error('Network error'));
          return req;
        }),
        end: jest.fn(),
      };
      return req;
    });

    await expect(smsService.checkAndAlertLowBalance()).resolves.toBeUndefined();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('does not send SMS when sms_enabled is false', async () => {
    mockGetBalance({ balance: '30.00' });
    pool.query.mockResolvedValueOnce({ rows: [{ value: 'false' }] });

    await smsService.checkAndAlertLowBalance();
    expect(https.request).toHaveBeenCalledTimes(1);
  });

  it('does not send SMS when admin_phone is empty', async () => {
    mockGetBalance({ balance: '30.00' });
    pool.query
      .mockResolvedValueOnce({ rows: [{ value: 'true' }] })
      .mockResolvedValueOnce({ rows: [] });

    await smsService.checkAndAlertLowBalance();
    expect(https.request).toHaveBeenCalledTimes(1);
  });
});
