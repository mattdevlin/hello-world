import { useCallback } from 'react';

export default function PrintButton({ sectionRef, label }) {
  const handlePrint = useCallback(() => {
    if (!sectionRef?.current) {
      window.print();
      return;
    }
    // Mark this section as the active print target
    sectionRef.current.setAttribute('data-print-active', 'true');
    window.print();
    sectionRef.current.removeAttribute('data-print-active');
  }, [sectionRef]);

  return (
    <button onClick={handlePrint} style={styles.btn} className="no-print">
      Print A3{label ? ` — ${label}` : ''}
    </button>
  );
}

const styles = {
  btn: {
    padding: '6px 16px',
    background: '#2C5F8A',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
  },
};
