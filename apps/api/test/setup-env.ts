process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/evolli_rh_test?schema=public';
process.env.APP_VERSION = process.env.APP_VERSION ?? 'test';
process.env.LOG_LEVEL = 'silent';
