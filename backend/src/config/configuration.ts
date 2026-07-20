/**
 * Central typed config. Read once from env via @nestjs/config.
 * Fail fast in main.ts if required secrets are missing.
 */
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-insecure-refresh',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    csrfSecret: process.env.CSRF_SECRET ?? 'dev-insecure-csrf-secret-32b',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  },

  // App-layer encryption key for PII at rest (refund bank details).
  encryptionKey: process.env.ENCRYPTION_KEY ?? 'dev-insecure-encryption-key',

  storage: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'auto',
    bucket: process.env.S3_BUCKET,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  },

  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
  },

  gateway: {
    // SSLCommerz. sandbox=true uses their sandbox host + test store.
    provider: process.env.GATEWAY_PROVIDER ?? 'sslcommerz',
    sandbox: process.env.SSLCZ_SANDBOX !== 'false', // default sandbox in dev
    storeId: process.env.SSLCZ_STORE_ID,
    storePassword: process.env.SSLCZ_STORE_PASSWORD,
  },

  // Public base URLs for building gateway success/fail/IPN redirects + e-tickets.
  webOriginUrl: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  apiPublicUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:4000',

  notifications: {
    // SMS (Bangladesh) — provider-agnostic HTTP sender.
    smsApiUrl: process.env.SMS_API_URL,
    smsApiKey: process.env.SMS_API_KEY,
    smsSenderId: process.env.SMS_SENDER_ID,
    // Email (SMTP).
    smtpUrl: process.env.SMTP_URL, // smtp://user:pass@host:port
    emailFrom: process.env.EMAIL_FROM ?? 'no-reply@houseboat.local',
  },
});
