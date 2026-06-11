const https = require("https");
const pool = require("../config/database");
const logger = require("../utils/logger");

const SMS_API_KEY = process.env.SMS_API_KEY;
const SMS_SENDER_ID = process.env.SMS_SENDER_ID;
const SMS_BASE = "sms.onecodesoft.com";

// In-memory OTP stores
const otpStore = new Map(); // phone -> { otp, expiresAt }
const verifiedStore = new Map(); // phone -> { createdAt }
const otpAttempts = new Map(); // phone -> attempt count

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const staleThreshold = now - 10 * 60 * 1000;
  for (const [phone, entry] of otpStore) {
    if (entry.expiresAt < staleThreshold) {
      otpStore.delete(phone);
      otpAttempts.delete(phone);
    }
  }
  for (const [phone, entry] of verifiedStore) {
    if (entry.createdAt < now - 30 * 60 * 1000) verifiedStore.delete(phone);
  }
}, 5 * 60 * 1000).unref(); // .unref() so timer does not block process exit (e.g. jest --forceExit)

function generateOtp() {
  const { randomInt } = require("crypto");
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

function formatPhone(phone) {
  if (phone.startsWith("88")) return phone;
  return "88" + phone;
}

function sendSms(phone, message) {
  return new Promise((resolve, reject) => {
    const formattedPhone = formatPhone(phone);
    const params = new URLSearchParams({
      api_key: SMS_API_KEY,
      type: "text",
      number: formattedPhone,
      senderid: SMS_SENDER_ID,
      message,
    });
    const options = {
      hostname: SMS_BASE,
      path: `/api/send-sms?${params.toString()}`,
      method: "GET",
      headers: { Accept: "application/json" },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          // onecodesoft wraps success inside results[0].gateway.ErrorCode
          // Top-level parsed.ErrorCode is undefined on success; check nested path first
          const gatewayCode = parsed.results?.[0]?.gateway?.ErrorCode;
          const isSuccess =
            res.statusCode === 200 ||
            res.statusCode === 202 ||
            Number(parsed.ErrorCode) === 0 ||
            (gatewayCode !== undefined && Number(gatewayCode) === 0);
          if (isSuccess) {
            resolve(parsed);
          } else {
            logger.warn("SMS send non-success:", parsed);
            const errMsg =
              parsed.results?.[0]?.gateway?.ErrorDescription ||
              parsed.ErrorMessage ||
              `SMS send failed (code: ${gatewayCode ?? parsed.ErrorCode})`;
            reject(new Error(errMsg));
          }
        } catch {
          logger.warn("SMS response parse error:", data);
          reject(new Error(`SMS response parse error: ${data}`));
        }
      });
    });
    req.on("error", (err) => {
      logger.error("SMS request error:", err.message);
      reject(err);
    });
    req.end();
  });
}

async function sendOtp(phone) {
  const otp = generateOtp();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 120_000 });
  const message = `Your pawliz.com OTP is ${otp}, Expires in 2 minutes`;
  await sendSms(phone, message);
  return { sent: true };
}

function verifyOtp(phone, otp) {
  const entry = otpStore.get(phone);
  if (!entry) return { valid: false, expired: false };
  if (Date.now() > entry.expiresAt) {
    otpAttempts.delete(phone);
    return { valid: false, expired: true };
  }
  const attempts = (otpAttempts.get(phone) || 0) + 1;
  if (entry.otp !== String(otp)) {
    if (attempts >= 3) {
      otpStore.delete(phone);
      otpAttempts.delete(phone);
      return { valid: false, locked: true };
    }
    otpAttempts.set(phone, attempts);
    return { valid: false, expired: false, attemptsLeft: 3 - attempts };
  }
  otpAttempts.delete(phone);
  return { valid: true, expired: false };
}

function markVerified(phone) {
  verifiedStore.set(phone, { createdAt: Date.now() });
  otpStore.delete(phone);
  otpAttempts.delete(phone);
}

const VERIFIED_TTL_MS = 5 * 60 * 1000; // 5 minutes

function checkVerified(phone) {
  const entry = verifiedStore.get(phone);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > VERIFIED_TTL_MS) {
    verifiedStore.delete(phone);
    return false;
  }
  return true;
}

function consumeVerified(phone) {
  const entry = verifiedStore.get(phone);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > VERIFIED_TTL_MS) {
    verifiedStore.delete(phone);
    return false;
  }
  verifiedStore.delete(phone);
  return true;
}

function invalidateOtp(phone) {
  otpStore.delete(phone);
  verifiedStore.delete(phone);
}

function clearOtp(phone) {
  otpStore.delete(phone);
}

let _smsEnabledCache = null; // { value, expiresAt }

async function getSmsEnabled() {
  if (_smsEnabledCache && Date.now() < _smsEnabledCache.expiresAt) {
    return _smsEnabledCache.value;
  }
  try {
    const result = await pool.query(
      "SELECT value FROM site_settings WHERE key = 'sms_enabled'",
    );
    const value = result.rows.length ? result.rows[0].value === "true" : false;
    _smsEnabledCache = { value, expiresAt: Date.now() + 60_000 };
    return value;
  } catch {
    return false;
  }
}

function bustSmsSettingsCache() {
  _smsEnabledCache = null;
}

async function getAdminPhone() {
  try {
    const result = await pool.query(
      "SELECT value FROM site_settings WHERE key = 'admin_phone'",
    );
    return result.rows[0]?.value || null;
  } catch {
    return null;
  }
}

async function sendAdminNotification(message) {
  try {
    const [enabled, adminPhone] = await Promise.all([getSmsEnabled(), getAdminPhone()]);
    if (!enabled || !adminPhone) return;
    await sendSms(adminPhone, message);
  } catch (err) {
    logger.error("Admin SMS notification error:", err.message);
  }
}

async function checkAndAlertLowBalance() {
  try {
    const data = await getBalance();
    const raw = data?.balance ?? data?.Balance ?? data?.credit ?? data?.Credit ?? data?.amount ?? data?.Amount;
    const numeric = parseFloat(raw);
    if (isNaN(numeric)) {
      logger.warn("SMS balance check: could not parse balance from API response", data);
      return;
    }
    if (numeric < 100) {
      await sendAdminNotification("SMS API Balance Low, Recharge Now.");
      logger.warn(`SMS balance low alert sent. Balance: ${numeric} BDT`);
    } else {
      logger.info(`SMS balance check OK: ${numeric} BDT`);
    }
  } catch (err) {
    logger.error("SMS balance check failed:", err.message);
  }
}

function getBalance() {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ api_key: SMS_API_KEY });
    const options = {
      hostname: SMS_BASE,
      path: `/api/get-balance?${params.toString()}`,
      method: "GET",
      headers: { Accept: "application/json" },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

module.exports = {
  sendOtp,
  verifyOtp,
  markVerified,
  checkVerified,
  consumeVerified,
  invalidateOtp,
  clearOtp,
  getSmsEnabled,
  bustSmsSettingsCache,
  getAdminPhone,
  sendAdminNotification,
  getBalance,
  checkAndAlertLowBalance,
};
