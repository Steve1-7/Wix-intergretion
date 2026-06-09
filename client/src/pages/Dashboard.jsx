import React from 'react';
import { useApi } from '../hooks/useApi';
import { NavLink } from 'react-router-dom';

export default function Dashboard() {
  const { data, loading, error } = useApi('/api/dashboard/overview');

  if (loading) return <div className="fade-in"><p>Loading dashboard...</p></div>;
  if (error) return <div className="fade-in"><p>Failed to load dashboard: {error}</p></div>;
  if (!data) return null;

  const { connection, syncStats, activeMappings, syncedContacts, unresolvedDeadLetters } = data;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of your Wix & HubSpot integration</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="label">Synced Contacts</div>
          <div className="value">{syncedContacts}</div>
        </div>
        <div className="stat-card success">
          <div className="label">Successful Syncs ({syncStats.period})</div>
          <div className="value">{syncStats.completed}</div>
        </div>
        <div className="stat-card error">
          <div className="label">Failed Syncs</div>
          <div className="value">{syncStats.failed}</div>
        </div>
        <div className="stat-card warning">
          <div className="label">Dead Letters</div>
          <div className="value">{unresolvedDeadLetters}</div>
        </div>
        <div className="stat-card">
          <div className="label">Active Mappings</div>
          <div className="value">{activeMappings}</div>
        </div>
        <div className="stat-card">
          <div className="label">HubSpot Connection</div>
          <div className="value">
            <span className={`badge ${connection.is_connected ? 'badge-success' : 'badge-neutral'}`}>
              {connection.is_connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Quick Actions</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {!connection.is_connected && (
              <NavLink to="/connect" className="btn btn-primary">
                Connect HubSpot
              </NavLink>
            )}
            <NavLink to="/mappings" className="btn btn-secondary">
              Configure Mappings
            </NavLink>
            <NavLink to="/sync" className="btn btn-secondary">
              View Sync Logs
            </NavLink>
            {unresolvedDeadLetters > 0 && (
              <NavLink to="/settings" className="btn btn-danger">
                Review Dead Letters ({unresolvedDeadLetters})
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
