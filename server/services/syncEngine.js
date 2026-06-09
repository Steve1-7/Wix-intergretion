import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db.js';
import { hubspotService } from './hubspot.js';
import { wixService } from './wix.js';
import { tokenManager } from './tokenManager.js';
import { logger } from '../utils/logger.js';

const TRANSFORMS = {
  none: (v) => v,
  lowercase: (v) => (typeof v === 'string' ? v.toLowerCase() : v),
  uppercase: (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  trim: (v) => (typeof v === 'string' ? v.trim() : v),
  format_phone: (v) => {
    if (typeof v !== 'string') return v;
    const digits = v.replace(/\D/g, '');
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 11) return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return v;
  },
  custom: (v, expr) => {
    try { return new Function('v', `return ${expr}`)(v); } catch { return v; }
  },
};

function computeHash(fields) {
  const sorted = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(sorted);
}

async function getActiveMappings(wixSiteId) {
  const { data, error } = await supabase
    .from('field_mappings')
    .select('*')
    .eq('wix_site_id', wixSiteId)
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return data || [];
}

async function getSyncSettings(wixSiteId) {
  const { data } = await supabase
    .from('sync_settings')
    .select('*')
    .eq('wix_site_id', wixSiteId)
    .single();
  return data || { conflict_resolution_strategy: 'last_updated_wins', deduplication_window_seconds: 300 };
}

async function findMapping(wixSiteId, wixContactId, hubspotContactId) {
  let query = supabase.from('contact_mappings').select('*').eq('wix_site_id', wixSiteId);
  if (wixContactId) query = query.eq('wix_contact_id', wixContactId);
  if (hubspotContactId) query = query.eq('hubspot_contact_id', hubspotContactId);

  const { data } = await query.limit(1);
  return data?.[0] || null;
}

async function upsertMapping(wixSiteId, wixContactId, hubspotContactId, source, syncHash) {
  const { data, error } = await supabase
    .from('contact_mappings')
    .upsert({
      wix_site_id: wixSiteId,
      wix_contact_id: wixContactId,
      hubspot_contact_id: hubspotContactId,
      last_synced_at: new Date().toISOString(),
      last_sync_source: source,
      sync_hash: syncHash,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'wix_site_id,wix_contact_id' })
    .select()
    .single();

  if (error) logger.error('syncEngine', 'Failed to upsert mapping', { error: error.message });
  return data;
}

async function recordEvent(wixSiteId, syncId, source, eventType, wixContactId, hubspotContactId, payload, correlationId, status = 'processing') {
  const { data, error } = await supabase
    .from('sync_events')
    .insert({
      wix_site_id: wixSiteId,
      sync_id: syncId,
      source,
      event_type: eventType,
      wix_contact_id: wixContactId,
      hubspot_contact_id: hubspotContactId,
      payload,
      correlation_id: correlationId,
      status,
    })
    .select()
    .single();

  if (error) logger.error('syncEngine', 'Failed to record event', { error: error.message });
  return data;
}

async function updateEventStatus(eventId, status, errorMessage = null) {
  const { error } = await supabase
    .from('sync_events')
    .update({ status, error_message: errorMessage, processed_at: new Date().toISOString() })
    .eq('id', eventId);
  if (error) logger.error('syncEngine', 'Failed to update event status', { error: error.message });
}

async function isDuplicateEvent(wixSiteId, source, eventType, wixContactId, hubspotContactId, dedupWindowSec) {
  const cutoff = new Date(Date.now() - dedupWindowSec * 1000).toISOString();
  const { count } = await supabase
    .from('sync_events')
    .select('*', { count: 'exact', head: true })
    .eq('wix_site_id', wixSiteId)
    .eq('source', source)
    .eq('event_type', eventType)
    .gte('created_at', cutoff)
    .eq('status', 'completed');

  if (wixContactId) {
    const { count: c2 } = await supabase
      .from('sync_events')
      .select('*', { count: 'exact', head: true })
      .eq('wix_site_id', wixSiteId)
      .eq('source', source)
      .eq('event_type', eventType)
      .eq('wix_contact_id', wixContactId)
      .gte('created_at', cutoff)
      .eq('status', 'completed');
    return c2 > 0;
  }
  return count > 0;
}

