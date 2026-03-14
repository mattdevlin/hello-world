import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProjects } from '../utils/storage.js';
import { api } from '../utils/api.js';
import QuoteStatusBadge from '../components/quotes/QuoteStatusBadge.jsx';
import { FONT_STACK, BRAND, NEUTRAL, RADIUS } from '../utils/designTokens.js';

const STATUS_TRANSITIONS = {
  draft: ['sent'],
  sent: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
};

export default function QuoteDetailPage() {
  const { projectId, quoteId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const p = getProjects().find(p => p.id === projectId);
    if (!p) {
      navigate('/', { replace: true });
      return;
    }
    setProject(p);
    loadQuote();
  }, [projectId, quoteId, navigate]);

  async function loadQuote() {
    setLoading(true);
    try {
      const data = await api.get(`/quotes/${quoteId}`);
      setQuote(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus) {
    setUpdating(true);
    try {
      await api.put(`/quotes/${quoteId}/status`, { status: newStatus });
      loadQuote();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleRevise() {
    setUpdating(true);
    try {
      const revised = await api.post(`/quotes/${quoteId}/revise`);
      navigate(`/project/${projectId}/quotes/${revised.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setUpdating(false);
    }
  }

  if (loading || !project) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <p style={styles.loadingText}>Loading quote...</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <p style={styles.loadingText}>Quote not found</p>
        </div>
      </div>
    );
  }

  const nextStatuses = STATUS_TRANSITIONS[quote.status] || [];
  const mats = quote.material_quantities || {};
  const subs = quote.subtotals || {};

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <button onClick={() => navigate(`/project/${projectId}/quotes`)} style={styles.backBtn}>
            &larr; Quotes
          </button>
        </div>

        {error && (
          <div style={styles.errorBanner}>
            {error}
            <button onClick={() => setError(null)} style={styles.dismissBtn}>Dismiss</button>
          </div>
        )}

        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.headerTop}>
              <h1 style={styles.title}>{quote.quote_number}</h1>
              <QuoteStatusBadge status={quote.status} />
            </div>
            <p style={styles.subtitle}>{project.name}</p>
          </div>
          <div style={styles.headerActions}>
            {nextStatuses.map(s => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={updating}
                style={s === 'accepted' ? styles.acceptBtn : s === 'rejected' ? styles.rejectBtn : styles.statusBtn}
              >
                Mark {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <button onClick={handleRevise} disabled={updating} style={styles.reviseBtn}>
              Revise
            </button>
            <a
              href={`/api/quotes/${quoteId}/pdf`}
              download
              style={styles.pdfBtn}
            >
              Download PDF
            </a>
          </div>
        </div>

        {/* Price Summary */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Price Summary</h2>
          <div style={styles.priceGrid}>
            {Object.entries(subs).map(([key, sub]) => (
              <div key={key} style={styles.priceRow}>
                <span style={styles.priceLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                <span style={styles.priceQty}>{sub.quantity} × ${sub.unitCost?.toFixed(2)}</span>
                <span style={styles.priceBase}>${sub.baseCost?.toFixed(2)}</span>
                <span style={styles.priceMarkup}>+{((sub.markup || 0) * 100).toFixed(0)}%</span>
                <span style={styles.priceTotal}>${sub.markedUpCost?.toFixed(2)}</span>
              </div>
            ))}
            <div style={styles.priceDivider} />
            <div style={styles.priceRow}>
              <span style={styles.priceLabel}>Subtotal</span>
              <span /><span /><span />
              <span style={styles.priceTotal}>${quote.total_before_overhead?.toFixed(2)}</span>
            </div>
            <div style={styles.priceRow}>
              <span style={styles.priceLabel}>Overhead</span>
              <span /><span /><span />
              <span style={styles.priceTotal}>${quote.overhead_amount?.toFixed(2)}</span>
            </div>
            <div style={{ ...styles.priceRow, ...styles.grandTotal }}>
              <span style={styles.priceLabel}>Total (excl. GST)</span>
              <span /><span /><span />
              <span style={styles.grandTotalValue}>${quote.total_price?.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* Material Quantities */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Material Quantities</h2>
          <div style={styles.matGrid}>
            <MatCard label="Magboard Sheets" value={mats.magboard?.totalSheets} />
            <MatCard label="EPS Blocks" value={mats.eps?.totalBlocks} />
            <MatCard label="Glue (litres)" value={mats.glue?.totalLitres} />
            <MatCard label="Timber (lm)" value={mats.timber?.totalLinealMetres} />
          </div>
        </section>

        {/* Quote Details */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Details</h2>
          <div style={styles.detailGrid}>
            <DetailRow label="Created" value={new Date(quote.created_at).toLocaleString()} />
            <DetailRow label="Valid Until" value={quote.valid_until || 'N/A'} />
            <DetailRow label="Version" value={`v${quote.version}`} />
            {quote.notes && <DetailRow label="Notes" value={quote.notes} />}
          </div>
        </section>
      </div>
    </div>
  );
}

function MatCard({ label, value }) {
  return (
    <div style={styles.matCard}>
      <span style={styles.matValue}>{value != null ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}</span>
      <span style={styles.matLabel}>{label}</span>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value}</span>
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '8px 0 24px',
    flexWrap: 'wrap',
    gap: 16,
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
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
  headerActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBtn: {
    padding: '8px 16px',
    background: BRAND.primary,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  acceptBtn: {
    padding: '8px 16px',
    background: BRAND.success,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  rejectBtn: {
    padding: '8px 16px',
    background: BRAND.danger,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  reviseBtn: {
    padding: '8px 16px',
    background: NEUTRAL.surface,
    color: NEUTRAL.textSecondary,
    border: `1px solid ${NEUTRAL.border}`,
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  pdfBtn: {
    padding: '8px 16px',
    background: BRAND.warning,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-block',
  },
  section: {
    marginBottom: 24,
    background: NEUTRAL.surface,
    borderRadius: RADIUS.lg,
    border: `1px solid ${NEUTRAL.border}`,
    padding: '20px 24px',
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: 16,
    fontWeight: 600,
    color: NEUTRAL.text,
  },

  // Price breakdown
  priceGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  priceRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1.5fr 1fr 0.8fr 1fr',
    alignItems: 'center',
    padding: '6px 0',
    fontSize: 14,
  },
  priceLabel: { color: NEUTRAL.text, fontWeight: 500 },
  priceQty: { color: NEUTRAL.textMuted, fontSize: 13 },
  priceBase: { color: NEUTRAL.textSecondary, textAlign: 'right' },
  priceMarkup: { color: NEUTRAL.textMuted, textAlign: 'center', fontSize: 13 },
  priceTotal: { color: NEUTRAL.text, textAlign: 'right', fontWeight: 600 },
  priceDivider: {
    height: 1,
    background: NEUTRAL.border,
    margin: '4px 0',
  },
  grandTotal: {
    borderTop: `2px solid ${NEUTRAL.text}`,
    paddingTop: 8,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 700,
    color: BRAND.primary,
    textAlign: 'right',
  },

  // Materials
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

  // Details
  detailGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  detailRow: {
    display: 'flex',
    gap: 12,
    fontSize: 14,
  },
  detailLabel: {
    fontWeight: 600,
    color: NEUTRAL.text,
    minWidth: 100,
  },
  detailValue: {
    color: NEUTRAL.textSecondary,
  },
};
