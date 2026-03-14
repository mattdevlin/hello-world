import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

const STORAGE_KEY = 'devpro-collapsed-sections';

function loadCollapsedState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCollapsedState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function CollapsibleSection({ sectionKey, title, defaultCollapsed = false, forceOpen, forceCollapse, headerRight, children }) {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = loadCollapsedState();
    return sectionKey in saved ? saved[sectionKey] : defaultCollapsed;
  });
  const contentRef = useRef(null);

  useEffect(() => {
    if (forceOpen) setCollapsed(false);
  }, [forceOpen]);

  useEffect(() => {
    if (forceCollapse) setCollapsed(true);
  }, [forceCollapse]);

  useEffect(() => {
    const state = loadCollapsedState();
    state[sectionKey] = collapsed;
    saveCollapsedState(state);
  }, [collapsed, sectionKey]);

  const toggle = () => setCollapsed(c => !c);

  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={toggle} style={styles.header} aria-expanded={!collapsed}>
        <span style={styles.chevron} aria-hidden="true">{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</span>
        <span style={styles.title}>{title}</span>
        {headerRight && <span style={styles.headerRight}>{headerRight}</span>}
      </button>
      <div
        ref={contentRef}
        className="collapsible-content"
        style={{
          maxHeight: collapsed ? 0 : 'none',
          overflow: collapsed ? 'hidden' : 'visible',
          transition: collapsed ? 'max-height 0.3s ease' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 16px',
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
    textAlign: 'left',
    fontFamily: 'inherit',
  },
  chevron: {
    fontSize: 10,
    color: '#666',
    width: 14,
    textAlign: 'center',
  },
  title: {
    flex: 1,
  },
  headerRight: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
};
