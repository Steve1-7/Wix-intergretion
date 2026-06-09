import React, { useState, useEffect } from 'react';
import { useApi, useApiMutation } from '../hooks/useApi';

export default function ConnectPage() {
  const { data: status, loading, refetch } = useApi('/api/oauth/status');
  const { mutate } = useApiMutation();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const result = await mutate('/api/oauth/connect');
      if (result.authUrl) {
        window.open(result.authUrl, '_blank', 'width=600,height=700');
      }
    } catch (err) {
      console.error('Connect failed:', err);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect HubSpot? This will stop all synchronization.')) return;
    try {
      await mutate('/api/oauth/disconnect', 'POST', {});
      refetch();
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      refetch();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (loading) return <div className="fade-in"><p>Loading...</p></div>;

  const isConnected = status?.is_connected;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>HubSpot Connection</h2>
        <p>Securely connect your HubSpot account using OAuth 2.0</p>
      </div>

      <div className="card">
        <div className="connection-card">
          <div className={`icon ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            )}
          </div>

          {isConnected ? (
            <>
              <h3>HubSpot is Connected</h3>
              <p>Your HubSpot account (Portal: {status.hubspot_portal_id || 'N/A'}) is securely connected. Tokens are stored server-side and auto-refreshed.</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <span className="badge badge-success">OAuth Active</span>
                <span className="badge badge-primary">Auto-Refresh Enabled</span>
              </div>
              <div style={{ marginTop: '24px' }}>
                <button className="btn btn-danger" onClick={handleDisconnect}>
                  Disconnect HubSpot
                </button>
              </div>
            </>
          ) : (
            <>
              <h3>Connect Your HubSpot Account</h3>
              <p>Authorize SyncBridge to access your HubSpot contacts, forms, and properties. Your credentials are stored securely and never exposed to the browser.</p>
              <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
                {connecting ? 'Opening HubSpot...' : 'Connect HubSpot'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h3>Security Details</h3>
        </div>
        <div className="card-body">
          <table>
            <tbody>
              <tr><td style={{ fontWeight: 500 }}>Authentication</td><td>OAuth 2.0 Authorization Code Flow</td></tr>
              <tr><td style={{ fontWeight: 500 }}>Token Storage</td><td>Server-side encrypted storage (never in browser)</td></tr>
              <tr><td style={{ fontWeight: 500 }}>Auto-Refresh</td><td>Access tokens are refreshed automatically before expiry</td></tr>
              <tr><td style={{ fontWeight: 500 }}>Scopes</td><td>crm.objects.contacts.read/write, crm.schemas.contacts.read, forms, oauth</td></tr>
              <tr><td style={{ fontWeight: 500 }}>Data Logging</td><td>Personal data and tokens are never logged (masked logging)</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
