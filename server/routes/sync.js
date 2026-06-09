import { Router } from 'express';
import { syncEngine } from '../services/syncEngine.js';
import { asyncHandler } from '../utils/errors.js';
import { body, query, validationResult } from 'express-validator';

const router = Router();

function siteId(req) {
  return req.query.wix_site_id || req.body.wix_site_id || process.env.WIX_SITE_ID || 'default';
}

router.post('/wix-to-hubspot', [
  body('wixContactId').notEmpty().withMessage('wixContactId is required'),
  body('wixContactData').optional().isObject(),
  body('correlationId').optional().isString(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const wixSiteId = siteId(req);
    const { wixContactId, wixContactData, correlationId } = req.body;

    const result = await syncEngine.syncWixToHubspot(wixSiteId, wixContactId, wixContactData, correlationId);
    res.json(result);
  })
]);

router.post('/hubspot-to-wix', [
  body('hubspotContactId').notEmpty().withMessage('hubspotContactId is required'),
  body('hubspotContactData').optional().isObject(),
  body('correlationId').optional().isString(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const wixSiteId = siteId(req);
    const { hubspotContactId, hubspotContactData, correlationId } = req.body;

    const result = await syncEngine.syncHubspotToWix(wixSiteId, hubspotContactId, hubspotContactData, correlationId);
    res.json(result);
  })
]);

router.get('/events', [
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const wixSiteId = siteId(req);
    const limit = parseInt(req.query.limit) || 50;
    const events = await syncEngine.getRecentEvents(wixSiteId, limit);
    res.json(events);
  })
]);

router.get('/stats', [
  query('hours').optional().isInt({ min: 1, max: 8760 }).withMessage('Hours must be between 1 and 8760'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const wixSiteId = siteId(req);
    const hours = parseInt(req.query.hours) || 24;
    const stats = await syncEngine.getSyncStats(wixSiteId, hours);
    res.json(stats);
  })
]);

router.post('/retry-failed', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const result = await syncEngine.retryFailedEvents(wixSiteId);
  res.json(result);
}));

router.post('/dead-letter/:eventId', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const result = await syncEngine.moveToDeadLetter(req.params.eventId, wixSiteId);
  res.json(result);
}));

export default router;
