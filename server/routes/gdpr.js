import { Router } from 'express';
import { gdprService } from '../services/gdpr.js';
import { asyncHandler } from '../utils/errors.js';
import { body, param, validationResult } from 'express-validator';

const router = Router();

// Delete all data for a site (Right to be Forgotten)
router.delete('/site/:wixSiteId', [
  param('wixSiteId').notEmpty().withMessage('wixSiteId is required'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { wixSiteId } = req.params;
    const result = await gdprService.deleteAllSiteData(wixSiteId);
    
    res.json({
      message: 'Data deletion completed successfully',
      ...result,
    });
  })
]);

// Export all data for a site (Right to Data Portability)
router.get('/export/:wixSiteId', [
  param('wixSiteId').notEmpty().withMessage('wixSiteId is required'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { wixSiteId } = req.params;
    const data = await gdprService.exportSiteData(wixSiteId);
    
    res.json(data);
  })
]);

// Delete expired data (Data Retention)
router.post('/retention/cleanup', asyncHandler(async (req, res) => {
  const result = await gdprService.deleteExpiredData();
  
  res.json({
    message: 'Data retention cleanup completed successfully',
    ...result,
  });
}));

// Get retention statistics
router.get('/retention/stats', asyncHandler(async (req, res) => {
  const stats = await gdprService.getRetentionStats();
  
  res.json(stats);
}));

export default router;
