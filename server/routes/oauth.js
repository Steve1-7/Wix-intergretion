import { Router } from 'express';
import { hubspotService } from '../services/hubspot.js';
import { tokenManager } from '../services/tokenManager.js';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Check if using PAT (Personal Access Token)
function usePAT() {
  return !!process.env.HUBSPOT_PAT;
}

router.get('/connect', asyncHandler(async (req, res) => {
  // If using PAT, return success immediately without OAuth flow
  if (usePAT()) {
    const wixSiteId = req.query.wix_site_id || process.env.WIX_SITE_ID || 'default';
    
    // Store a mock token entry for PAT mode
    await tokenManager.storeTokens(wixSiteId, {
      access_token: process.env.HUBSPOT_PAT,
      refresh_token: 'pat-mode-no-refresh',
      expires_in: 31536000, // 1 year
      portal_id: 'pat-mode',
    });
    
    return res.json({ 
      connected: true,
      message: 'Using Personal Access Token (PAT) for HubSpot authentication',
      authUrl: null 
    });
  }
  
  // OAuth flow
  const wixSiteId = req.query.wix_site_id || process.env.WIX_SITE_ID || 'default';
  const state = Buffer.from(JSON.stringify({ wixSiteId, ts: Date.now() })).toString('base64');
  const authUrl = hubspotService.getAuthUrl(state);
  res.json({ authUrl });
}));

router.get('/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  let wixSiteId = process.env.WIX_SITE_ID || 'default';
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
      wixSiteId = decoded.wixSiteId;
    } catch { /* use default */ }
  }

  const tokenData = await hubspotService.exchangeCodeForTokens(code);

  // Get portal info
  let portalId = null;
  try {
    const accountInfo = await hubspotService.getAccountInfo(tokenData.access_token);
    portalId = accountInfo.portal_id || accountInfo.hub_id;
  } catch (err) {
    logger.warn('oauth', 'Could not fetch portal info', { error: err.message });
  }

  tokenData.portal_id = portalId;
  await tokenManager.storeTokens(wixSiteId, tokenData);

  // Redirect to frontend with success
  const redirectUrl = process.env.NODE_ENV === 'production'
    ? '/dashboard?connected=true'
    : 'http://localhost:5173/dashboard?connected=true';
  res.redirect(redirectUrl);
}));

router.post('/disconnect', asyncHandler(async (req, res) => {
  // If using PAT, disconnect is not applicable
  if (usePAT()) {
    return res.json({ 
      status: 'not_applicable',
      message: 'Cannot disconnect when using Personal Access Token (PAT). Remove HUBSPOT_PAT from environment variables to use OAuth instead.'
    });
  }
  
  const wixSiteId = req.body.wix_site_id || process.env.WIX_SITE_ID || 'default';
  await tokenManager.disconnect(wixSiteId);
  res.json({ status: 'disconnected' });
}));

router.get('/status', asyncHandler(async (req, res) => {
  const wixSiteId = req.query.wix_site_id || process.env.WIX_SITE_ID || 'default';
  
  // If using PAT, return connected status
  if (usePAT()) {
    return res.json({
      is_connected: true,
      hubspot_portal_id: 'pat-mode',
      connected_at: new Date().toISOString(),
      authentication_method: 'PAT',
      message: 'Using Personal Access Token (PAT) for HubSpot authentication'
    });
  }
  
  const status = await tokenManager.getConnectionStatus(wixSiteId);
  res.json(status);
}));

export default router;
