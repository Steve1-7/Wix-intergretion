import { supabase } from '../db.js';
import { logger } from '../utils/logger.js';

const DEFAULT_RETENTION_DAYS = {
  sync_events: 90,
  form_submissions: 365,
  dead_letter_queue: 30,
  sync_conflicts: 180,
};

export const gdprService = {
  /**
   * Delete all data for a specific Wix site (Right to be Forgotten)
   */
  async deleteAllSiteData(wixSiteId) {
    logger.info('gdpr', 'Starting data deletion for site', { wixSiteId });

    const results = {
      sync_events: 0,
      form_submissions: 0,
      dead_letter_queue: 0,
      sync_conflicts: 0,
      contact_mappings: 0,
      field_mappings: 0,
      integration_settings: false,
      sync_settings: false,
    };

    try {
      // Delete sync events
      const { count: syncEventsCount } = await supabase
        .from('sync_events')
        .delete()
        .eq('wix_site_id', wixSiteId);
      results.sync_events = syncEventsCount || 0;

      // Delete form submissions
      const { count: formSubmissionsCount } = await supabase
        .from('form_submissions')
        .delete()
        .eq('wix_site_id', wixSiteId);
      results.form_submissions = formSubmissionsCount || 0;

      // Delete dead letter queue
      const { count: deadLetterCount } = await supabase
        .from('dead_letter_queue')
        .delete()
        .eq('wix_site_id', wixSiteId);
      results.dead_letter_queue = deadLetterCount || 0;

      // Delete sync conflicts
      const { count: syncConflictsCount } = await supabase
        .from('sync_conflicts')
        .delete()
        .eq('wix_site_id', wixSiteId);
      results.sync_conflicts = syncConflictsCount || 0;

      // Delete contact mappings
      const { count: contactMappingsCount } = await supabase
        .from('contact_mappings')
        .delete()
        .eq('wix_site_id', wixSiteId);
      results.contact_mappings = contactMappingsCount || 0;

      // Delete field mappings
      const { count: fieldMappingsCount } = await supabase
        .from('field_mappings')
        .delete()
        .eq('wix_site_id', wixSiteId);
      results.field_mappings = fieldMappingsCount || 0;

      // Delete integration settings (disconnect HubSpot)
      const { error: settingsError } = await supabase
        .from('integration_settings')
        .update({
          is_connected: false,
          access_token: null,
          refresh_token: null,
          disconnected_at: new Date().toISOString(),
        })
        .eq('wix_site_id', wixSiteId);
      results.integration_settings = !settingsError;

      // Delete sync settings
      const { error: syncSettingsError } = await supabase
        .from('sync_settings')
        .delete()
        .eq('wix_site_id', wixSiteId);
      results.sync_settings = !syncSettingsError;

      logger.info('gdpr', 'Data deletion completed', { wixSiteId, results });
      return { success: true, results };
    } catch (error) {
      logger.error('gdpr', 'Data deletion failed', { wixSiteId, error: error.message });
      throw new Error(`Failed to delete data: ${error.message}`);
    }
  },

  /**
   * Export all data for a specific Wix site (Right to Data Portability)
   */
  async exportSiteData(wixSiteId) {
    logger.info('gdpr', 'Starting data export for site', { wixSiteId });

    try {
      const data = {
        wix_site_id: wixSiteId,
        export_date: new Date().toISOString(),
        integration_settings: null,
        sync_settings: null,
        field_mappings: [],
        contact_mappings: [],
        sync_events: [],
        form_submissions: [],
        dead_letter_queue: [],
        sync_conflicts: [],
      };

      // Get integration settings (without tokens)
      const { data: settings } = await supabase
        .from('integration_settings')
        .select('wix_site_id, hubspot_portal_id, scopes, connected_at, disconnected_at, is_connected')
        .eq('wix_site_id', wixSiteId)
        .single();
      data.integration_settings = settings;

      // Get sync settings
      const { data: syncSettings } = await supabase
        .from('sync_settings')
        .select('*')
        .eq('wix_site_id', wixSiteId)
        .single();
      data.sync_settings = syncSettings;

      // Get field mappings
      const { data: mappings } = await supabase
        .from('field_mappings')
        .select('*')
        .eq('wix_site_id', wixSiteId);
      data.field_mappings = mappings || [];

      // Get contact mappings
      const { data: contactMappings } = await supabase
        .from('contact_mappings')
        .select('*')
        .eq('wix_site_id', wixSiteId);
      data.contact_mappings = contactMappings || [];

      // Get sync events (last 1000)
      const { data: events } = await supabase
        .from('sync_events')
        .select('*')
        .eq('wix_site_id', wixSiteId)
        .order('created_at', { ascending: false })
        .limit(1000);
      data.sync_events = events || [];

      // Get form submissions (last 500)
      const { data: submissions } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('wix_site_id', wixSiteId)
        .order('submitted_at', { ascending: false })
        .limit(500);
      data.form_submissions = submissions || [];

      // Get dead letter queue
      const { data: deadLetter } = await supabase
        .from('dead_letter_queue')
        .select('*')
        .eq('wix_site_id', wixSiteId);
      data.dead_letter_queue = deadLetter || [];

      // Get sync conflicts
      const { data: conflicts } = await supabase
        .from('sync_conflicts')
        .select('*')
        .eq('wix_site_id', wixSiteId);
      data.sync_conflicts = conflicts || [];

      logger.info('gdpr', 'Data export completed', { 
        wixSiteId, 
        recordCounts: {
          field_mappings: data.field_mappings.length,
          contact_mappings: data.contact_mappings.length,
          sync_events: data.sync_events.length,
          form_submissions: data.form_submissions.length,
          dead_letter_queue: data.dead_letter_queue.length,
          sync_conflicts: data.sync_conflicts.length,
        },
      });

      return data;
    } catch (error) {
      logger.error('gdpr', 'Data export failed', { wixSiteId, error: error.message });
      throw new Error(`Failed to export data: ${error.message}`);
    }
  },

  /**
   * Delete data older than retention period (Data Retention)
   */
  async deleteExpiredData() {
    logger.info('gdpr', 'Starting data retention cleanup');

    const retentionDays = {
      sync_events: parseInt(process.env.RETENTION_SYNC_EVENTS_DAYS) || DEFAULT_RETENTION_DAYS.sync_events,
      form_submissions: parseInt(process.env.RETENTION_FORM_SUBMISSIONS_DAYS) || DEFAULT_RETENTION_DAYS.form_submissions,
      dead_letter_queue: parseInt(process.env.RETENTION_DEAD_LETTER_DAYS) || DEFAULT_RETENTION_DAYS.dead_letter_queue,
      sync_conflicts: parseInt(process.env.RETENTION_SYNC_CONFLICTS_DAYS) || DEFAULT_RETENTION_DAYS.sync_conflicts,
    };

    const results = {
      sync_events: 0,
      form_submissions: 0,
      dead_letter_queue: 0,
      sync_conflicts: 0,
    };

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays.sync_events);

      // Delete old sync events
      const { count: syncEventsCount } = await supabase
        .from('sync_events')
        .delete()
        .lt('created_at', cutoffDate.toISOString());
      results.sync_events = syncEventsCount || 0;

      cutoffDate.setDate(cutoffDate.getDate() - (retentionDays.form_submissions - retentionDays.sync_events));

      // Delete old form submissions
      const { count: formSubmissionsCount } = await supabase
        .from('form_submissions')
        .delete()
        .lt('submitted_at', cutoffDate.toISOString());
      results.form_submissions = formSubmissionsCount || 0;

      cutoffDate.setDate(cutoffDate.getDate() - (retentionDays.dead_letter_queue - retentionDays.form_submissions));

      // Delete old dead letter queue items
      const { count: deadLetterCount } = await supabase
        .from('dead_letter_queue')
        .delete()
        .lt('dead_lettered_at', cutoffDate.toISOString());
      results.dead_letter_queue = deadLetterCount || 0;

      cutoffDate.setDate(cutoffDate.getDate() - (retentionDays.sync_conflicts - retentionDays.dead_letter_queue));

      // Delete old sync conflicts
      const { count: syncConflictsCount } = await supabase
        .from('sync_conflicts')
        .delete()
        .lt('created_at', cutoffDate.toISOString());
      results.sync_conflicts = syncConflictsCount || 0;

      logger.info('gdpr', 'Data retention cleanup completed', { results });
      return { success: true, results };
    } catch (error) {
      logger.error('gdpr', 'Data retention cleanup failed', { error: error.message });
      throw new Error(`Failed to delete expired data: ${error.message}`);
    }
  },

  /**
   * Get data retention statistics
   */
  async getRetentionStats() {
    try {
      const stats = {};

      // Count records by age
      const retentionDays = {
        sync_events: parseInt(process.env.RETENTION_SYNC_EVENTS_DAYS) || DEFAULT_RETENTION_DAYS.sync_events,
        form_submissions: parseInt(process.env.RETENTION_FORM_SUBMISSIONS_DAYS) || DEFAULT_RETENTION_DAYS.form_submissions,
        dead_letter_queue: parseInt(process.env.RETENTION_DEAD_LETTER_DAYS) || DEFAULT_RETENTION_DAYS.dead_letter_queue,
        sync_conflicts: parseInt(process.env.RETENTION_SYNC_CONFLICTS_DAYS) || DEFAULT_RETENTION_DAYS.sync_conflicts,
      };

      // Sync events stats
      const { count: totalSyncEvents } = await supabase
        .from('sync_events')
        .select('*', { count: 'exact', head: true });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays.sync_events);
      const { count: expiredSyncEvents } = await supabase
        .from('sync_events')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', cutoffDate.toISOString());

      stats.sync_events = {
        total: totalSyncEvents || 0,
        expired: expiredSyncEvents || 0,
        retention_days: retentionDays.sync_events,
      };

      // Form submissions stats
      const { count: totalFormSubmissions } = await supabase
        .from('form_submissions')
        .select('*', { count: 'exact', head: true });

      cutoffDate.setDate(cutoffDate.getDate() - retentionDays.form_submissions);
      const { count: expiredFormSubmissions } = await supabase
        .from('form_submissions')
        .select('*', { count: 'exact', head: true })
        .lt('submitted_at', cutoffDate.toISOString());

      stats.form_submissions = {
        total: totalFormSubmissions || 0,
        expired: expiredFormSubmissions || 0,
        retention_days: retentionDays.form_submissions,
      };

      // Dead letter queue stats
      const { count: totalDeadLetter } = await supabase
        .from('dead_letter_queue')
        .select('*', { count: 'exact', head: true });

      cutoffDate.setDate(cutoffDate.getDate() - retentionDays.dead_letter_queue);
      const { count: expiredDeadLetter } = await supabase
        .from('dead_letter_queue')
        .select('*', { count: 'exact', head: true })
        .lt('dead_lettered_at', cutoffDate.toISOString());

      stats.dead_letter_queue = {
        total: totalDeadLetter || 0,
        expired: expiredDeadLetter || 0,
        retention_days: retentionDays.dead_letter_queue,
      };

      // Sync conflicts stats
      const { count: totalSyncConflicts } = await supabase
        .from('sync_conflicts')
        .select('*', { count: 'exact', head: true });

      cutoffDate.setDate(cutoffDate.getDate() - retentionDays.sync_conflicts);
      const { count: expiredSyncConflicts } = await supabase
        .from('sync_conflicts')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', cutoffDate.toISOString());

      stats.sync_conflicts = {
        total: totalSyncConflicts || 0,
        expired: expiredSyncConflicts || 0,
        retention_days: retentionDays.sync_conflicts,
      };

      return stats;
    } catch (error) {
      logger.error('gdpr', 'Failed to get retention stats', { error: error.message });
      throw new Error(`Failed to get retention stats: ${error.message}`);
    }
  },
};

export default gdprService;
