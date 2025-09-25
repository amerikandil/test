const defaults = require('./default.json');

function coerceNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
const serverTrustProxy = (() => {
  if (process.env.TRUST_PROXY === undefined) {
    return defaults.server.trustProxy;
  }
  const value = process.env.TRUST_PROXY;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
})();

const config = {
  server: {
    port: coerceNumber(process.env.PORT, defaults.server.port),
    trustProxy: serverTrustProxy
  },
  admin: {
    password: process.env.ADMIN_PASSWORD || defaults.admin.password,
    tokenTtlHours: coerceNumber(
      process.env.ADMIN_TOKEN_TTL_HOURS,
      defaults.admin.tokenTtlHours
    )
  },
  database: {
    filename:
      process.env.DATABASE_FILE || defaults.database.filename,
    schema: process.env.DATABASE_SCHEMA || defaults.database.schema
  }
};

module.exports = config;
