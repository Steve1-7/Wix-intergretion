-- Integration settings table (stores OAuth tokens per Wix site)
CREATE TABLE IF NOT EXISTS integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_site_id TEXT NOT NULL,
  hubspot_portal_id TEXT,
  hubspot_account_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  connected_at TIMESTAMPTZ DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  is_connected BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contact ID mapping (prevents duplicates, enables loop detection)
CREATE TABLE IF NOT EXISTS contact_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_site_id TEXT NOT NULL,
  wix_contact_id TEXT NOT NULL,
  hubspot_contact_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  last_sync_source TEXT CHECK (last_sync_source IN ('wix', 'hubspot')),
  last_wix_updated_at TIMESTAMPTZ,
  last_hubspot_updated_at TIMESTAMPTZ,
  sync_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(wix_site_id, wix_contact_id),
  UNIQUE(wix_site_id, hubspot_contact_id)
);

-- Field mapping configuration
CREATE TABLE IF NOT EXISTS field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_site_id TEXT NOT NULL,
  wix_field_key TEXT NOT NULL,
  wix_field_label TEXT NOT NULL,
  hubspot_property_name TEXT NOT NULL,
  hubspot_property_label TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('wix_to_hubspot', 'hubspot_to_wix', 'bidirectional')),
  transform_rule TEXT CHECK (transform_rule IN ('none', 'lowercase', 'uppercase', 'trim', 'format_phone', 'custom')),
  custom_transform TEXT,
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(wix_site_id, wix_field_key, hubspot_property_name)
);

-- Sync event log (audit trail + deduplication)
CREATE TABLE IF NOT EXISTS sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_site_id TEXT NOT NULL,
  sync_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('wix', 'hubspot')),
  event_type TEXT NOT NULL CHECK (event_type IN ('contact_created', 'contact_updated', 'contact_deleted', 'form_submitted')),
  wix_contact_id TEXT,
  hubspot_contact_id TEXT,
  payload JSONB DEFAULT '{}',
  correlation_id TEXT,
  processed_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dead letter queue for permanently failed syncs
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_site_id TEXT NOT NULL,
  original_event_id UUID REFERENCES sync_events(id),
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  error_message TEXT NOT NULL,
  retry_count INTEGER NOT NULL,
  dead_lettered_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT
);

-- Form submission tracking
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_site_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  submission_id TEXT,
  hubspot_contact_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  page_url TEXT,
  referrer TEXT,
  landing_page TEXT,
  session_id TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  synced_to_hubspot BOOLEAN DEFAULT false,
  hubspot_sync_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sync conflict log
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_site_id TEXT NOT NULL,
  wix_contact_id TEXT NOT NULL,
  hubspot_contact_id TEXT NOT NULL,
  conflict_field TEXT NOT NULL,
  wix_value TEXT,
  hubspot_value TEXT,
  resolution_strategy TEXT NOT NULL CHECK (resolution_strategy IN ('wix_wins', 'hubspot_wins', 'last_updated_wins', 'manual')),
  resolved_value TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Global sync settings per site
CREATE TABLE IF NOT EXISTS sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_site_id TEXT NOT NULL UNIQUE,
  conflict_resolution_strategy TEXT NOT NULL DEFAULT 'last_updated_wins' CHECK (conflict_resolution_strategy IN ('wix_wins', 'hubspot_wins', 'last_updated_wins')),
  sync_enabled BOOLEAN DEFAULT true,
  wix_to_hubspot_enabled BOOLEAN DEFAULT true,
  hubspot_to_wix_enabled BOOLEAN DEFAULT true,
  deduplication_window_seconds INTEGER DEFAULT 300,
  max_concurrent_syncs INTEGER DEFAULT 10,
  retry_delay_seconds INTEGER DEFAULT 60,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated users can manage their site's data
-- Integration settings
CREATE POLICY "select_integration_settings" ON integration_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_integration_settings" ON integration_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_integration_settings" ON integration_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_integration_settings" ON integration_settings FOR DELETE TO authenticated USING (true);

-- Contact mappings
CREATE POLICY "select_contact_mappings" ON contact_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_contact_mappings" ON contact_mappings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_contact_mappings" ON contact_mappings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_contact_mappings" ON contact_mappings FOR DELETE TO authenticated USING (true);

-- Field mappings
CREATE POLICY "select_field_mappings" ON field_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_field_mappings" ON field_mappings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_field_mappings" ON field_mappings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_field_mappings" ON field_mappings FOR DELETE TO authenticated USING (true);

-- Sync events
CREATE POLICY "select_sync_events" ON sync_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sync_events" ON sync_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sync_events" ON sync_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sync_events" ON sync_events FOR DELETE TO authenticated USING (true);

-- Dead letter queue
CREATE POLICY "select_dead_letter_queue" ON dead_letter_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_dead_letter_queue" ON dead_letter_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_dead_letter_queue" ON dead_letter_queue FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_dead_letter_queue" ON dead_letter_queue FOR DELETE TO authenticated USING (true);

-- Form submissions
CREATE POLICY "select_form_submissions" ON form_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_form_submissions" ON form_submissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_form_submissions" ON form_submissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_form_submissions" ON form_submissions FOR DELETE TO authenticated USING (true);

-- Sync conflicts
CREATE POLICY "select_sync_conflicts" ON sync_conflicts FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sync_conflicts" ON sync_conflicts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sync_conflicts" ON sync_conflicts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sync_conflicts" ON sync_conflicts FOR DELETE TO authenticated USING (true);

-- Sync settings
CREATE POLICY "select_sync_settings" ON sync_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sync_settings" ON sync_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sync_settings" ON sync_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sync_settings" ON sync_settings FOR DELETE TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX idx_contact_mappings_wix ON contact_mappings(wix_site_id, wix_contact_id);
CREATE INDEX idx_contact_mappings_hubspot ON contact_mappings(wix_site_id, hubspot_contact_id);
CREATE INDEX idx_sync_events_site ON sync_events(wix_site_id, created_at DESC);
CREATE INDEX idx_sync_events_status ON sync_events(wix_site_id, status);
CREATE INDEX idx_sync_events_correlation ON sync_events(correlation_id);
CREATE INDEX idx_sync_events_dedup ON sync_events(wix_site_id, source, event_type, wix_contact_id, hubspot_contact_id, created_at);
CREATE INDEX idx_form_submissions_site ON form_submissions(wix_site_id, submitted_at DESC);
CREATE INDEX idx_dead_letter_queue_site ON dead_letter_queue(wix_site_id, dead_lettered_at DESC);
