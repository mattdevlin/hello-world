import { useState, useEffect, useRef } from 'react';
import { BRAND, NEUTRAL, RADIUS, SHADOW } from '../utils/designTokens.js';
import CalcInput from './CalcInput.jsx';

const FIELDS = [
  { value: 'height_mm', label: 'Height (mm)' },
  { value: 'length_mm', label: 'Length (mm)' },
];

export default function BulkUpdateDialog({ open, wallCount, onApply, onCancel }) {
  const [selectedField, setSelectedField] = useState('height_mm');
  const [inputValue, setInputValue] = useState(0);
  const applyRef = useRef(null);

  useEffect(() => {
    if (open) {
      setSelectedField('height_mm');
      setInputValue(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={onCancel} role="dialog" aria-modal="true" aria-label="Bulk Update Walls">
      <div style={styles.dialog} onClick={e => e.stopPropagation()}>
        <h3 style={styles.title}>Bulk Update Walls</h3>
        <div style={styles.fieldRow}>
          <label style={styles.label}>Field</label>
          <select
            value={selectedField}
            onChange={e => setSelectedField(e.target.value)}
            style={styles.select}
          >
            {FIELDS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div style={styles.fieldRow}>
          <label style={styles.label}>Value</label>
          <CalcInput
            value={inputValue}
            onChange={setInputValue}
            style={styles.input}
          />
        </div>
        <p style={styles.hint}>This will update {wallCount} wall{wallCount !== 1 ? 's' : ''}.</p>
        <div style={styles.actions}>
          <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
          <button
            ref={applyRef}
            onClick={() => onApply(selectedField, inputValue)}
            disabled={inputValue <= 0}
            style={inputValue > 0 ? styles.confirmBtn : styles.disabledBtn}
          >
            Update All
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9000,
  },
  dialog: {
    background: NEUTRAL.surface,
    borderRadius: RADIUS.lg,
    padding: 24,
    maxWidth: 420,
    width: '90%',
    boxShadow: SHADOW.lg,
  },
  title: {
    margin: '0 0 16px',
    fontSize: 18,
    fontWeight: 700,
    color: NEUTRAL.text,
  },
  fieldRow: {
    marginBottom: 12,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: NEUTRAL.textSecondary,
    marginBottom: 4,
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 14,
    border: `1px solid ${NEUTRAL.inputBorder}`,
    borderRadius: RADIUS.md,
    background: '#fff',
    outline: 'none',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 14,
    border: `1px solid ${NEUTRAL.inputBorder}`,
    borderRadius: RADIUS.md,
    outline: 'none',
    boxSizing: 'border-box',
  },
  hint: {
    margin: '0 0 16px',
    fontSize: 13,
    color: NEUTRAL.textMuted,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    padding: '8px 16px',
    background: NEUTRAL.surface,
    color: NEUTRAL.textSecondary,
    border: `1px solid ${NEUTRAL.border}`,
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  confirmBtn: {
    padding: '8px 16px',
    background: BRAND.primary,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  disabledBtn: {
    padding: '8px 16px',
    background: '#ccc',
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'not-allowed',
    fontSize: 14,
    fontWeight: 600,
  },
};
