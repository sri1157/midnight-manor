import 'dotenv/config';

/** Read an environment variable; empty strings count as missing. */
export function env(name, fallback = undefined) {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

export const config = {
  port: Number(env('PORT', '3001')),
  isProduction: env('NODE_ENV') === 'production',
};