import { useState, useRef } from 'react';

export default function ProjectManager({
  projects,
  activeProjectId,
  activeWalls,
  getWallsForProject,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onLoadWall,
  onDeleteWall,
  onCopyWall,
  onExportProject,
  onImportProject,
}) {
  const [newName, setNewName] = useState('');
  const [expandedId, setExpandedId] = useState(activeProjectId);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [copyingWall, setCopyingWall] = useState(null); // { wallData, sourceProjectId }
  const fileRef = useRef(null);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateProject(newName.trim());
    setNewName('');
  };

  const startRename = (p, e) => {
    e.stopPropagation();
    setRenamingId(p.id);
    setRenameValue(p.name);
  };

  const finishRename = (id) => {
    if (renameValue.trim()) {
      onRenameProject(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await onImportProject(file);
      e.target.value = '';
    }
  };

  const toggleExpand = (projectId) => {
    if (expandedId === projectId) {
      setExpandedId(null);
    } else {
      setExpandedId(projectId);
      onSelectProject(projectId);
    }
  };

  return (
    <div style={styles.panel} data-no-print>
      <div style={styles.topBar}>
        <h3 style={styles.title}>Projects</h3>
        <div style={styles.topActions}>
          <button onClick={() => fileRef.current?.click()} style={styles.importBtn}>
            Import .devpro
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".devpro"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <form onSubmit={handleCreate} style={styles.createRow}>
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New project name..."
          style={styles.createInput}
        />
        <button type="submit" style={styles.createBtn}>Create</button>
      </form>

      {projects.length === 0 && (
        <p style={styles.empty}>No projects yet. Create one above.</p>
      )}

      <div style={styles.list}>
        {projects.map(p => {
          const isExpanded = expandedId === p.id;
          const isActive = p.id === activeProjectId;
          const walls = isExpanded
            ? (isActive ? activeWalls : getWallsForProject(p.id))
            : [];

          return (
            <div key={p.id} style={{ ...styles.projectCard, ...(isActive ? styles.activeCard : {}) }}>
              <div style={styles.projectHeader} onClick={() => toggleExpand(p.id)}>
                <div style={styles.projectLeft}>
                  <span style={styles.arrow}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
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
                    <strong>{p.name}</strong>
                  )}
                  <span style={styles.wallCount}>
                    {p.wallCount} wall{p.wallCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={styles.projectActions}>
                  <button onClick={(e) => { e.stopPropagation(); onExportProject(p.id); }} style={styles.actionBtn} title="Download archive">
                    Export
                  </button>
                  <button onClick={(e) => startRename(p, e)} style={styles.actionBtn} title="Rename project">
                    Rename
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id); }}
                    style={styles.deleteBtnSmall}
                    title="Delete project"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div style={styles.wallList}>
                  {walls.length === 0 ? (
                    <p style={styles.emptyWalls}>No walls in this project yet.</p>
                  ) : (
                    walls.map(w => (
                      <div key={w.id}>
                        <div
                          style={styles.wallItem}
                          onClick={() => onLoadWall(w)}
                        >
                          <div style={styles.wallInfo}>
                            <span style={styles.wallName}>{w.name}</span>
                            <span style={styles.wallMeta}>
                              {w.length_mm}mm x {w.height_mm}mm
                              {w.openings?.length > 0 && ` · ${w.openings.length} opening${w.openings.length > 1 ? 's' : ''}`}
                            </span>
                          </div>
                          <div style={styles.wallActions}>
                            <span style={styles.wallDate}>
                              {new Date(w.updatedAt).toLocaleDateString()}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCopyingWall(
                                  copyingWall?.wallData.id === w.id ? null : { wallData: w, sourceProjectId: p.id }
                                );
                              }}
                              style={styles.copyBtn}
                            >
                              Copy to...
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteWall(p.id, w.id); }}
                              style={styles.deleteBtnSmall}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {copyingWall?.wallData.id === w.id && (
                          <div style={styles.copyTargets}>
                            <span style={styles.copyLabel}>Copy to:</span>
                            {projects
                              .filter(tp => tp.id !== p.id)
                              .map(tp => (
                                <button
                                  key={tp.id}
                                  onClick={() => {
                                    onCopyWall(w, tp.id);
                                    setCopyingWall(null);
                                  }}
                                  style={styles.copyTargetBtn}
                                >
                                  {tp.name}
                                </button>
                              ))}
                            {projects.filter(tp => tp.id !== p.id).length === 0 && (
                              <span style={styles.noCopyTargets}>No other projects</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  panel: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '16px 24px',
    background: '#fff',
    borderBottom: '2px solid #ddd',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 16,
    color: '#333',
  },
  topActions: {
    display: 'flex',
    gap: 8,
  },
  importBtn: {
    padding: '6px 14px',
    background: '#7f8c8d',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  createRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  createInput: {
    flex: 1,
    padding: '8px 10px',
    fontSize: 13,
    border: '1px solid #ccc',
    borderRadius: 4,
    boxSizing: 'border-box',
  },
  createBtn: {
    padding: '8px 16px',
    background: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  empty: {
    color: '#999',
    fontStyle: 'italic',
    fontSize: 13,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  projectCard: {
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  activeCard: {
    borderColor: '#2C5F8A',
    boxShadow: '0 0 0 1px #2C5F8A',
  },
  projectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: '#f5f6f8',
    cursor: 'pointer',
    userSelect: 'none',
  },
  projectLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  arrow: {
    fontSize: 10,
    color: '#666',
    width: 14,
  },
  wallCount: {
    color: '#888',
    fontSize: 12,
    marginLeft: 4,
  },
  renameInput: {
    padding: '2px 6px',
    fontSize: 13,
    border: '1px solid #4A90D9',
    borderRadius: 3,
    outline: 'none',
    fontWeight: 'bold',
  },
  projectActions: {
    display: 'flex',
    gap: 6,
  },
  actionBtn: {
    padding: '3px 10px',
    background: '#4A90D9',
    color: '#fff',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  },
  deleteBtnSmall: {
    padding: '3px 10px',
    background: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 11,
  },
  wallList: {
    padding: '8px 14px 10px',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  emptyWalls: {
    color: '#aaa',
    fontStyle: 'italic',
    fontSize: 12,
    margin: 0,
  },
  wallItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    background: '#fafafa',
    border: '1px solid #eee',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
  },
  wallInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  wallName: {
    fontWeight: 600,
    color: '#333',
  },
  wallMeta: {
    color: '#888',
    fontSize: 11,
  },
  wallActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  wallDate: {
    color: '#999',
    fontSize: 11,
  },
  copyBtn: {
    padding: '3px 10px',
    background: '#8e44ad',
    color: '#fff',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 11,
  },
  copyTargets: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    background: '#f0ecf5',
    borderRadius: '0 0 4px 4px',
    borderTop: '1px dashed #c9b8de',
    flexWrap: 'wrap',
  },
  copyLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: 600,
  },
  copyTargetBtn: {
    padding: '3px 10px',
    background: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  },
  noCopyTargets: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
};
