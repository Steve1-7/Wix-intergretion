import { Router } from 'express';
import { supabase } from '../db.js';
import { hubspotService } from '../services/hubspot.js';
import { tokenManager } from '../services/tokenManager.js';
import { wixService } from '../services/wix.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

function siteId(req) {
  return req.query.wix_site_id || req.body.wix_site_id || process.env.WIX_SITE_ID || 'default';
}

router.get('/', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const { data, error } = await supabase
    .from('field_mappings')
    .select('*')
    .eq('wix_site_id', wixSiteId)
    .order('sort_order');
  if (error) throw error;
  res.json(data || []);
}));

router.post('/', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const mapping = req.body;

  const { data, error } = await supabase
    .from('field_mappings')
    .insert({
      wix_site_id: wixSiteId,
      wix_field_key: mapping.wix_field_key,
      wix_field_label: mapping.wix_field_label,
      hubspot_property_name: mapping.hubspot_property_name,
      hubspot_property_label: mapping.hubspot_property_label,
      direction: mapping.direction || 'bidirectional',
      transform_rule: mapping.transform_rule || 'none',
      custom_transform: mapping.custom_transform || null,
      is_required: mapping.is_required || false,
      is_active: true,
      sort_order: mapping.sort_order || 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Duplicate mapping' });
    throw error;
  }
  res.status(201).json(data);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const { data, error } = await supabase
    .from('field_mappings')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Mapping not found' });
  res.json(data);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('field_mappings')
    .delete()
    .eq('id', id);
  if (error) throw error;
  res.json({ status: 'deleted' });
}));

router.get('/wix-fields', asyncHandler(async (req, res) => {
  const fields = wixService.getContactFields();
  res.json(fields);
}));

router.get('/hubspot-properties', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const accessToken = await tokenManager.getValidAccessToken(wixSiteId);
  if (!accessToken) return res.status(401).json({ error: 'HubSpot not connected' });

  const properties = await hubspotService.getContactProperties(accessToken);
  res.json(properties.map(p => ({
    name: p.name,
    label: p.label,
    type: p.type,
    fieldType: p.fieldType,
    groupName: p.groupName,
    options: p.options || [],
  })));
}));

router.post('/batch', asyncHandler(async (req, res) => {
  const wixSiteId = siteId(req);
  const { mappings } = req.body;

  if (!Array.isArray(mappings)) return res.status(400).json({ error: 'mappings must be an array' });

  const rows = mappings.map(m => ({
    wix_site_id: wixSiteId,
    wix_field_key: m.wix_field_key,
    wix_field_label: m.wix_field_label,
    hubspot_property_name: m.hubspot_property_name,
    hubspot_property_label: m.hubspot_property_label,
    direction: m.direction || 'bidirectional',
    transform_rule: m.transform_rule || 'none',
    custom_transform: m.custom_transform || null,
    is_required: m.is_required || false,
    is_active: true,
    sort_order: m.sort_order || 0,
  }));

  // Delete existing and replace
  await supabase.from('field_mappings').delete().eq('wix_site_id', wixSiteId);

  const { data, error } = await supabase
    .from('field_mappings')
    .insert(rows)
    .select();

  if (error) throw error;
  res.status(201).json(data);
}));

export default router;