function applyTransforms(sourceFields, mappings, direction) {
  const result = {};
  for (const mapping of mappings) {
    const isActive = direction === 'wix_to_hubspot'
      ? ['wix_to_hubspot', 'bidirectional'].includes(mapping.direction)
      : ['hubspot_to_wix', 'bidirectional'].includes(mapping.direction);

    if (!isActive) continue;

    const sourceKey = direction === 'wix_to_hubspot' ? mapping.wix_field_key : mapping.hubspot_property_name;
    const targetKey = direction === 'wix_to_hubspot' ? mapping.hubspot_property_name : mapping.wix_field_key;

    let value = sourceFields[sourceKey];
    if (value === undefined || value === null || value === '') continue;

    const transform = TRANSFORMS[mapping.transform_rule] || TRANSFORMS.none;
    value = mapping.transform_rule === 'custom'
      ? TRANSFORMS.custom(value, mapping.custom_transform)
      : transform(value);

    result[targetKey] = value;
  }
  return result;
}

export const syncEngine = {
  async syncWixToHubspot(wixSiteId, wixContactId, wixContactData, correlationId = null) {
    const syncId = uuidv4();
    correlationId = correlationId || uuidv4();
    const source = 'wix';

    logger.info('syncEngine', 'Starting Wix→HubSpot sync', { wixContactId, syncId });

    try {
      const settings = await getSyncSettings(wixSiteId);
      if (!settings.wix_to_hubspot_enabled) {
        logger.info('syncEngine', 'Wix→HubSpot sync disabled', { wixSiteId });
        return { status: 'skipped', reason: 'sync_disabled' };
      }

      // Deduplication check
      if (await isDuplicateEvent(wixSiteId, source, 'contact_updated', wixContactId, null, settings.deduplication_window_seconds)) {
        logger.info('syncEngine', 'Duplicate event detected, skipping', { wixContactId });
        return { status: 'skipped', reason: 'duplicate' };
      }

      const accessToken = await tokenManager.getValidAccessToken(wixSiteId);
      if (!accessToken) throw new Error('No HubSpot connection');

      const mappings = await getActiveMappings(wixSiteId);
      const existingMapping = await findMapping(wixSiteId, wixContactId, null);

      // Extract fields from Wix contact
      const wixFields = wixService.mapWixContactToFields({ info: wixContactData });
      const hubspotProperties = applyTransforms(wixFields, mappings, 'wix_to_hubspot');

      // Idempotency: check if data actually changed
      const newHash = computeHash(hubspotProperties);
      if (existingMapping?.sync_hash === newHash) {
        logger.info('syncEngine', 'No data changes detected, skipping', { wixContactId });
        return { status: 'skipped', reason: 'no_changes' };
      }

      const event = await recordEvent(wixSiteId, syncId, source, existingMapping ? 'contact_updated' : 'contact_created', wixContactId, existingMapping?.hubspot_contact_id, hubspotProperties, correlationId);

      let hubspotContactId;

      if (existingMapping?.hubspot_contact_id) {
        // Update existing
        await hubspotService.updateContact(accessToken, existingMapping.hubspot_contact_id, hubspotProperties);
        hubspotContactId = existingMapping.hubspot_contact_id;
        logger.info('syncEngine', 'Updated HubSpot contact', { hubspotContactId });
      } else {
        // Check if contact exists by email
        if (hubspotProperties.email) {
          const search = await hubspotService.searchContactByEmail(accessToken, hubspotProperties.email);
          if (search.results?.length > 0) {
            hubspotContactId = search.results[0].id;
            await hubspotService.updateContact(accessToken, hubspotContactId, hubspotProperties);
            logger.info('syncEngine', 'Found and updated existing HubSpot contact', { hubspotContactId });
          }
        }

        if (!hubspotContactId) {
          const created = await hubspotService.createContact(accessToken, hubspotProperties);
          hubspotContactId = created.id;
          logger.info('syncEngine', 'Created HubSpot contact', { hubspotContactId });
        }
      }

      await upsertMapping(wixSiteId, wixContactId, hubspotContactId, source, newHash);
      await updateEventStatus(event.id, 'completed');

      return { status: 'completed', hubspotContactId, syncId };
    } catch (err) {
      logger.error('syncEngine', 'Wix→HubSpot sync failed', { wixContactId, error: err.message });
      await updateEventStatus(syncId, 'failed', err.message);
      throw err;
    }
  },

  async syncHubspotToWix(wixSiteId, hubspotContactId, hubspotContactData, correlationId = null) {
    const syncId = uuidv4();
    correlationId = correlationId || uuidv4();
    const source = 'hubspot';

    logger.info('syncEngine', 'Starting HubSpot→Wix sync', { hubspotContactId, syncId });

    try {
      const settings = await getSyncSettings(wixSiteId);
      if (!settings.hubspot_to_wix_enabled) {
        logger.info('syncEngine', 'HubSpot→Wix sync disabled', { wixSiteId });
        return { status: 'skipped', reason: 'sync_disabled' };
      }

      // Deduplication check
      if (await isDuplicateEvent(wixSiteId, source, 'contact_updated', null, hubspotContactId, settings.deduplication_window_seconds)) {
        logger.info('syncEngine', 'Duplicate event detected, skipping', { hubspotContactId });
        return { status: 'skipped', reason: 'duplicate' };
      }

      const mappings = await getActiveMappings(wixSiteId);
      const existingMapping = await findMapping(wixSiteId, null, hubspotContactId);

      // Extract fields from HubSpot contact
      const hubspotFields = hubspotContactData.properties || {};
      const wixFields = applyTransforms(hubspotFields, mappings, 'hubspot_to_wix');

      // Idempotency check
      const newHash = computeHash(wixFields);
      if (existingMapping?.sync_hash === newHash) {
        logger.info('syncEngine', 'No data changes detected, skipping', { hubspotContactId });
        return { status: 'skipped', reason: 'no_changes' };
      }

      const event = await recordEvent(wixSiteId, syncId, source, existingMapping ? 'contact_updated' : 'contact_created', existingMapping?.wix_contact_id, hubspotContactId, wixFields, correlationId);

      let wixContactId;

      if (existingMapping?.wix_contact_id) {
        await wixService.updateContact(existingMapping.wix_contact_id, wixFields);
        wixContactId = existingMapping.wix_contact_id;
        logger.info('syncEngine', 'Updated Wix contact', { wixContactId });
      } else {
        // Search by email
        if (wixFields.email) {
          const search = await wixService.searchContactByEmail(wixFields.email);
          if (search.contacts?.length > 0) {
            wixContactId = search.contacts[0].contactId;
            await wixService.updateContact(wixContactId, wixFields);
            logger.info('syncEngine', 'Found and updated existing Wix contact', { wixContactId });
          }
        }

        if (!wixContactId) {
          const created = await wixService.createContact(wixFields);
          wixContactId = created.contact?.id || created.id;
          logger.info('syncEngine', 'Created Wix contact', { wixContactId });
        }
      }

      await upsertMapping(wixSiteId, wixContactId, hubspotContactId, source, newHash);
      await updateEventStatus(event.id, 'completed');

      return { status: 'completed', wixContactId, syncId };
    } catch (err) {
      logger.error('syncEngine', 'HubSpot→Wix sync failed', { hubspotContactId, error: err.message });
      await updateEventStatus(syncId, 'failed', err.message);
      throw err;
    }
  },

  async processFormSubmission(wixSiteId, submission) {
    const syncId = uuidv4();

    logger.info('syncEngine', 'Processing form submission', { syncId });

    try {
      const accessToken = await tokenManager.getValidAccessToken(wixSiteId);
      if (!accessToken) throw new Error('No HubSpot connection');

      const tokens = await tokenManager.getTokens(wixSiteId);
      const portalId = tokens?.hubspot_portal_id;

      // Store submission with UTM data
      const { data: subRecord } = await supabase
        .from('form_submissions')
        .insert({
          wix_site_id: wixSiteId,
          form_id: submission.formId,
          submission_id: submission.submissionId,
          utm_source: submission.utm_source,
          utm_medium: submission.utm_medium,
          utm_campaign: submission.utm_campaign,
          utm_term: submission.utm_term,
          utm_content: submission.utm_content,
          page_url: submission.page_url,
          referrer: submission.referrer,
          landing_page: submission.landing_page,
          session_id: submission.session_id,
        })
        .select()
        .single();

      // Create/update contact in HubSpot
      const contactProperties = {};
      if (submission.email) contactProperties.email = submission.email;
      if (submission.firstname) contactProperties.firstname = submission.firstname;
      if (submission.lastname) contactProperties.lastname = submission.lastname;
      if (submission.phone) contactProperties.phone = submission.phone;

      // Add UTM attribution
      if (submission.utm_source) contactProperties.utm_source = submission.utm_source;
      if (submission.utm_medium) contactProperties.utm_medium = submission.utm_medium;
      if (submission.utm_campaign) contactProperties.utm_campaign = submission.utm_campaign;

      // Search for existing contact first
      let hubspotContactId;
      if (contactProperties.email) {
        const search = await hubspotService.searchContactByEmail(accessToken, contactProperties.email);
        if (search.results?.length > 0) {
          hubspotContactId = search.results[0].id;
          await hubspotService.updateContact(accessToken, hubspotContactId, contactProperties);
        }
      }

      if (!hubspotContactId) {
        const created = await hubspotService.createContact(accessToken, contactProperties);
        hubspotContactId = created.id;
      }

      // Mark submission as synced
      if (subRecord) {
        await supabase
          .from('form_submissions')
          .update({
            synced_to_hubspot: true,
            hubspot_sync_at: new Date().toISOString(),
            hubspot_contact_id: hubspotContactId,
          })
          .eq('id', subRecord.id);
      }

      logger.info('syncEngine', 'Form submission synced', { hubspotContactId, syncId });
      return { status: 'completed', hubspotContactId, syncId };
    } catch (err) {
      logger.error('syncEngine', 'Form submission sync failed', { error: err.message, syncId });
      throw err;
    }
  },

  async getSyncStats(wixSiteId, hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const [completed, failed, pending, deadLetters] = await Promise.all([
      supabase.from('sync_events').select('*', { count: 'exact', head: true }).eq('wix_site_id', wixSiteId).eq('status', 'completed').gte('created_at', cutoff),
      supabase.from('sync_events').select('*', { count: 'exact', head: true }).eq('wix_site_id', wixSiteId).eq('status', 'failed').gte('created_at', cutoff),
      supabase.from('sync_events').select('*', { count: 'exact', head: true }).eq('wix_site_id', wixSiteId).eq('status', 'pending').gte('created_at', cutoff),
      supabase.from('dead_letter_queue').select('*', { count: 'exact', head: true }).eq('wix_site_id', wixSiteId).gte('dead_lettered_at', cutoff),
    ]);

    return {
      completed: completed.count || 0,
      failed: failed.count || 0,
      pending: pending.count || 0,
      deadLetters: deadLetters.count || 0,
      period: `${hours}h`,
    };
  },

  async getRecentEvents(wixSiteId, limit = 50) {
    const { data, error } = await supabase
      .from('sync_events')
      .select('*')
      .eq('wix_site_id', wixSiteId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async moveToDeadLetter(eventId, wixSiteId) {
    const { data: event } = await supabase
      .from('sync_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event) throw new Error('Event not found');

    const { data, error } = await supabase
      .from('dead_letter_queue')
      .insert({
        wix_site_id: wixSiteId,
        original_event_id: eventId,
        source: event.source,
        event_type: event.event_type,
        payload: event.payload,
        error_message: event.error_message,
        retry_count: event.retry_count,
      })
      .select()
      .single();

    if (error) throw error;

    await updateEventStatus(eventId, 'failed', 'Moved to dead letter queue');
    return data;
  },

  async retryFailedEvents(wixSiteId, maxRetries = 3) {
    const { data: events } = await supabase
      .from('sync_events')
      .select('*')
      .eq('wix_site_id', wixSiteId)
      .eq('status', 'failed')
      .lt('retry_count', maxRetries)
      .order('created_at', { ascending: true })
      .limit(10);

    if (!events?.length) return { retried: 0 };

    let retried = 0;
    for (const event of events) {
      try {
        await supabase
          .from('sync_events')
          .update({
            status: 'pending',
            retry_count: event.retry_count + 1,
            next_retry_at: new Date().toISOString(),
          })
          .eq('id', event.id);
        retried++;
      } catch (err) {
        logger.error('syncEngine', 'Retry preparation failed', { eventId: event.id, error: err.message });
      }
    }

    return { retried };
  },
};
