import { Router } from 'express';
import { hubspotService } from '../services/hubspot.js';
import { syncEngine } from '../services/syncEngine.js';
import { tokenManager } from '../services/tokenManager.js';
import { supabase } from '../db.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

function siteId(req) {
  return req.query.wix_site_id || req.body.wix_site_id || process.env.WIX_SITE_ID || 'default';
}

// Get available HubSpot forms
router.get('/hubspot', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const accessToken = await tokenManager.getValidAccessToken(wixSiteId);
  if (!accessToken) return res.status(401).json({ error: 'HubSpot not connected' });

  const forms = await hubspotService.getForms(accessToken);
  res.json(forms.map(f => ({
    guid: f.guid,
    name: f.name,
    portalId: f.portalId,
    fields: f.formFieldGroups?.flatMap(g => g.fields?.map(fd => ({
      name: fd.name,
      label: fd.label,
      type: fd.fieldType,
      required: fd.required,
    }))) || [],
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  })));
}));

// Submit form data to HubSpot
router.post('/submit', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const { formGuid, portalId, fields, context } = req.body;

  if (!formGuid || !portalId || !fields) {
    return res.status(400).json({ error: 'formGuid, portalId, and fields are required' });
  }

  const accessToken = await tokenManager.getValidAccessToken(wixSiteId);
  if (!accessToken) return res.status(401).json({ error: 'HubSpot not connected' });

  const result = await hubspotService.submitForm(accessToken, portalId, formGuid, fields, context);

  // Record submission
  await supabase.from('form_submissions').insert({
    wix_site_id: wixSiteId,
    form_id: formGuid,
    hubspot_contact_id: result?.inlineMessage || null,
    utm_source: context?.utm_source,
    utm_medium: context?.utm_medium,
    utm_campaign: context?.utm_campaign,
    page_url: context?.pageUrl,
    referrer: context?.referrer,
    synced_to_hubspot: true,
    hubspot_sync_at: new Date().toISOString(),
  });

  res.json({ status: 'submitted', result });
}));

// Process a Wix form submission (sync to HubSpot)
router.post('/wix-submission', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const result = await syncEngine.processFormSubmission(wixSiteId, req.body);
  res.json(result);
}));

// Get form submission history
router.get('/submissions', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const limit = parseInt(req.query.limit) || 50;

  const { data, error } = await supabase
    .from('form_submissions')
    .select('*')
    .eq('wix_site_id', wixSiteId)
    .order('submitted_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  res.json(data || []);
}));

export default router;
