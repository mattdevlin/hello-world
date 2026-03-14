import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProjects, getProjectWalls, getProjectFloors } from '../utils/storage.js';
import { aggregateProjectMaterials } from '../utils/quoteAggregator.js';
import { api } from '../utils/api.js';
import { FONT_STACK, BRAND, NEUTRAL, RADIUS } from '../utils/designTokens.js';

export default function NewQuotePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [materials, setMaterials] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [notes, setNotes] = useState('');
  const [validityDays, setValidityDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const p = getProjects().find(p => p.id === projectId);
    if (!p) {
      navigate('/', { replace: true });
      return;
    }
    setProject(p);

    const walls = getProjectWalls(projectId);
    const floors = getProjectFloors(projectId);
    const agg = aggregateProjectMaterials(walls, floors);
    setMaterials(agg);

    api.get('/clients').then(setClients).catch(() => {});
    // Pre-load HubSpot contacts availability silently
  }, [projectId, navigate]);

  async function handleImportHubSpotContacts() {
    setImporting(true);
    try {
      const contacts = await api.get('/hubspot/contacts');
      for (const c of contacts) {
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;
        if (!name) continue;
        try {
          await api.post('/clients', {
            name,
            company: c.company || null,
            email: c.email || null,
            phone: c.phone || null,
          });
        } catch (_err) {
          // Client may already exist — skip
        }
      }
      const updated = await api.get('/clients');
      setClients(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!materials) return;

    setSubmitting(true);
    setError(null);

    try {
      const quote = await api.post('/quotes', {
        projectId,
        projectName: project.name,
        projectAddress: project.address || null,
        clientId: selectedClientId || null,
        validityDays,
        notes: notes.trim() || null,
        materials,
      });
      navigate(`/project/${projectId}/quotes/${quote.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (!project || !materials) return null;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <button onClick={() => navigate(`/project/${projectId}/quotes`)} style={styles.backBtn}>
            &larr; Quotes
          </button>
        </div>

        <h1 style={styles.title}>New Quote</h1>
        <p style={styles.subtitle}>{project.name}</p>

        {error && (
          <div style={styles.errorBanner}>
            {error}
            <button onClick={() => setError(null)} style={styles.dismissBtn}>Dismiss</button>
          </div>
        )}

        {/* Material Summary */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Material Quantities</h2>
          <p style={styles.sectionHint}>Calculated from project walls and floors</p>
          <div style={styles.matGrid}>
            <MatCard label="Magboard Sheets" value={materials.magboard.totalSheets} />
            <MatCard label="EPS Blocks" value={materials.eps.totalBlocks} />
            <MatCard label="Glue (litres)" value={materials.glue.totalLitres} />
            <MatCard label="Timber (lm)" value={materials.timber.totalLinealMetres} />
          </div>
        </section>

        <form onSubmit={handleSubmit}>
          {/* Client Selection */}
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Client</h2>
              <button
                type="button"
                onClick={handleImportHubSpotContacts}
                disabled={importing}
                style={styles.importBtn}
              >
                {importing ? 'Importing...' : 'Import from HubSpot'}
              </button>
            </div>
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              style={styles.select}
            >
              <option value="">No client selected</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.company ? ` — ${c.company}` : ''}
                </option>
              ))}
            </select>
          </section>

          {/* Quote Options */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Options</h2>
            <div style={styles.fieldRow}>
              <label style={styles.fieldLabel}>Validity (days)</label>
              <input
                type="number"
                min="1"
                value={validityDays}
                onChange={e => setValidityDays(parseInt(e.target.value, 10) || 30)}
                style={styles.smallInput}
              />
            </div>
            <div style={styles.fieldRow}>
              <label style={styles.fieldLabel}>Internal Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes (not shown on PDF)"
                style={styles.textarea}
                rows={3}
              />
            </div>
          </section>

          <div style={styles.actions}>
            <button
              type="button"
              onClick={() => navigate(`/project/${projectId}/quotes`)}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MatCard({ label, value }) {
  return (
    <div style={styles.matCard}>
      <span style={styles.matValue}>{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value}</span>
      <span style={styles.matLabel}>{label}</span>
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
    maxWidth: 700,
    margin: '0 auto',
    padding: '0 24px 60px',
  },
  topBar: { padding: '16px 0' },
  backBtn: {
    background: 'none',
    border: 'none',
    color: BRAND.primary,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    padding: 0,
  },
  title: {
    margin: '8px 0 0',
    fontSize: 28,
    fontWeight: 700,
    color: NEUTRAL.text,
  },
  subtitle: {
    margin: '4px 0 24px',
    fontSize: 14,
    color: NEUTRAL.textMuted,
  },
  errorBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#fff5f5',
    color: BRAND.danger,
    border: '1px solid #fdd',
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
  section: {
    marginBottom: 24,
    background: NEUTRAL.surface,
    borderRadius: RADIUS.lg,
    border: `1px solid ${NEUTRAL.border}`,
    padding: '20px 24px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: NEUTRAL.text,
  },
  importBtn: {
    padding: '5px 12px',
    background: '#ff7a59',
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.sm,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  sectionHint: {
    margin: '0 0 12px',
    fontSize: 13,
    color: NEUTRAL.textMuted,
  },
  matGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
  },
  matCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 14px',
    background: '#f8f9fa',
    borderRadius: RADIUS.md,
    border: `1px solid ${NEUTRAL.borderLight}`,
  },
  matValue: {
    fontSize: 20,
    fontWeight: 700,
    color: BRAND.primary,
  },
  matLabel: {
    fontSize: 12,
    color: NEUTRAL.textMuted,
    marginTop: 2,
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 14,
    border: `1px solid ${NEUTRAL.inputBorder}`,
    borderRadius: RADIUS.sm,
    background: NEUTRAL.surface,
  },
  fieldRow: {
    marginBottom: 16,
  },
  fieldLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: NEUTRAL.text,
    marginBottom: 4,
  },
  smallInput: {
    width: 100,
    padding: '6px 10px',
    fontSize: 14,
    border: `1px solid ${NEUTRAL.inputBorder}`,
    borderRadius: RADIUS.sm,
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    fontFamily: FONT_STACK,
    border: `1px solid ${NEUTRAL.inputBorder}`,
    borderRadius: RADIUS.sm,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    padding: '10px 20px',
    background: NEUTRAL.surface,
    color: NEUTRAL.textSecondary,
    border: `1px solid ${NEUTRAL.border}`,
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  submitBtn: {
    padding: '10px 24px',
    background: BRAND.primary,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
};
