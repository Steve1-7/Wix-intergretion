const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.info;

const SENSITIVE_KEYS = new Set([
  'access_token', 'refresh_token', 'token', 'authorization',
  'password', 'secret', 'client_secret', 'apikey', 'api_key',
  'email', 'phone', 'first_name', 'last_name',
]);

function mask(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(mask);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = typeof value === 'string' ? value.slice(0, 4) + '****' : '****';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = mask(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function formatMessage(level, component, message, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
  };
  if (data) entry.data = mask(data);
  return JSON.stringify(entry);
}

export const logger = {
  error: (component, message, data) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(formatMessage('error', component, message, data));
    }
  },
  warn: (component, message, data) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', component, message, data));
    }
  },
  info: (component, message, data) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.info(formatMessage('info', component, message, data));
    }
  },
  debug: (component, message, data) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.debug(formatMessage('debug', component, message, data));
    }
  },
};
