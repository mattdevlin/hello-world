import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import { FONT_STACK, BRAND, NEUTRAL, RADIUS } from '../utils/designTokens.js';

// ── Shared helpers ──────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <div style={sectionStyles.card}>
      <h2 style={sectionStyles.title}>{title}</h2>
      {children}
    </div>
  );
}

function SaveButton({ dirty, saving, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={!dirty || saving}
      style={{
        ...sectionStyles.saveBtn,
        opacity: (!dirty || saving) ? 0.5 : 1,
        cursor: (!dirty || saving) ? 'default' : 'pointer',
      }}
    >
      {saving ? 'Saving...' : 'Save'}
    </button>
  );
}

function Feedback({ success, error }) {
  if (success) return <span style={sectionStyles.success}>{success}</span>;
  if (error) return <span style={sectionStyles.error}>{error}</span>;
  return null;
}

function SaveRow({ dirty, saving, success, error, onSave }) {
  return (
    <div style={sectionStyles.saveRow}>
      <SaveButton dirty={dirty} saving={saving} onClick={onSave} />
      <Feedback success={success} error={error} />
    </div>
  );
}

// ── PricingSection ──────────────────────────────────────────────

function PricingSection({ data, onDataChange }) {
  const [draft, setDraft] = useState([]);
  const [saved, setSaved] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (data) {
      setDraft(data.map(r => ({ ...r })));
      setSaved(data.map(r => ({ ...r })));
    }
  }, [data]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const updateRow = (i, field, value) => {
    setDraft(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const changed = draft.filter((row, i) =>
        row.unit_cost !== saved[i]?.unit_cost || row.description !== saved[i]?.description
      );
      for (const row of changed) {
        await api.put(`/pricing/${row.category}`, {
          unit_cost: Number(row.unit_cost),
          description: row.description,
        });
      }
      setSaved(draft.map(r => ({ ...r })));
      if (onDataChange) onDataChange();
      setSuccess('Saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Unit Pricing">
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.th}>Category</th>
              <th style={tableStyles.th}>Unit</th>
              <th style={tableStyles.th}>Unit Cost ($)</th>
              <th style={tableStyles.th}>Description</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((row, i) => (
              <tr key={row.category} style={i % 2 === 1 ? { background: '#fafafa' } : undefined}>
                <td style={tableStyles.td}>{row.category}</td>
                <td style={tableStyles.td}>{row.unit}</td>
                <td style={tableStyles.td}>
                  <input
                    type="number"
                    step="0.01"
                    value={row.unit_cost}
                    onChange={e => updateRow(i, 'unit_cost', e.target.value)}
                    style={tableStyles.input}
                    aria-label={`Unit cost for ${row.category}`}
                  />
                </td>
                <td style={tableStyles.td}>
                  <input
                    type="text"
                    value={row.description || ''}
                    onChange={e => updateRow(i, 'description', e.target.value)}
                    style={{ ...tableStyles.input, width: '100%' }}
                    aria-label={`Description for ${row.category}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveRow dirty={dirty} saving={saving} success={success} error={error} onSave={handleSave} />
    </SectionCard>
  );
}

// ── MarginsSection ──────────────────────────────────────────────

function MarginsSection({ data, onDataChange }) {
  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (data) {
      // data may be an array of {key, value, label} rows from the API — convert to object keyed by key
      const rows = Array.isArray(data) ? data : Object.values(data);
      const asPercent = {};
      for (const row of rows) {
        asPercent[row.key] = { ...row, value: (Number(row.value) * 100).toFixed(2) };
      }
      setDraft(JSON.parse(JSON.stringify(asPercent)));
      setSaved(JSON.parse(JSON.stringify(asPercent)));
    }
  }, [data]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const updateValue = (key, value) => {
    setDraft(prev => ({ ...prev, [key]: { ...prev[key], value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const changedKeys = Object.keys(draft).filter(k => draft[k].value !== saved[k]?.value);
      for (const key of changedKeys) {
        await api.put(`/margins/${key}`, { value: Number(draft[key].value) / 100 });
      }
      setSaved(JSON.parse(JSON.stringify(draft)));
      if (onDataChange) onDataChange();
      setSuccess('Saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Margins &amp; Markups">
      <div style={sectionStyles.fieldGroup}>
        {Object.entries(draft).map(([key, item]) => (
          <div key={key} style={sectionStyles.fieldRow}>
            <label style={sectionStyles.label} htmlFor={`margin-${key}`}>{item.label || key}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                id={`margin-${key}`}
                type="number"
                step="0.01"
                value={item.value}
                onChange={e => updateValue(key, e.target.value)}
                style={{ ...tableStyles.input, width: 100 }}
              />
              <span style={sectionStyles.suffix}>%</span>
            </div>
          </div>
        ))}
      </div>
      <SaveRow dirty={dirty} saving={saving} success={success} error={error} onSave={handleSave} />
    </SectionCard>
  );
}

// ── CompanySection ──────────────────────────────────────────────

const COMPANY_FIELDS = [
  { key: 'company_name', label: 'Company Name', type: 'text' },
  { key: 'company_phone', label: 'Phone', type: 'tel' },
  { key: 'company_email', label: 'Email', type: 'email' },
  { key: 'default_validity_days', label: 'Default Validity (days)', type: 'number' },
  { key: 'gst_rate', label: 'GST Rate', type: 'number', suffix: '%', isPercent: true },
];

function CompanySection({ data, onDataChange }) {
  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (data) {
      const mapped = {};
      for (const f of COMPANY_FIELDS) {
        const val = data[f.key];
        mapped[f.key] = f.isPercent ? (Number(val) * 100).toFixed(2) : (val ?? '');
      }
      setDraft({ ...mapped });
      setSaved({ ...mapped });
    }
  }, [data]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const updateField = (key, value) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const changedKeys = COMPANY_FIELDS.filter(f => draft[f.key] !== saved[f.key]);
      for (const f of changedKeys) {
        let value = draft[f.key];
        if (f.isPercent) value = Number(value) / 100;
        else if (f.type === 'number') value = Number(value);
        await api.put(`/settings/${f.key}`, { value });
      }
      setSaved({ ...draft });
      if (onDataChange) onDataChange();
      setSuccess('Saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Company Settings">
      <div style={sectionStyles.fieldGroup}>
        {COMPANY_FIELDS.map(f => (
          <div key={f.key} style={sectionStyles.fieldRow}>
            <label style={sectionStyles.label} htmlFor={`company-${f.key}`}>{f.label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                id={`company-${f.key}`}
                type={f.type}
                value={draft[f.key] ?? ''}
                onChange={e => updateField(f.key, e.target.value)}
                style={{ ...tableStyles.input, width: f.type === 'number' ? 100 : 250 }}
              />
              {f.suffix && <span style={sectionStyles.suffix}>{f.suffix}</span>}
            </div>
          </div>
        ))}
      </div>
      <SaveRow dirty={dirty} saving={saving} success={success} error={error} onSave={handleSave} />
    </SectionCard>
  );
}

// ── TermsSection ────────────────────────────────────────────────

function TermsSection({ data, onDataChange }) {
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (data != null) {
      const val = data.terms_and_conditions ?? '';
      setDraft(val);
      setSaved(val);
    }
  }, [data]);

  const dirty = draft !== saved;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/settings/terms_and_conditions', { value: draft });
      setSaved(draft);
      if (onDataChange) onDataChange();
      setSuccess('Saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Terms &amp; Conditions">
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        style={sectionStyles.textarea}
        aria-label="Terms and conditions"
      />
      <SaveRow dirty={dirty} saving={saving} success={success} error={error} onSave={handleSave} />
    </SectionCard>
  );
}

// ── AdminPage (main) ────────────────────────────────────────────

export default function AdminPage() {
  const navigate = useNavigate();
  const [pricing, setPricing] = useState(null);
  const [margins, setMargins] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [p, m, s] = await Promise.all([
        api.get('/pricing'),
        api.get('/margins'),
        api.get('/settings'),
      ]);
      setPricing(p);
      setMargins(m);
      setSettings(s);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.container}>
        {/* Header */}
        <nav style={pageStyles.header} aria-label="Breadcrumb">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/')} style={pageStyles.backBtn} aria-label="Back to projects">&larr; Projects</button>
            <h1 style={pageStyles.title}>Admin</h1>
          </div>
        </nav>

        {/* Error banner */}
        {loadError && (
          <div style={pageStyles.errorBanner}>
            <span>Could not connect to server.</span>
            <button onClick={loadData} style={pageStyles.retryBtn}>Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading && !loadError && (
          <div style={{ textAlign: 'center', padding: 40, color: NEUTRAL.textMuted }}>Loading...</div>
        )}

        {/* Sections */}
        {!loading && !loadError && (
          <main id="main-content" tabIndex={-1} style={{ outline: 'none' }}>
            <PricingSection data={pricing} onDataChange={loadData} />
            <MarginsSection data={margins} onDataChange={loadData} />
            <CompanySection data={settings} onDataChange={loadData} />
            <TermsSection data={settings} onDataChange={loadData} />
          </main>
        )}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const pageStyles = {
  page: {
    minHeight: '100vh',
    background: NEUTRAL.background,
    fontFamily: FONT_STACK,
  },
  container: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '0 24px 48px',
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
  backBtn: {
    padding: '6px 14px',
    background: NEUTRAL.surface,
    color: NEUTRAL.textSecondary,
    border: `1px solid ${NEUTRAL.borderLight}`,
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#fff5f5',
    border: `1px solid #fdd`,
    borderRadius: RADIUS.md,
    color: BRAND.danger,
    fontSize: 14,
    marginBottom: 24,
  },
  retryBtn: {
    padding: '6px 16px',
    background: BRAND.danger,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
};

const sectionStyles = {
  card: {
    background: NEUTRAL.surface,
    border: `1px solid ${NEUTRAL.border}`,
    borderRadius: RADIUS.lg,
    padding: 24,
    marginBottom: 24,
  },
  title: {
    margin: '0 0 16px',
    fontSize: 16,
    fontWeight: 700,
    color: NEUTRAL.text,
  },
  saveRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  saveBtn: {
    padding: '8px 20px',
    background: BRAND.primary,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    fontSize: 13,
    fontWeight: 600,
  },
  success: {
    color: BRAND.success,
    fontSize: 13,
    fontWeight: 500,
  },
  error: {
    color: BRAND.danger,
    fontSize: 13,
    fontWeight: 500,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  fieldRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: NEUTRAL.text,
  },
  suffix: {
    fontSize: 14,
    color: NEUTRAL.textMuted,
    fontWeight: 500,
  },
  textarea: {
    width: '100%',
    minHeight: 200,
    padding: '10px 12px',
    fontSize: 14,
    fontFamily: FONT_STACK,
    border: `1px solid ${NEUTRAL.inputBorder}`,
    borderRadius: RADIUS.md,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
};

const tableStyles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    color: NEUTRAL.textMuted,
    borderBottom: `1px solid ${NEUTRAL.border}`,
  },
  td: {
    padding: '6px 10px',
    fontVariantNumeric: 'tabular-nums',
  },
  input: {
    padding: '6px 10px',
    fontSize: 14,
    border: `1px solid ${NEUTRAL.inputBorder}`,
    borderRadius: RADIUS.sm,
    outline: 'none',
    width: 100,
    boxSizing: 'border-box',
  },
};
