import { Router } from 'express';
import { supabase } from '../db.js';
import { syncEngine } from '../services/syncEngine.js';
import { tokenManager } from '../services/tokenManager.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

function siteId(req) {
  return req.query.wix_site_id || process.env.WIX_SITE_ID || 'default';
}

router.get('/overview', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);

  const [connectionStatus, syncStats, mappingCount, contactMappingCount, deadLetterCount] = await Promise.all([
    tokenManager.getConnectionStatus(wixSiteId),
    syncEngine.getSyncStats(wixSiteId, 24),
    supabase.from('field_mappings').select('*', { count: 'exact', head: true }).eq('wix_site_id', wixSiteId).eq('is_active', true),
    supabase.from('contact_mappings').select('*', { count: 'exact', head: true }).eq('wix_site_id', wixSiteId),
    supabase.from('dead_letter_queue').select('*', { count: 'exact', head: true }).eq('wix_site_id', wixSiteId).is('resolved_at', null),
  ]);

  res.json({
    connection: connectionStatus,
    syncStats,
    activeMappings: mappingCount.count || 0,
    syncedContacts: contactMappingCount.count || 0,
    unresolvedDeadLetters: deadLetterCount.count || 0,
  });
}));

router.get('/sync-timeline', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const hours = parseInt(req.query.hours) || 24;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('sync_events')
    .select('created_at, source, event_type, status')
    .eq('wix_site_id', wixSiteId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Group by hour for timeline chart
  const hourly = {};
  for (const event of (data || [])) {
    const hour = new Date(event.created_at).toISOString().slice(0, 13);
    if (!hourly[hour]) hourly[hour] = { completed: 0, failed: 0, skipped: 0 };
    if (event.status === 'completed') hourly[hour].completed++;
    else if (event.status === 'failed') hourly[hour].failed++;
    else hourly[hour].skipped++;
  }

  res.json(Object.entries(hourly).map(([hour, counts]) => ({ hour, ...counts })));
}));

router.get('/contact-mappings', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const limit = parseInt(req.query.limit) || 50;

  const { data, error } = await supabase
    .from('contact_mappings')
    .select('*')
    .eq('wix_site_id', wixSiteId)
    .order('last_synced_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  res.json(data || []);
}));

export default router;
