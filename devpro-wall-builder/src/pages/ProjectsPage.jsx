import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getProjects, createProject, renameProject, deleteProject,
  exportProject, importProject, migrateLegacyWalls,
} from '../utils/storage.js';
import { FONT_STACK, BRAND, NEUTRAL, RADIUS } from '../utils/designTokens.js';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    migrateLegacyWalls();
    setProjects(getProjects());
  }, []);

  const refresh = () => setProjects(getProjects());

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const p = createProject(newName.trim());
    setNewName('');
    refresh();
    navigate(`/project/${p.id}`);
  };

  const handleDelete = (id, name, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete project "${name}" and all its walls/floors? This cannot be undone.`)) return;
    deleteProject(id);
    refresh();
  };

  const handleExport = async (id, e) => {
    e.stopPropagation();
    try { await exportProject(id); } catch (err) { console.error('Export failed:', err); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importProject(file);
      refresh();
    } catch (err) { console.error('Import failed:', err); }
    e.target.value = '';
  };

  const startRename = (p, e) => {
    e.stopPropagation();
    setRenamingId(p.id);
    setRenameValue(p.name);
  };

  const finishRename = (id) => {
    if (renameValue.trim()) renameProject(id, renameValue.trim());
    setRenamingId(null);
    refresh();
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>DEVPRO Wall Builder</h1>
            <p style={styles.subtitle}>SIP panel layout tool</p>
          </div>
          <button onClick={() => fileRef.current?.click()} style={styles.importBtn}>
            Import .devpro
          </button>
          <input ref={fileRef} type="file" accept=".devpro" onChange={handleImport} style={{ display: 'none' }} />
        </div>

        <form onSubmit={handleCreate} style={styles.createRow}>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New project name..."
            style={styles.createInput}
          />
          <button type="submit" style={styles.createBtn}>+ New Project</button>
        </form>

        {projects.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyText}>No projects yet</p>
            <p style={styles.emptyHint}>Create a project above to get started.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {projects.map(p => (
              <div
                key={p.id}
                style={styles.card}
                onClick={() => navigate(`/project/${p.id}`)}
              >
                <div style={styles.cardBody}>
                  {renamingId === p.id ? (
                    <input
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => finishRename(p.id)}
                      onKeyDown={e => e.key === 'Enter' && finishRename(p.id)}
                      onClick={e => e.stopPropagation()}
                      style={styles.renameInput}
                      autoFocus
                    />
                  ) : (
                    <h3 style={styles.cardTitle}>{p.name}</h3>
                  )}
                  <div style={styles.cardMeta}>
                    <span style={styles.wallCount}>
                      {p.wallCount} wall{p.wallCount !== 1 ? 's' : ''}
                    </span>
                    <span style={styles.cardDate}>
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div style={styles.cardActions}>
                  <button onClick={(e) => handleExport(p.id, e)} style={styles.actionBtn} title="Export">Export</button>
                  <button onClick={(e) => startRename(p, e)} style={styles.actionBtn} title="Rename">Rename</button>
                  <button onClick={(e) => handleDelete(p.id, p.name, e)} style={styles.deleteBtn} title="Delete">Delete</button>
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
    padding: '0 24px',
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
  importBtn: {
    padding: '8px 16px',
    background: NEUTRAL.surface,
    color: NEUTRAL.textSecondary,
    border: `1px solid ${NEUTRAL.borderLight}`,
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },

  // Create row
  createRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
  },
  createInput: {
    flex: 1,
    padding: '10px 14px',
    fontSize: 14,
    border: `1px solid ${NEUTRAL.borderLight}`,
    borderRadius: RADIUS.md,
    outline: 'none',
    background: NEUTRAL.surface,
  },
  createBtn: {
    padding: '10px 20px',
    background: BRAND.primary,
    color: NEUTRAL.surface,
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  // Empty state
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    background: NEUTRAL.surface,
    borderRadius: RADIUS.lg,
    border: `1px dashed ${NEUTRAL.borderLight}`,
  },
  emptyText: {
    fontSize: 16,
    color: NEUTRAL.textSecondary,
    fontWeight: 500,
    margin: '0 0 4px',
  },
  emptyHint: {
    fontSize: 13,
    color: NEUTRAL.textFaint,
    margin: 0,
  },

  // Project cards
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
    transition: 'box-shadow 0.15s, border-color 0.15s',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: NEUTRAL.text,
  },
  renameInput: {
    padding: '4px 8px',
    fontSize: 15,
    fontWeight: 600,
    border: `1px solid ${BRAND.primary}`,
    borderRadius: RADIUS.sm,
    outline: 'none',
    width: '100%',
    maxWidth: 300,
  },
  cardMeta: {
    display: 'flex',
    gap: 12,
    marginTop: 4,
  },
  wallCount: {
    fontSize: 12,
    color: BRAND.primary,
    fontWeight: 500,
  },
  cardDate: {
    fontSize: 12,
    color: NEUTRAL.textFaint,
  },
  cardActions: {
    display: 'flex',
    gap: 6,
    marginLeft: 16,
    flexShrink: 0,
  },
  actionBtn: {
    padding: '5px 12px',
    background: '#f5f6f8',
    color: NEUTRAL.textSecondary,
    border: `1px solid ${NEUTRAL.border}`,
    borderRadius: RADIUS.sm,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
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
