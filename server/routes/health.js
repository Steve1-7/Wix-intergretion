import { Router } from 'express';
import { supabase } from '../db.js';
import { tokenManager } from '../services/tokenManager.js';
import { hubspotService } from '../services/hubspot.js';
import { wixService } from '../services/wix.js';
import { jobQueueManager } from '../services/jobQueue.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/health', async (req, res) => {
  const wixSiteId = req.query.wix_site_id || process.env.WIX_SITE_ID || 'default';
  const checks = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    status: 'healthy',
    checks: {},
  };

  try {
    // Database check
    try {
      const { error } = await supabase.from('sync_settings').select('wix_site_id').limit(1);
      checks.checks.database = {
        status: error ? 'unhealthy' : 'healthy',
        message: error ? error.message : 'Connected',
      };
      if (error) checks.status = 'degraded';
    } catch (err) {
      checks.checks.database = {
        status: 'unhealthy',
        message: err.message,
      };
      checks.status = 'degraded';
    }

    // Redis/Job Queue check
    try {
      const queueStats = await jobQueueManager.getQueueStats();
      checks.checks.jobQueue = {
        status: 'healthy',
        sync: queueStats.sync,
        webhook: queueStats.webhook,
      };
    } catch (err) {
      checks.checks.jobQueue = {
        status: 'unhealthy',
        message: err.message,
      };
      checks.status = 'degraded';
    }

    // HubSpot connection check
    try {
      const hubspotStatus = await tokenManager.getConnectionStatus(wixSiteId);
      if (hubspotStatus.is_connected) {
        const accessToken = await tokenManager.getValidAccessToken(wixSiteId);
        if (accessToken) {
          // Test API call
          await hubspotService.getAccountInfo(accessToken);
          checks.checks.hubspot = {
            status: 'healthy',
            connected: true,
            portalId: hubspotStatus.hubspot_portal_id,
          };
        } else {
          checks.checks.hubspot = {
            status: 'degraded',
            connected: true,
            message: 'Connected but token refresh failed',
          };
          checks.status = 'degraded';
        }
      } else {
        checks.checks.hubspot = {
          status: 'healthy',
          connected: false,
          message: 'Not connected (expected if not set up)',
        };
      }
    } catch (err) {
      checks.checks.hubspot = {
        status: 'unhealthy',
        message: err.message,
      };
      checks.status = 'degraded';
    }

    // Wix API check
    try {
      if (process.env.WIX_API_KEY) {
        checks.checks.wix = {
          status: 'healthy',
          configured: true,
          message: 'API key configured',
        };
      } else {
        checks.checks.wix = {
          status: 'healthy',
          configured: false,
          message: 'API key not configured (expected if not set up)',
        };
      }
    } catch (err) {
      checks.checks.wix = {
        status: 'unhealthy',
        message: err.message,
      };
      checks.status = 'degraded';
    }

    // Memory check
    const memoryUsage = process.memoryUsage();
    checks.checks.memory = {
      status: 'healthy',
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
    };

    res.status(checks.status === 'healthy' ? 200 : 503).json(checks);
  } catch (error) {
    logger.error('health', 'Health check failed', { error: error.message });
    checks.status = 'unhealthy';
    checks.checks.system = {
      status: 'unhealthy',
      message: error.message,
    };
    res.status(503).json(checks);
  }
});

router.get('/readiness', async (req, res) => {
  const wixSiteId = req.query.wix_site_id || process.env.WIX_SITE_ID || 'default';
  const ready = {
    ready: true,
    checks: {},
  };

  // Critical checks for readiness
  try {
    // Database must be accessible
    const { error } = await supabase.from('sync_settings').select('wix_site_id').limit(1);
    if (error) {
      ready.ready = false;
      ready.checks.database = false;
    } else {
      ready.checks.database = true;
    }

    // Redis must be accessible for job queue
    try {
      await jobQueueManager.getQueueStats();
      ready.checks.redis = true;
    } catch (err) {
      ready.ready = false;
      ready.checks.redis = false;
    }

    res.status(ready.ready ? 200 : 503).json(ready);
  } catch (error) {
    ready.ready = false;
    res.status(503).json(ready);
  }
});

router.get('/liveness', (req, res) => {
  // Liveness probe - just check if the process is running
  res.json({
    alive: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
