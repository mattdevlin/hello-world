import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProjects } from '../utils/storage.js';
import { api } from '../utils/api.js';
import QuoteStatusBadge from '../components/quotes/QuoteStatusBadge.jsx';
import { FONT_STACK, BRAND, NEUTRAL, RADIUS } from '../utils/designTokens.js';

export default function ProjectQuotesPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const p = getProjects().find(p => p.id === projectId);
    if (!p) {
      navigate('/', { replace: true });
      return;
    }
    setProject(p);
    loadQuotes();
  }, [projectId, navigate]);

  async function loadQuotes() {
    setLoading(true);
    try {
      const data = await api.get(`/quotes?project_id=${projectId}`);
      setQuotes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(quoteId, quoteNumber, e) {
    e.stopPropagation();
    if (!window.confirm(`Delete draft quote "${quoteNumber}"?`)) return;
    try {
      await api.del(`/quotes/${quoteId}`);
      loadQuotes();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!project) return null;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <button onClick={() => navigate(`/project/${projectId}`)} style={styles.backBtn}>
            &larr; {project.name}
          </button>
        </div>

        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Quotes</h1>
            <p style={styles.subtitle}>{project.name}</p>
          </div>
          <button
            onClick={() => navigate(`/project/${projectId}/quotes/new`)}
            style={styles.newBtn}
          >
            + New Quote
          </button>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            {error}
            <button onClick={() => setError(null)} style={styles.dismissBtn}>Dismiss</button>
          </div>
        )}

        {loading ? (
          <p style={styles.loadingText}>Loading quotes...</p>
        ) : quotes.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyText}>No quotes yet</p>
            <p style={styles.emptyHint}>Create a quote to generate pricing from your project materials.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {quotes.map(q => (
              <div
                key={q.id}
                style={styles.card}
                onClick={() => navigate(`/project/${projectId}/quotes/${q.id}`)}
              >
                <div style={styles.cardBody}>
                  <div style={styles.cardTop}>
                    <strong style={styles.quoteNumber}>{q.quote_number}</strong>
                    <QuoteStatusBadge status={q.status} />
                  </div>
                  <div style={styles.cardMeta}>
                    <span style={styles.metaItem}>
                      ${Number(q.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span style={styles.metaDate}>
                      {new Date(q.created_at).toLocaleDateString()}
                    </span>
                    {q.version > 1 && (
                      <span style={styles.metaVersion}>v{q.version}</span>
                    )}
                  </div>
                </div>
                <div style={styles.cardActions}>
                  {q.status === 'draft' && (
                    <button
                      onClick={(e) => handleDelete(q.id, q.quote_number, e)}
                      style={styles.deleteBtn}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
    maxWidth: 800,
    margin: '0 auto',
    padding: '0 24px 60px',
  },
  topBar: {
    padding: '16px 0',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: BRAND.primary,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    padding: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0 24px',
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
  newBtn: {
    padding: '10px 20px',
    background: BRAND.warning,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
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
  loadingText: {
    textAlign: 'center',
    padding: 60,
    color: NEUTRAL.textMuted,
    fontSize: 14,
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    background: NEUTRAL.surface,
    borderRadius: RADIUS.lg,
    border: '1px dashed #ddd',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 500,
    margin: '0 0 4px',
  },
  emptyHint: {
    fontSize: 13,
    color: NEUTRAL.textFaint,
    margin: 0,
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  card: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: NEUTRAL.surface,
    borderRadius: RADIUS.lg,
    border: `1px solid ${NEUTRAL.border}`,
    padding: '16px 20px',
    cursor: 'pointer',
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  quoteNumber: {
    fontSize: 15,
    color: NEUTRAL.text,
  },
  cardMeta: {
    display: 'flex',
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    fontSize: 14,
    fontWeight: 600,
    color: BRAND.primary,
  },
  metaDate: {
    fontSize: 12,
    color: NEUTRAL.textFaint,
  },
  metaVersion: {
    fontSize: 12,
    color: NEUTRAL.textMuted,
    fontWeight: 500,
  },
  cardActions: {
    display: 'flex',
    gap: 6,
    marginLeft: 16,
    flexShrink: 0,
  },
  deleteBtn: {
    padding: '5px 12px',
    background: '#fff5f5',
    color: BRAND.danger,
    border: '1px solid #fdd',
    borderRadius: RADIUS.sm,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  },
};
