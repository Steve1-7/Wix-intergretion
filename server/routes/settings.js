import { Router } from 'express';
import { supabase } from '../db.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

function siteId(req) {
  return req.query.wix_site_id || req.body.wix_site_id || process.env.WIX_SITE_ID || 'default';
}

router.get('/', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const { data, error } = await supabase
    .from('sync_settings')
    .select('*')
    .eq('wix_site_id', wixSiteId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  res.json(data || {
    conflict_resolution_strategy: 'last_updated_wins',
    sync_enabled: true,
    wix_to_hubspot_enabled: true,
    hubspot_to_wix_enabled: true,
    deduplication_window_seconds: 300,
    max_concurrent_syncs: 10,
    retry_delay_seconds: 60,
  });
}));

router.put('/', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const updates = req.body;

  const { data, error } = await supabase
    .from('sync_settings')
    .upsert({
      wix_site_id: wixSiteId,
      conflict_resolution_strategy: updates.conflict_resolution_strategy,
      sync_enabled: updates.sync_enabled,
      wix_to_hubspot_enabled: updates.wix_to_hubspot_enabled,
      hubspot_to_wix_enabled: updates.hubspot_to_wix_enabled,
      deduplication_window_seconds: updates.deduplication_window_seconds,
      max_concurrent_syncs: updates.max_concurrent_syncs,
      retry_delay_seconds: updates.retry_delay_seconds,
      webhook_secret: updates.webhook_secret,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'wix_site_id' })
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

// Get dead letter queue
router.get('/dead-letter', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const { data, error } = await supabase
    .from('dead_letter_queue')
    .select('*')
    .eq('wix_site_id', wixSiteId)
    .order('dead_lettered_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  res.json(data || []);
}));

// Resolve a dead letter item
router.put('/dead-letter/:id/resolve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolutionNote } = req.body;

  const { data, error } = await supabase
    .from('dead_letter_queue')
    .update({
      resolved_at: new Date().toISOString(),
      resolution_note: resolutionNote || 'Manually resolved',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Dead letter item not found' });
  res.json(data);
}));

// Get sync conflicts
router.get('/conflicts', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const { data, error } = await supabase
    .from('sync_conflicts')
    .select('*')
    .eq('wix_site_id', wixSiteId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  res.json(data || []);
}));

export default router;
