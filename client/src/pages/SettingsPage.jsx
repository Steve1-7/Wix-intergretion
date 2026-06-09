import React, { useState, useEffect } from 'react';
import { useApi, useApiMutation } from '../hooks/useApi';

export default function SettingsPage() {
  const { data: settings, loading, refetch } = useApi('/api/settings');
  const { data: deadLetters } = useApi('/api/settings/dead-letter');
  const { mutate } = useApiMutation();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (settings) {
      setForm({
        conflict_resolution_strategy: settings.conflict_resolution_strategy || 'last_updated_wins',
        sync_enabled: settings.sync_enabled ?? true,
        wix_to_hubspot_enabled: settings.wix_to_hubspot_enabled ?? true,
        hubspot_to_wix_enabled: settings.hubspot_to_wix_enabled ?? true,
        deduplication_window_seconds: settings.deduplication_window_seconds || 300,
        max_concurrent_syncs: settings.max_concurrent_syncs || 10,
        retry_delay_seconds: settings.retry_delay_seconds || 60,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await mutate('/api/settings', 'PUT', form);
      refetch();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleResolveDeadLetter = async (id) => {
    try {
      await mutate(`/api/settings/dead-letter/${id}/resolve`, 'PUT', { resolutionNote: 'Resolved manually' });
      refetch();
    } catch (err) {
      console.error('Resolve failed:', err);
    }
  };

  if (loading || !form) return <div className="fade-in"><p>Loading settings...</p></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Settings</h2>
        <p>Configure sync behavior, conflict resolution, and manage error queues</p>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3>Sync Configuration</h3>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>Save Settings</button>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="form-group">
              <label>Conflict Resolution Strategy</label>
              <select
                value={form.conflict_resolution_strategy}
                onChange={e => setForm({ ...form, conflict_resolution_strategy: e.target.value })}
              >
                <option value="last_updated_wins">Last Updated Wins</option>
                <option value="wix_wins">Wix Wins</option>
                <option value="hubspot_wins">HubSpot Wins</option>
              </select>
            </div>

            <div className="form-group">
              <label>Deduplication Window (seconds)</label>
              <input
                type="text"
                value={form.deduplication_window_seconds}
                onChange={e => setForm({ ...form, deduplication_window_seconds: parseInt(e.target.value) || 300 })}
              />
            </div>

            <div className="form-group">
              <label>Max Concurrent Syncs</label>
              <input
                type="text"
                value={form.max_concurrent_syncs}
                onChange={e => setForm({ ...form, max_concurrent_syncs: parseInt(e.target.value) || 10 })}
              />
            </div>

            <div className="form-group">
              <label>Retry Delay (seconds)</label>
              <input
                type="text"
                value={form.retry_delay_seconds}
                onChange={e => setForm({ ...form, retry_delay_seconds: parseInt(e.target.value) || 60 })}
              />
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                className={`toggle ${form.sync_enabled ? 'active' : ''}`}
                onClick={() => setForm({ ...form, sync_enabled: !form.sync_enabled })}
              />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Sync Enabled</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                className={`toggle ${form.wix_to_hubspot_enabled ? 'active' : ''}`}
                onClick={() => setForm({ ...form, wix_to_hubspot_enabled: !form.wix_to_hubspot_enabled })}
              />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Wix to HubSpot</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                className={`toggle ${form.hubspot_to_wix_enabled ? 'active' : ''}`}
                onClick={() => setForm({ ...form, hubspot_to_wix_enabled: !form.hubspot_to_wix_enabled })}
              />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>HubSpot to Wix</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Dead Letter Queue</h3>
          <span className="badge badge-neutral">{deadLetters?.length || 0} items</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {deadLetters?.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Event Type</th>
                  <th>Error</th>
                  <th>Retries</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {deadLetters.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontSize: '12px' }}>{new Date(item.dead_lettered_at).toLocaleString()}</td>
                    <td>{item.source}</td>
                    <td>{item.event_type}</td>
                    <td style={{ fontSize: '12px', color: 'var(--error-600)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.error_message}
                    </td>
                    <td>{item.retry_count}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleResolveDeadLetter(item.id)}>
                        Resolve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>No items in the dead letter queue.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
