import React from 'react';
import { useApi, useApiMutation } from '../hooks/useApi';

const STATUS_BADGE = {
  completed: 'badge-success',
  failed: 'badge-error',
  pending: 'badge-warning',
  processing: 'badge-primary',
  skipped: 'badge-neutral',
};

const SOURCE_LABEL = { wix: 'Wix', hubspot: 'HubSpot' };
const EVENT_LABEL = {
  contact_created: 'Contact Created',
  contact_updated: 'Contact Updated',
  contact_deleted: 'Contact Deleted',
  form_submitted: 'Form Submitted',
};

export default function SyncMonitor() {
  const { data: events, loading: eventsLoading, refetch: refetchEvents } = useApi('/api/sync/events?limit=50');
  const { data: stats, loading: statsLoading } = useApi('/api/sync/stats?hours=24');
  const { data: timeline } = useApi('/api/dashboard/sync-timeline?hours=24');
  const { mutate } = useApiMutation();

  const handleRetry = async () => {
    try {
      const result = await mutate('/api/sync/retry-failed', 'POST');
      alert(`Retried ${result.retried} failed events`);
      refetchEvents();
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  const maxTimelineValue = Math.max(
    ...(timeline || []).map(t => t.completed + t.failed) || [1],
    1
  );

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Sync Monitor</h2>
        <p>Monitor synchronization activity and troubleshoot issues</p>
      </div>

      {!statsLoading && stats && (
        <div className="stats-grid">
          <div className="stat-card success">
            <div className="label">Completed (24h)</div>
            <div className="value">{stats.completed}</div>
          </div>
          <div className="stat-card error">
            <div className="label">Failed (24h)</div>
            <div className="value">{stats.failed}</div>
          </div>
          <div className="stat-card warning">
            <div className="label">Pending</div>
            <div className="value">{stats.pending}</div>
          </div>
          <div className="stat-card">
            <div className="label">Dead Letters</div>
            <div className="value">{stats.deadLetters}</div>
          </div>
        </div>
      )}

      {timeline && timeline.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h3>Activity Timeline (Last 24h)</h3>
          </div>
          <div className="card-body">
            <div className="timeline-bar">
              {timeline.map((t, i) => {
                const completedH = (t.completed / maxTimelineValue) * 100;
                const failedH = (t.failed / maxTimelineValue) * 100;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    {t.completed > 0 && (
                      <div
                        className="bar completed"
                        style={{ height: `${Math.max(completedH, 4)}%` }}
                        data-tooltip={`${t.completed} completed`}
                      />
                    )}
                    {t.failed > 0 && (
                      <div
                        className="bar failed"
                        style={{ height: `${Math.max(failedH, 4)}%` }}
                        data-tooltip={`${t.failed} failed`}
                      />
                    )}
                    <span style={{ fontSize: '10px', color: 'var(--neutral-400)', marginTop: '4px' }}>
                      {t.hour.slice(11)}h
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px', fontSize: '12px', color: 'var(--neutral-500)' }}>
              <span><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '2px', background: 'var(--success-500)', marginRight: '4px', verticalAlign: 'middle' }}></span> Completed</span>
              <span><span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '2px', background: 'var(--error-500)', marginRight: '4px', verticalAlign: 'middle' }}></span> Failed</span>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Recent Sync Events</h3>
          <button className="btn btn-secondary btn-sm" onClick={handleRetry}>
            Retry Failed
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {eventsLoading ? (
            <div style={{ padding: '24px' }}>Loading...</div>
          ) : events?.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Event</th>
                  <th>Wix ID</th>
                  <th>HubSpot ID</th>
                  <th>Status</th>
                  <th>Retries</th>
                </tr>
              </thead>
              <tbody>
                {events.map(event => (
                  <tr key={event.id}>
                    <td style={{ fontSize: '12px', color: 'var(--neutral-500)' }}>
                      {new Date(event.created_at).toLocaleString()}
                    </td>
                    <td>{SOURCE_LABEL[event.source] || event.source}</td>
                    <td>{EVENT_LABEL[event.event_type] || event.event_type}</td>
                    <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                      {event.wix_contact_id?.slice(0, 8) || '-'}
                    </td>
                    <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                      {event.hubspot_contact_id?.slice(0, 8) || '-'}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[event.status] || 'badge-neutral'}`}>
                        {event.status}
                      </span>
                    </td>
                    <td>{event.retry_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>No sync events recorded yet. Events will appear here when contacts are synchronized.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
