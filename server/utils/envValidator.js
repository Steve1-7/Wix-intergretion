import 'dotenv/config';
import { logger } from './logger.js';

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'WIX_API_KEY',
  'WIX_SITE_ID',
  'ENCRYPTION_KEY',
];

const OPTIONAL_ENV_VARS = [
  'PORT',
  'NODE_ENV',
  'LOG_LEVEL',
  'REDIS_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'WIX_WEBHOOK_SECRET',
  'HUBSPOT_WEBHOOK_SECRET',
  'HUBSPOT_CLIENT_ID',
  'HUBSPOT_CLIENT_SECRET',
  'HUBSPOT_REDIRECT_URI',
  'HUBSPOT_PAT',
];

function validateEnv() {
  const missing = [];
  const warnings = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  for (const envVar of OPTIONAL_ENV_VARS) {
    if (!process.env[envVar]) {
      warnings.push(envVar);
    }
  }

  if (missing.length > 0) {
    logger.error('envValidator', 'Missing required environment variables', { missing });
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please set these in your .env file or environment.'
    );
  }

  if (warnings.length > 0) {
    logger.warn('envValidator', 'Optional environment variables not set', { warnings });
  }

  // Validate specific formats
  if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith('https://')) {
    throw new Error('SUPABASE_URL must start with https://');
  }

  if (process.env.PORT && isNaN(parseInt(process.env.PORT))) {
    throw new Error('PORT must be a valid number');
  }

  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }

  // Validate HubSpot authentication (either OAuth or PAT is required)
  const hasHubSpotOAuth = process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET;
  const hasHubSpotPAT = process.env.HUBSPOT_PAT;

  if (!hasHubSpotOAuth && !hasHubSpotPAT) {
    throw new Error(
      'HubSpot authentication is required. Either set HUBSPOT_PAT (Personal Access Token) or HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET (OAuth)'
    );
  }

  if (hasHubSpotPAT) {
    logger.info('envValidator', 'Using HubSpot Personal Access Token (PAT) for authentication');
  } else if (hasHubSpotOAuth) {
    logger.info('envValidator', 'Using HubSpot OAuth for authentication');
  }

  logger.info('envValidator', 'Environment validation passed', {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3001,
  });

  return {
    required: REQUIRED_ENV_VARS,
    optional: OPTIONAL_ENV_VARS,
    missing,
    warnings,
  };
}

export { validateEnv, REQUIRED_ENV_VARS, OPTIONAL_ENV_VARS };
