import React from 'react';
import { useApi, useApiMutation } from '../hooks/useApi';

export default function FormsPage() {
  const { data: hubspotForms, loading: formsLoading } = useApi('/api/forms/hubspot');
  const { data: submissions, loading: subsLoading, refetch } = useApi('/api/forms/submissions?limit=50');
  const { mutate } = useApiMutation();

  const handleWixSubmission = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    try {
      await mutate('/api/forms/wix-submission', 'POST', data);
      alert('Form submission synced to HubSpot!');
      e.target.reset();
      refetch();
    } catch (err) {
      console.error('Submission failed:', err);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Forms & Leads</h2>
        <p>Capture leads from Wix and sync them to HubSpot with full attribution</p>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3>Simulate Wix Form Submission</h3>
        </div>
        <div className="card-body">
          <p style={{ fontSize: '13px', color: 'var(--neutral-500)', marginBottom: '16px' }}>
            This simulates a Wix form submission with UTM attribution. In production, submissions are captured automatically via Wix webhook events.
          </p>
          <form onSubmit={handleWixSubmission} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" name="email" required placeholder="lead@example.com" />
            </div>
            <div className="form-group">
              <label>First Name</label>
              <input type="text" name="firstname" placeholder="John" />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input type="text" name="lastname" placeholder="Doe" />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input type="text" name="phone" placeholder="+1 555-0123" />
            </div>
            <div className="form-group">
              <label>UTM Source</label>
              <input type="text" name="utm_source" placeholder="google" />
            </div>
            <div className="form-group">
              <label>UTM Medium</label>
              <input type="text" name="utm_medium" placeholder="cpc" />
            </div>
            <div className="form-group">
              <label>UTM Campaign</label>
              <input type="text" name="utm_campaign" placeholder="spring_sale" />
            </div>
            <div className="form-group">
              <label>Page URL</label>
              <input type="text" name="page_url" placeholder="/contact" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary">Submit & Sync to HubSpot</button>
            </div>
          </form>
        </div>
      </div>

      {!formsLoading && hubspotForms && hubspotForms.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h3>HubSpot Forms</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Form Name</th>
                  <th>Portal ID</th>
                  <th>Fields</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {hubspotForms.map(form => (
                  <tr key={form.guid}>
                    <td>{form.name}</td>
                    <td>{form.portalId}</td>
                    <td>{form.fields?.length || 0} fields</td>
                    <td style={{ fontSize: '12px' }}>{form.createdAt ? new Date(form.createdAt).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Submission History</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {subsLoading ? (
            <div style={{ padding: '24px' }}>Loading...</div>
          ) : submissions?.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Form</th>
                  <th>HubSpot Contact</th>
                  <th>UTM Source</th>
                  <th>UTM Campaign</th>
                  <th>Synced</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => (
                  <tr key={sub.id}>
                    <td style={{ fontSize: '12px' }}>{new Date(sub.submitted_at).toLocaleString()}</td>
                    <td>{sub.form_id?.slice(0, 8) || '-'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{sub.hubspot_contact_id?.slice(0, 8) || '-'}</td>
                    <td>{sub.utm_source || '-'}</td>
                    <td>{sub.utm_campaign || '-'}</td>
                    <td>
                      <span className={`badge ${sub.synced_to_hubspot ? 'badge-success' : 'badge-warning'}`}>
                        {sub.synced_to_hubspot ? 'Synced' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>No form submissions recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
