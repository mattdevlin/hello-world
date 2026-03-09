import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getProjects, getProjectWalls, deleteWall, renameProject,
  copyWallToProject,
} from '../utils/storage.js';
import EpsBlockSummary from '../components/EpsBlockSummary.jsx';
import MagboardSheetSummary from '../components/MagboardSheetSummary.jsx';
import GlueSummary from '../components/GlueSummary.jsx';

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [walls, setWalls] = useState([]);
  const [renamingProject, setRenamingProject] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [copyingWallId, setCopyingWallId] = useState(null);

  useEffect(() => {
    const projects = getProjects();
    const p = projects.find(p => p.id === projectId);
    if (!p) {
      navigate('/', { replace: true });
      return;
    }
    setProject(p);
    setWalls(getProjectWalls(projectId));
  }, [projectId, navigate]);

  const refresh = () => {
    setWalls(getProjectWalls(projectId));
    const p = getProjects().find(p => p.id === projectId);
    if (p) setProject(p);
  };

  const handleDeleteWall = (wallId, e) => {
    e.stopPropagation();
    deleteWall(projectId, wallId);
    refresh();
  };

  const handleRename = () => {
    if (renameValue.trim()) {
      renameProject(projectId, renameValue.trim());
      refresh();
    }
    setRenamingProject(false);
  };

  const handleCopyWall = (wall, targetProjectId) => {
    copyWallToProject(wall, targetProjectId);
    setCopyingWallId(null);
    refresh();
  };

  if (!project) return null;

  const otherProjects = getProjects().filter(p => p.id !== projectId);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Breadcrumb + header */}
        <div style={styles.topBar}>
          <button onClick={() => navigate('/')} style={styles.backBtn}>
            &larr; Projects
          </button>
        </div>

        <div style={styles.header}>
          <div style={styles.headerLeft}>
            {renamingProject ? (
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleRename}
                onKeyDown={e => e.key === 'Enter' && handleRename()}
                style={styles.renameInput}
                autoFocus
              />
            ) : (
              <h1
                style={styles.title}
                onClick={() => { setRenamingProject(true); setRenameValue(project.name); }}
                title="Click to rename"
              >
                {project.name}
              </h1>
            )}
            <p style={styles.subtitle}>
              {walls.length} wall{walls.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => navigate(`/project/${projectId}/wall/new`)}
            style={styles.newWallBtn}
          >
            + New Wall
          </button>
        </div>

        {/* Material Summaries */}
        {walls.length > 0 && <EpsBlockSummary walls={walls} />}
        {walls.length > 0 && <MagboardSheetSummary walls={walls} />}
        {walls.length > 0 && <GlueSummary walls={walls} />}

        {/* Wall list */}
        {walls.length === 0 ? (
          <div style={styles.empty}>
            <p style={styles.emptyText}>No walls yet</p>
            <p style={styles.emptyHint}>Create a wall to start designing.</p>
          </div>
        ) : (
          <div style={styles.wallList}>
            {walls.map(w => (
              <div key={w.id}>
                <div
                  style={styles.wallCard}
                  onClick={() => navigate(`/project/${projectId}/wall/${w.id}`)}
                >
                  <div style={styles.wallBody}>
                    <div style={styles.wallName}>{w.name}</div>
                    <div style={styles.wallMeta}>
                      <span>{w.length_mm} x {w.height_mm} mm</span>
                      {w.openings?.length > 0 && (
                        <span> &middot; {w.openings.length} opening{w.openings.length > 1 ? 's' : ''}</span>
                      )}
                      <span style={styles.wallProfile}>
                        {w.profile === 'raked' ? 'Raked' : w.profile === 'gable' ? 'Gable' : 'Standard'}
                      </span>
                    </div>
                  </div>
                  <div style={styles.wallRight}>
                    <span style={styles.wallDate}>{new Date(w.updatedAt).toLocaleDateString()}</span>
                    <div style={styles.wallActions}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCopyingWallId(copyingWallId === w.id ? null : w.id);
                        }}
                        style={styles.actionBtn}
                      >
                        Copy to...
                      </button>
                      <button onClick={(e) => handleDeleteWall(w.id, e)} style={styles.deleteBtn}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
                {copyingWallId === w.id && (
                  <div style={styles.copyRow}>
                    <span style={styles.copyLabel}>Copy to:</span>
                    {otherProjects.length === 0 ? (
                      <span style={styles.copyNone}>No other projects</span>
                    ) : (
                      otherProjects.map(tp => (
                        <button
                          key={tp.id}
                          onClick={() => handleCopyWall(w, tp.id)}
                          style={styles.copyTargetBtn}
                        >
                          {tp.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
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
    background: '#f0f2f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '0 24px',
  },
  topBar: {
    padding: '20px 0 0',
  },
  backBtn: {
    padding: '6px 12px',
    background: 'none',
    color: '#2C5F8A',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '12px 0 24px',
  },
  headerLeft: {},
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#1a1a1a',
    cursor: 'pointer',
  },
  renameInput: {
    padding: '4px 8px',
    fontSize: 24,
    fontWeight: 700,
    border: '1px solid #2C5F8A',
    borderRadius: 4,
    outline: 'none',
    width: '100%',
    maxWidth: 400,
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 14,
    color: '#888',
  },
  newWallBtn: {
    padding: '10px 20px',
    background: '#2C5F8A',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  // Empty
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    background: '#fff',
    borderRadius: 8,
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
    color: '#999',
    margin: 0,
  },

  // Wall list
  wallList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  wallCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e0e0e0',
    padding: '14px 20px',
    cursor: 'pointer',
  },
  wallBody: {
    flex: 1,
    minWidth: 0,
  },
  wallName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  wallMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  wallProfile: {
    padding: '1px 6px',
    background: '#f0f2f5',
    borderRadius: 3,
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  wallRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 16,
    flexShrink: 0,
  },
  wallDate: {
    fontSize: 11,
    color: '#999',
  },
  wallActions: {
    display: 'flex',
    gap: 6,
  },
  actionBtn: {
    padding: '4px 10px',
    background: '#f5f6f8',
    color: '#555',
    border: '1px solid #e0e0e0',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500,
  },
  deleteBtn: {
    padding: '4px 10px',
    background: '#fff5f5',
    color: '#e74c3c',
    border: '1px solid #fdd',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500,
  },

  // Copy row
  copyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 20px',
    background: '#f8f9fa',
    borderRadius: '0 0 8px 8px',
    borderTop: '1px dashed #e0e0e0',
    flexWrap: 'wrap',
    marginTop: -1,
  },
  copyLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: 500,
  },
  copyNone: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  copyTargetBtn: {
    padding: '4px 10px',
    background: '#2C5F8A',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  },
};
