import { useCallback } from 'react';

export default function PrintButton({ sectionRef, label, projectName, wallName }) {
  const handlePrint = useCallback(() => {
    // Set document title to control the default print filename
    const prevTitle = document.title;
    const parts = [projectName, wallName, label].filter(Boolean);
    if (parts.length > 0) {
      document.title = parts.join(' ');
    }

    if (!sectionRef?.current) {
      window.print();
    } else {
      sectionRef.current.setAttribute('data-print-active', 'true');
      window.print();
      sectionRef.current.removeAttribute('data-print-active');
    }

    document.title = prevTitle;
  }, [sectionRef, projectName, wallName, label]);

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
