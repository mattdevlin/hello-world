import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import { FONT_STACK, BRAND, NEUTRAL, RADIUS } from '../utils/designTokens.js';

export default function AdminPage() {
  const navigate = useNavigate();
  const [pricing, setPricing] = useState([]);
  const [margins, setMargins] = useState([]);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [p, m, s] = await Promise.all([
        api.get('/pricing'),
        api.get('/margins'),
        api.get('/settings'),
      ]);
      setPricing(p);
      setMargins(m);
      setSettings(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updatePricing(category, unitCost) {
    setSaving(`pricing-${category}`);
    try {
      const updated = await api.put(`/pricing/${category}`, { unit_cost: unitCost });
      setPricing(prev => prev.map(p => p.category === category ? updated : p));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  async function updateMargin(key, value) {
    setSaving(`margin-${key}`);
    try {
      const updated = await api.put(`/margins/${key}`, { value });
      setMargins(prev => prev.map(m => m.key === key ? updated : m));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  async function updateSetting(key, value) {
    setSaving(`setting-${key}`);
    try {
      const updated = await api.put(`/settings/${key}`, { value });
      setSettings(prev => prev.map(s => s.key === key ? updated : s));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  function getSetting(key) {
    return settings.find(s => s.key === key)?.value || '';
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <p style={styles.loadingText}>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Admin Settings</h1>
            <p style={styles.subtitle}>Manage pricing, margins, and company details</p>
          </div>
          <button onClick={() => navigate('/')} style={styles.backBtn}>Back to Projects</button>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            {error}
            <button onClick={() => setError(null)} style={styles.dismissBtn}>Dismiss</button>
          </div>
        )}

        {/* Unit Pricing */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Unit Pricing</h2>
          <p style={styles.sectionHint}>Cost per unit before markup</p>
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span style={styles.colCategory}>Material</span>
              <span style={styles.colUnit}>Unit</span>
              <span style={styles.colCost}>Unit Cost ($)</span>
              <span style={styles.colAction}></span>
            </div>
            {pricing.map(p => (
              <PricingRow
                key={p.category}
                item={p}
                saving={saving === `pricing-${p.category}`}
                onSave={(cost) => updatePricing(p.category, cost)}
              />
            ))}
          </div>
        </section>

        {/* Margins */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Margins & Overhead</h2>
          <p style={styles.sectionHint}>Markup applied to each category, plus global overhead</p>
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span style={styles.colCategory}>Margin</span>
              <span style={styles.colUnit}>Current</span>
              <span style={styles.colCost}>Value (%)</span>
              <span style={styles.colAction}></span>
            </div>
            {margins.map(m => (
              <MarginRow
                key={m.key}
                item={m}
                saving={saving === `margin-${m.key}`}
                onSave={(val) => updateMargin(m.key, val)}
              />
            ))}
          </div>
        </section>

        {/* Company Info */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Company Details</h2>
          <p style={styles.sectionHint}>Shown on PDF quotes</p>
          <div style={styles.fieldGroup}>
            <SettingField
              label="Company Name"
              value={getSetting('company_name')}
              saving={saving === 'setting-company_name'}
              onSave={(val) => updateSetting('company_name', val)}
            />
            <SettingField
              label="Phone"
              value={getSetting('company_phone')}
              saving={saving === 'setting-company_phone'}
              onSave={(val) => updateSetting('company_phone', val)}
            />
            <SettingField
              label="Email"
              value={getSetting('company_email')}
              saving={saving === 'setting-company_email'}
              onSave={(val) => updateSetting('company_email', val)}
            />
          </div>
        </section>

        {/* Quote Defaults */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Quote Defaults</h2>
          <div style={styles.fieldGroup}>
            <SettingField
              label="Default Validity (days)"
              value={getSetting('default_validity_days')}
              saving={saving === 'setting-default_validity_days'}
              onSave={(val) => updateSetting('default_validity_days', val)}
              type="number"
            />
            <SettingField
              label="GST Rate"
              value={getSetting('gst_rate')}
              saving={saving === 'setting-gst_rate'}
              onSave={(val) => updateSetting('gst_rate', val)}
              type="number"
              hint="e.g. 0.15 for 15%"
            />
          </div>
        </section>

        {/* Terms & Conditions */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Terms & Conditions</h2>
          <p style={styles.sectionHint}>Printed on PDF quotes</p>
          <TermsEditor
            value={getSetting('terms_and_conditions')}
            saving={saving === 'setting-terms_and_conditions'}
            onSave={(val) => updateSetting('terms_and_conditions', val)}
          />
        </section>
      </div>
    </div>
  );
}

function PricingRow({ item, saving, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(item.unit_cost));

  function handleSave() {
    const num = parseFloat(draft);
    if (isNaN(num) || num < 0) return;
    onSave(num);
    setEditing(false);
  }

  const label = item.category.charAt(0).toUpperCase() + item.category.slice(1);

  return (
    <div style={styles.tableRow}>
      <span style={styles.colCategory}>
        <strong style={styles.rowLabel}>{label}</strong>
        {item.description && <span style={styles.rowDesc}>{item.description}</span>}
      </span>
      <span style={styles.colUnit}>{item.unit}</span>
      <span style={styles.colCost}>
        {editing ? (
          <input
            type="number"
            step="0.01"
            min="0"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            onBlur={handleSave}
            style={styles.inlineInput}
            autoFocus
          />
        ) : (
          <span>${Number(item.unit_cost).toFixed(2)}</span>
        )}
      </span>
      <span style={styles.colAction}>
        {!editing && (
          <button
            onClick={() => { setDraft(String(item.unit_cost)); setEditing(true); }}
            style={styles.editBtn}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Edit'}
          </button>
        )}
      </span>
    </div>
  );
}

function MarginRow({ item, saving, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String((item.value * 100).toFixed(1)));

  function handleSave() {
    const pct = parseFloat(draft);
    if (isNaN(pct)) return;
    onSave(pct / 100);
    setEditing(false);
  }

  return (
    <div style={styles.tableRow}>
      <span style={styles.colCategory}>
        <strong style={styles.rowLabel}>{item.label || item.key}</strong>
      </span>
      <span style={styles.colUnit}>{(item.value * 100).toFixed(1)}%</span>
      <span style={styles.colCost}>
        {editing ? (
          <input
            type="number"
            step="0.1"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            onBlur={handleSave}
            style={styles.inlineInput}
            autoFocus
          />
        ) : null}
      </span>
      <span style={styles.colAction}>
        {!editing && (
          <button
            onClick={() => { setDraft(String((item.value * 100).toFixed(1))); setEditing(true); }}
            style={styles.editBtn}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Edit'}
          </button>
        )}
      </span>
    </div>
  );
}

function SettingField({ label, value, saving, onSave, type = 'text', hint }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  function handleSave() {
    onSave(draft);
    setEditing(false);
  }

  return (
    <div style={styles.fieldRow}>
      <label style={styles.fieldLabel}>{label}</label>
      {hint && <span style={styles.fieldHint}>{hint}</span>}
      {editing ? (
        <div style={styles.fieldEditRow}>
          <input
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            style={styles.fieldInput}
            autoFocus
          />
          <button onClick={handleSave} style={styles.saveBtn} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => { setDraft(value); setEditing(false); }} style={styles.cancelBtn}>
            Cancel
          </button>
        </div>
      ) : (
        <div style={styles.fieldEditRow}>
          <span style={styles.fieldValue}>{value || '(not set)'}</span>
          <button onClick={() => setEditing(true)} style={styles.editBtn}>Edit</button>
        </div>
      )}
    </div>
  );
}

function TermsEditor({ value, saving, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  function handleSave() {
    onSave(draft);
    setEditing(false);
  }

  return (
    <div>
      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={styles.termsTextarea}
            rows={10}
          />
          <div style={styles.termsActions}>
            <button onClick={handleSave} style={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setDraft(value); setEditing(false); }} style={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <pre style={styles.termsPreview}>{value || '(no terms set)'}</pre>
          <button onClick={() => setEditing(true)} style={styles.editBtn}>Edit</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: NEUTRAL.background,
    fontFamily: FONT_STACK,
  },
  container: {
    maxWidth: 860,
    margin: '0 auto',
    padding: '0 24px 60px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '40px 0 32px',
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: NEUTRAL.text,
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 14,
    color: NEUTRAL.textMuted,
  },
  backBtn: {
    padding: '8px 16px',
    background: NEUTRAL.surface,
    color: NEUTRAL.textSecondary,
    border: `1px solid ${NEUTRAL.border}`,
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  loadingText: {
    textAlign: 'center',
    padding: 60,
    color: NEUTRAL.textMuted,
    fontSize: 14,
  },
  errorBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#fff5f5',
    color: BRAND.danger,
    border: `1px solid #fdd`,
    borderRadius: RADIUS.md,
    marginBottom: 20,
    fontSize: 14,
  },
  dismissBtn: {
    padding: '4px 12px',
    background: 'transparent',
    color: BRAND.danger,
    border: `1px solid ${BRAND.danger}`,
    borderRadius: RADIUS.sm,
    cursor: 'pointer',
    fontSize: 12,
  },

  // Sections
  section: {
    marginBottom: 32,
    background: NEUTRAL.surface,
    borderRadius: RADIUS.lg,
    border: `1px solid ${NEUTRAL.border}`,
    padding: '24px',
  },
  sectionTitle: {
    margin: '0 0 4px',
    fontSize: 18,
    fontWeight: 600,
    color: NEUTRAL.text,
  },
  sectionHint: {
    margin: '0 0 16px',
    fontSize: 13,
    color: NEUTRAL.textMuted,
  },

  // Table
  table: {
    width: '100%',
  },
  tableHeader: {
    display: 'flex',
    padding: '8px 0',
    borderBottom: `2px solid ${NEUTRAL.border}`,
    fontSize: 12,
    fontWeight: 600,
    color: NEUTRAL.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: `1px solid ${NEUTRAL.borderLight}`,
  },
  colCategory: {
    flex: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  colUnit: { flex: 1, color: NEUTRAL.textSecondary, fontSize: 14 },
  colCost: { flex: 1, fontSize: 14 },
  colAction: { width: 80, textAlign: 'right' },
  rowLabel: { fontSize: 14, color: NEUTRAL.text },
  rowDesc: { fontSize: 12, color: NEUTRAL.textMuted },
  inlineInput: {
    width: 100,
    padding: '4px 8px',
    fontSize: 14,
    border: `1px solid ${BRAND.primary}`,
    borderRadius: RADIUS.sm,
    outline: 'none',
  },

  // Buttons
  editBtn: {
    padding: '4px 12px',
    background: '#f5f6f8',
    color: NEUTRAL.textSecondary,
    border: `1px solid ${NEUTRAL.border}`,
    borderRadius: RADIUS.sm,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  },
  saveBtn: {
    padding: '6px 16px',
    background: BRAND.primary,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.sm,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  cancelBtn: {
    padding: '6px 16px',
    background: NEUTRAL.surface,
    color: NEUTRAL.textSecondary,
    border: `1px solid ${NEUTRAL.border}`,
    borderRadius: RADIUS.sm,
    cursor: 'pointer',
    fontSize: 13,
  },

  // Fields
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  fieldRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: NEUTRAL.text,
  },
  fieldHint: {
    fontSize: 12,
    color: NEUTRAL.textMuted,
  },
  fieldEditRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  fieldInput: {
    flex: 1,
    maxWidth: 300,
    padding: '6px 10px',
    fontSize: 14,
    border: `1px solid ${NEUTRAL.inputBorder}`,
    borderRadius: RADIUS.sm,
    outline: 'none',
  },
  fieldValue: {
    fontSize: 14,
    color: NEUTRAL.text,
  },

  // Terms
  termsTextarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    fontFamily: FONT_STACK,
    border: `1px solid ${NEUTRAL.inputBorder}`,
    borderRadius: RADIUS.sm,
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.5,
    boxSizing: 'border-box',
  },
  termsActions: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
  },
  termsPreview: {
    margin: '0 0 12px',
    padding: '12px 14px',
    background: '#f8f9fa',
    borderRadius: RADIUS.sm,
    fontSize: 13,
    lineHeight: 1.6,
    color: NEUTRAL.textSecondary,
    whiteSpace: 'pre-wrap',
    fontFamily: FONT_STACK,
    border: `1px solid ${NEUTRAL.borderLight}`,
  },
};
