import React, { useState, useEffect, useCallback } from 'react';
import { useApi, useApiMutation } from '../hooks/useApi';

const DIRECTION_LABELS = {
  wix_to_hubspot: 'Wix \u2192 HubSpot',
  hubspot_to_wix: 'HubSpot \u2192 Wix',
  bidirectional: 'Bi-Directional',
};

const TRANSFORM_LABELS = {
  none: 'None',
  lowercase: 'Lowercase',
  uppercase: 'Uppercase',
  trim: 'Trim',
  format_phone: 'Format Phone',
  custom: 'Custom',
};

const DEFAULT_MAPPINGS = [
  { wix_field_key: 'email', wix_field_label: 'Email', hubspot_property_name: 'email', hubspot_property_label: 'Email', direction: 'bidirectional', transform_rule: 'none' },
  { wix_field_key: 'firstname', wix_field_label: 'First Name', hubspot_property_name: 'firstname', hubspot_property_label: 'First Name', direction: 'bidirectional', transform_rule: 'none' },
  { wix_field_key: 'lastname', wix_field_label: 'Last Name', hubspot_property_name: 'lastname', hubspot_property_label: 'Last Name', direction: 'bidirectional', transform_rule: 'none' },
  { wix_field_key: 'phone', wix_field_label: 'Phone', hubspot_property_name: 'phone', hubspot_property_label: 'Phone', direction: 'bidirectional', transform_rule: 'format_phone' },
  { wix_field_key: 'company', wix_field_label: 'Company', hubspot_property_name: 'company', hubspot_property_label: 'Company', direction: 'bidirectional', transform_rule: 'none' },
];

export default function FieldMappings() {
  const { data: mappings, loading, refetch } = useApi('/api/mappings');
  const { data: wixFields } = useApi('/api/mappings/wix-fields');
  const { data: hubspotProperties, loading: propsLoading } = useApi('/api/mappings/hubspot-properties');
  const { mutate } = useApiMutation();

  const [localMappings, setLocalMappings] = useState([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (mappings?.length) {
      setLocalMappings(mappings);
    } else if (mappings && mappings.length === 0) {
      setLocalMappings(DEFAULT_MAPPINGS.map((m, i) => ({ ...m, sort_order: i })));
      setDirty(true);
    }
  }, [mappings]);

  const updateField = (index, field, value) => {
    setLocalMappings(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setDirty(true);
  };

  const addMapping = () => {
    setLocalMappings(prev => [...prev, {
      wix_field_key: '', wix_field_label: '',
      hubspot_property_name: '', hubspot_property_label: '',
      direction: 'bidirectional', transform_rule: 'none',
      sort_order: prev.length,
    }]);
    setDirty(true);
  };

  const removeMapping = (index) => {
    setLocalMappings(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await mutate('/api/mappings/batch', 'POST', { mappings: localMappings });
      setDirty(false);
      refetch();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  if (loading) return <div className="fade-in"><p>Loading mappings...</p></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Field Mappings</h2>
        <p>Configure how contact fields map between Wix and HubSpot</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Contact Field Mappings</h3>
          <div className="actions-bar">
            <button className="btn btn-secondary btn-sm" onClick={addMapping}>Add Mapping</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!dirty}>
              {dirty ? 'Save Changes' : 'Saved'}
            </button>
          </div>
        </div>
        <div className="card-body">
          <div style={{ overflowX: 'auto' }}>
            <div className="mapping-row" style={{ borderBottom: '2px solid var(--neutral-200)', paddingBottom: '12px', marginBottom: '4px' }}>
              <strong style={{ fontSize: '12px', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Wix Field</strong>
              <span></span>
              <strong style={{ fontSize: '12px', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>HubSpot Property</strong>
              <strong style={{ fontSize: '12px', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Direction</strong>
              <strong style={{ fontSize: '12px', color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Transform</strong>
              <span></span>
            </div>

            {localMappings.map((mapping, i) => (
              <div className="mapping-row" key={i}>
                <select
                  value={mapping.wix_field_key}
                  onChange={e => {
                    const wixField = wixFields?.find(f => f.key === e.target.value);
                    updateField(i, 'wix_field_key', e.target.value);
                    if (wixField) updateField(i, 'wix_field_label', wixField.label);
                  }}
                >
                  <option value="">Select Wix Field</option>
                  {wixFields?.map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>

                <span className="arrow">&harr;</span>

                <select
                  value={mapping.hubspot_property_name}
                  onChange={e => {
                    const hsProp = hubspotProperties?.find(p => p.name === e.target.value);
                    updateField(i, 'hubspot_property_name', e.target.value);
                    if (hsProp) updateField(i, 'hubspot_property_label', hsProp.label);
                  }}
                  disabled={propsLoading}
                >
                  <option value="">Select HubSpot Property</option>
                  {hubspotProperties?.map(p => (
                    <option key={p.name} value={p.name}>{p.label} ({p.name})</option>
                  ))}
                </select>

                <select
                  value={mapping.direction}
                  onChange={e => updateField(i, 'direction', e.target.value)}
                >
                  {Object.entries(DIRECTION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>

                <select
                  value={mapping.transform_rule}
                  onChange={e => updateField(i, 'transform_rule', e.target.value)}
                >
                  {Object.entries(TRANSFORM_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>

                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => removeMapping(i)}
                  style={{ padding: '4px 8px' }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          {localMappings.length === 0 && (
            <div className="empty-state">
              <p>No field mappings configured. Click "Add Mapping" to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
