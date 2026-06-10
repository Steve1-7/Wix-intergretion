import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { validateEnv } from './utils/envValidator.js';
import { errorHandler } from './utils/errors.js';
import { logger } from './utils/logger.js';
import oauthRoutes from './routes/oauth.js';
import mappingRoutes from './routes/mappings.js';
import syncRoutes from './routes/sync.js';
import webhookRoutes from './routes/webhooks.js';
import formRoutes from './routes/forms.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import healthRoutes from './routes/health.js';
import gdprRoutes from './routes/gdpr.js';

// Validate environment variables on startup (safe)
let ENV_VALID = true;
try {
  validateEnv();
} catch (err) {
  ENV_VALID = false;
  logger.error('envValidator', 'Environment validation failed', { message: err.message });
}

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  message: { error: 'Too many authentication attempts, please try again later.' },
});
app.use('/api/oauth', authLimiter);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/oauth', oauthRoutes);
app.use('/api/mappings', mappingRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/health', healthRoutes);

app.get('/api/health', (req, res) => {
  if (!ENV_VALID) {
    return res.status(500).json({ error: 'Server environment is not configured. Check logs for details.' });
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// If environment validation failed, return 500 for API routes with helpful message
if (!ENV_VALID) {
  app.use('/api', (req, res) => {
    res.status(500).json({ error: 'Server environment is not configured. Please contact admin.' });
  });
}

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
