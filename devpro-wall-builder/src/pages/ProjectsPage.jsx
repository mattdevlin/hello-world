import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Edit2, Trash2, Plus } from 'lucide-react';
import {
  getProjects, createProject, renameProject, deleteProject,
  exportProject, importProject, migrateLegacyWalls,
  getProjectWalls, getProjectFloors, getProjectRoofs,
} from '../utils/storage.js';
import { FONT_STACK, BRAND, NEUTRAL, RADIUS, SHADOW } from '../utils/designTokens.js';
import { calculateProjectPrice } from '../utils/priceCalculator.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../hooks/useToast.js';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [projects, setProjects] = useState([]);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const fileRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [prices, setPrices] = useState({});

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'walls') {
      list = [...list].sort((a, b) => (b.wallCount || 0) - (a.wallCount || 0));
    }
    // default 'date' — already sorted by updatedAt from storage
    return list;
  }, [projects, searchQuery, sortBy]);

  useEffect(() => {
    migrateLegacyWalls();
    setProjects(getProjects());
  }, []);

  // Compute prices for all projects
  useEffect(() => {
    if (projects.length === 0) return;
    let cancelled = false;
    async function computePrices() {
      const result = {};
      for (const p of projects) {
        const walls = getProjectWalls(p.id);
        const floors = getProjectFloors(p.id);
        const roofs = getProjectRoofs(p.id);
        if (walls.length > 0 || floors.length > 0 || roofs.length > 0) {
          try {
            result[p.id] = await calculateProjectPrice(walls, floors, roofs);
          } catch {
            // skip
          }
        }
      }
      if (!cancelled) setPrices(result);
    }
    computePrices();
    return () => { cancelled = true; };
  }, [projects]);

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
    setConfirmDelete({ id, name });
  };

  const confirmDeleteProject = () => {
    if (confirmDelete) {
      deleteProject(confirmDelete.id);
      refresh();
      setConfirmDelete(null);
    }
  };

  const handleExport = async (id, e) => {
    e.stopPropagation();
    try {
      await exportProject(id);
      showToast({ type: 'success', message: 'Project exported successfully.' });
    } catch (err) {
      console.error('Export failed:', err);
      showToast({ type: 'error', message: 'Export failed: ' + (err.message || 'Unknown error') });
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importProject(file);
      refresh();
      showToast({ type: 'success', message: 'Project imported successfully.' });
    } catch (err) {
      console.error('Import failed:', err);
      showToast({ type: 'error', message: 'Import failed: ' + (err.message || 'Invalid file format') });
    }
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
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>DEVPRO Wall Builder</h1>
            <p style={styles.subtitle}>SIP panel layout tool</p>
          </div>
          <nav style={{ display: 'flex', gap: 8 }} aria-label="Page actions">
            <button onClick={() => navigate('/admin')} style={styles.importBtn}>Admin</button>
            <button onClick={() => fileRef.current?.click()} style={styles.importBtn}>
              Import .devpro
            </button>
          </nav>
          <input
            ref={fileRef}
            type="file"
            accept=".devpro"
            onChange={handleImport}
            style={{ display: 'none' }}
            aria-label="Import project file"
          />
        </header>

        <main id="main-content" tabIndex={-1} style={{ outline: 'none' }}>
          <form onSubmit={handleCreate} style={styles.createRow}>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="New project name..."
              style={styles.createInput}
              aria-label="New project name"
            />
            <button type="submit" style={styles.createBtn}>
              <Plus size={14} style={{ marginRight: 4, verticalAlign: -2 }} />New Project
            </button>
          </form>

          {projects.length > 0 && (
            <div style={styles.searchRow}>
              <div style={styles.searchWrap}>
                <Search size={14} style={styles.searchIcon} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  style={styles.searchInput}
                  aria-label="Search projects"
                />
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={styles.sortSelect}
                aria-label="Sort projects"
              >
                <option value="date">Sort by date</option>
                <option value="name">Sort by name</option>
                <option value="walls">Sort by walls</option>
              </select>
            </div>
          )}

          {projects.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyText}>No projects yet</p>
              <p style={styles.emptyHint}>Create your first project to start designing wall panels.</p>
              <button
                onClick={() => {
                  const input = document.querySelector('[aria-label="New project name"]');
                  if (input) input.focus();
                }}
                style={styles.emptyCta}
              >
                <Plus size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Create Project
              </button>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyText}>No matching projects</p>
              <p style={styles.emptyHint}>Try a different search term.</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {filteredProjects.map(p => (
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
                        aria-label={`Rename project ${p.name}`}
                        autoFocus
                      />
                    ) : (
                      <h3 style={styles.cardTitle}>{p.name}</h3>
                    )}
                    <div style={styles.cardMeta}>
                      <span style={styles.wallCount}>
                        {p.wallCount} wall{p.wallCount !== 1 ? 's' : ''}
                      </span>
                      {prices[p.id] && prices[p.id].totalIncGst > 0 && (
                        <span style={styles.cardPrice}>
                          ${prices[p.id].totalIncGst.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span style={styles.cardPriceGst}> incl GST</span>
                        </span>
                      )}
                      <span style={styles.cardDate}>
                        {new Date(p.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div style={styles.cardActions}>
                    <button onClick={(e) => handleExport(p.id, e)} style={styles.actionBtn} aria-label={`Export project ${p.name}`}>
                      <Download size={12} style={{ marginRight: 3, verticalAlign: -1 }} />Export
                    </button>
                    <button onClick={(e) => startRename(p, e)} style={styles.actionBtn} aria-label={`Rename project ${p.name}`}>
                      <Edit2 size={12} style={{ marginRight: 3, verticalAlign: -1 }} />Rename
                    </button>
                    <button onClick={(e) => handleDelete(p.id, p.name, e)} style={styles.deleteBtn} aria-label={`Delete project ${p.name}`}>
                      <Trash2 size={12} style={{ marginRight: 3, verticalAlign: -1 }} />Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Project"
        message={confirmDelete ? `Delete project "${confirmDelete.name}" and all its walls/floors? This cannot be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={confirmDeleteProject}
        onCancel={() => setConfirmDelete(null)}
      />
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

  // Search & sort
  searchRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
  },
  searchWrap: {
    flex: 1,
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    color: NEUTRAL.textFaint,
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px 8px 32px',
    fontSize: 13,
    border: `1px solid ${NEUTRAL.borderLight}`,
    borderRadius: RADIUS.md,
    outline: 'none',
    background: NEUTRAL.surface,
  },
  sortSelect: {
    padding: '8px 12px',
    fontSize: 13,
    border: `1px solid ${NEUTRAL.borderLight}`,
    borderRadius: RADIUS.md,
    background: NEUTRAL.surface,
    color: NEUTRAL.textSecondary,
    cursor: 'pointer',
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
    margin: '0 0 16px',
  },
  emptyCta: {
    padding: '10px 20px',
    background: BRAND.primary,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
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
    boxShadow: SHADOW.sm,
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
  cardPrice: {
    fontSize: 12,
    fontWeight: 600,
    color: BRAND.success,
  },
  cardPriceGst: {
    fontWeight: 400,
    color: NEUTRAL.textFaint,
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
