import { useEffect, useRef } from 'react';
import { BRAND, NEUTRAL, RADIUS, SHADOW } from '../utils/designTokens.js';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', danger = true, onConfirm, onCancel }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (open && confirmRef.current) {
      confirmRef.current.focus();
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
    <div style={styles.overlay} onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div style={styles.dialog} onClick={e => e.stopPropagation()}>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.message}>{message}</p>
        <div style={styles.actions}>
          <button onClick={onCancel} style={styles.cancelBtn}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={danger ? styles.dangerBtn : styles.confirmBtn}
          >
            {confirmLabel}
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
    margin: '0 0 8px',
    fontSize: 18,
    fontWeight: 700,
    color: NEUTRAL.text,
  },
  message: {
    margin: '0 0 20px',
    fontSize: 14,
    color: NEUTRAL.textSecondary,
    lineHeight: 1.5,
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
  dangerBtn: {
    padding: '8px 16px',
    background: BRAND.danger,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
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
};
