import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Copy } from 'lucide-react';
import {
  getProjects, getProjectWalls, deleteWall, renameProject,
  copyWallToProject, getProjectConnections, saveProjectConnections,
  getProjectPlacements, saveProjectPlacements,
  getProjectWallPositions, saveProjectWallPositions,
  getProjectFloors, deleteFloor, updateProjectDetails,
} from '../utils/storage.js';
import { TERRITORIAL_AUTHORITIES, TA_CLIMATE_ZONES } from '../utils/h1Constants.js';
import EpsBlockSummary from '../components/EpsBlockSummary.jsx';
import MagboardSheetSummary from '../components/MagboardSheetSummary.jsx';
import GlueSummary from '../components/GlueSummary.jsx';
import TimberTakeoffSummary from '../components/TimberTakeoffSummary.jsx';
import ModelViewer3D from '../components/ModelViewer3D.jsx';
import CollapsibleSection from '../components/CollapsibleSection.jsx';
import ProjectWallSummary from '../components/ProjectWallSummary.jsx';
import ExportProjectButton from '../components/ExportProjectButton.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../hooks/useToast.js';
import { FONT_STACK, BRAND, NEUTRAL, RADIUS, SHADOW } from '../utils/designTokens.js';

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const [project, setProject] = useState(null);
  const [walls, setWalls] = useState([]);
  const [renamingProject, setRenamingProject] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [copyingWallId, setCopyingWallId] = useState(null);
  const [connections, setConnections] = useState([]);
  const [placedWallIds, setPlacedWallIds] = useState([]);
  const [wallPositions, setWallPositions] = useState({});
  const [floors, setFloors] = useState([]);
  const [address, setAddress] = useState('');
  const [ta, setTa] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    const projects = getProjects();
    const p = projects.find(p => p.id === projectId);
    if (!p) {
      navigate('/', { replace: true });
      return;
    }
    setProject(p);
    setAddress(p.address || '');
    setTa(p.territorialAuthority || '');
    setWalls(getProjectWalls(projectId));
    setFloors(getProjectFloors(projectId));
    setConnections(getProjectConnections(projectId));
    setPlacedWallIds(getProjectPlacements(projectId));
    setWallPositions(getProjectWallPositions(projectId));
  }, [projectId, navigate]);

  const refresh = () => {
    setWalls(getProjectWalls(projectId));
    setFloors(getProjectFloors(projectId));
    setConnections(getProjectConnections(projectId));
    setPlacedWallIds(getProjectPlacements(projectId));
    setWallPositions(getProjectWallPositions(projectId));
    const p = getProjects().find(p => p.id === projectId);
    if (p) setProject(p);
  };

  const handleConnectionsChange = (newConnections) => {
    saveProjectConnections(projectId, newConnections);
    setConnections(newConnections);
  };

  const handlePlacementsChange = (newPlacedIds) => {
    saveProjectPlacements(projectId, newPlacedIds);
    setPlacedWallIds(newPlacedIds);
  };

  const handleWallPositionsChange = (newPositions) => {
    saveProjectWallPositions(projectId, newPositions);
    setWallPositions(newPositions);
  };

  const handleDeleteWall = (wallId, wallName, e) => {
    e.stopPropagation();
    setConfirmDelete({ type: 'wall', id: wallId, name: wallName });
  };

  const handleDeleteFloor = (floorId, floorName, e) => {
    e.stopPropagation();
    setConfirmDelete({ type: 'floor', id: floorId, name: floorName });
  };

  const confirmDeleteItem = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'wall') {
      deleteWall(projectId, confirmDelete.id);
    } else {
      deleteFloor(projectId, confirmDelete.id);
    }
    refresh();
    setConfirmDelete(null);
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
    showToast({ type: 'success', message: `Wall copied successfully.` });
  };

  const handleAddressBlur = () => {
    updateProjectDetails(projectId, { address });
  };

  const handleTaChange = (e) => {
    const newTa = e.target.value;
    setTa(newTa);
    updateProjectDetails(projectId, { territorialAuthority: newTa });
  };

  if (!project) return null;

  const otherProjects = getProjects().filter(p => p.id !== projectId);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Breadcrumb */}
        <nav style={styles.topBar} aria-label="Breadcrumb">
          <button onClick={() => navigate('/')} style={styles.backBtn} aria-label="Back to projects">
            &larr; Projects
          </button>
        </nav>

        <header style={styles.header}>
          <div style={styles.headerLeft}>
            {renamingProject ? (
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleRename}
                onKeyDown={e => e.key === 'Enter' && handleRename()}
                style={styles.renameInput}
                aria-label="Rename project"
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
              {floors.length > 0 && ` · ${floors.length} floor${floors.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div style={styles.headerButtons}>
            <ExportProjectButton projectName={project.name} walls={walls} floors={floors} />
            <button
              onClick={() => navigate(`/project/${projectId}/h1`)}
              style={styles.h1Btn}
            >
              H1 Calculator
            </button>
            <button
              onClick={() => navigate(`/project/${projectId}/wall/new`)}
              style={styles.newWallBtn}
            >
              <Plus size={14} style={{ marginRight: 4, verticalAlign: -2 }} />New Wall
            </button>
            <button
              onClick={() => navigate(`/project/${projectId}/floor/new`)}
              style={styles.newFloorBtn}
            >
              <Plus size={14} style={{ marginRight: 4, verticalAlign: -2 }} />New Floor
            </button>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} style={{ outline: 'none' }}>
          {/* Location */}
          <div style={styles.locationRow}>
            <div style={styles.locationField}>
              <label style={styles.locationLabel}>Address</label>
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                onBlur={handleAddressBlur}
                placeholder="Property address"
                style={styles.locationInput}
              />
            </div>
            <div style={styles.locationField}>
              <label style={styles.locationLabel}>Territorial Authority</label>
              <input
                list="ta-list"
                value={ta}
                onChange={handleTaChange}
                placeholder="Select territorial authority"
                style={styles.locationInput}
              />
              <datalist id="ta-list">
                {TERRITORIAL_AUTHORITIES.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            {ta && TA_CLIMATE_ZONES[ta] && (
              <div style={styles.zoneBadge}>
                Zone {TA_CLIMATE_ZONES[ta]}
              </div>
            )}
          </div>

          {/* 3D Model Viewer */}
          {walls.length > 0 && (
            <CollapsibleSection sectionKey="project-3d-viewer" title="3D Model Viewer" defaultCollapsed={true}>
              <ErrorBoundary>
                <ModelViewer3D
                  walls={walls}
                  connections={connections}
                  onConnectionsChange={handleConnectionsChange}
                  placedWallIds={placedWallIds}
                  onPlacementsChange={handlePlacementsChange}
                  wallPositions={wallPositions}
                  onWallPositionsChange={handleWallPositionsChange}
                />
              </ErrorBoundary>
            </CollapsibleSection>
          )}

          {/* Wall Summary */}
          {walls.length > 0 && (
            <CollapsibleSection sectionKey="project-wall-summary" title="Wall Summary">
              <ProjectWallSummary walls={walls} projectName={project.name} />
            </CollapsibleSection>
          )}

          {/* Material Summaries */}
          {(walls.length > 0 || floors.length > 0) && <MagboardSheetSummary walls={walls} floors={floors} />}
          {(walls.length > 0 || floors.length > 0) && <EpsBlockSummary walls={walls} floors={floors} projectName={project.name} />}
          {(walls.length > 0 || floors.length > 0) && <GlueSummary walls={walls} floors={floors} />}
          {(walls.length > 0 || floors.length > 0) && <TimberTakeoffSummary walls={walls} floors={floors} />}

          {/* Wall list */}
          {walls.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyText}>No walls yet</p>
              <p style={styles.emptyHint}>Create a wall to start designing panel layouts.</p>
              <button
                onClick={() => navigate(`/project/${projectId}/wall/new`)}
                style={styles.emptyCta}
              >
                <Plus size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Create First Wall
              </button>
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
                          aria-label={`Copy wall ${w.name} to another project`}
                        >
                          <Copy size={11} style={{ marginRight: 3, verticalAlign: -1 }} />Copy to...
                        </button>
                        <button
                          onClick={(e) => handleDeleteWall(w.id, w.name, e)}
                          style={styles.deleteBtn}
                          aria-label={`Delete wall ${w.name}`}
                        >
                          <Trash2 size={11} style={{ marginRight: 3, verticalAlign: -1 }} />Delete
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

          {/* Floor list */}
          {floors.length > 0 && (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#333', margin: '24px 0 8px' }}>Floors</h3>
              <div style={styles.wallList}>
                {floors.map(f => (
                  <div
                    key={f.id}
                    style={styles.wallCard}
                    onClick={() => navigate(`/project/${projectId}/floor/${f.id}`)}
                  >
                    <div style={styles.wallBody}>
                      <div style={styles.wallName}>{f.name}</div>
                      <div style={styles.wallMeta}>
                        <span>{f.polygon?.length || 0} points</span>
                        {f.openings?.length > 0 && (
                          <span> &middot; {f.openings.length} opening{f.openings.length > 1 ? 's' : ''}</span>
                        )}
                        {f.recesses?.length > 0 && (
                          <span> &middot; {f.recesses.length} recess{f.recesses.length > 1 ? 'es' : ''}</span>
                        )}
                        <span style={{ ...styles.wallProfile, background: '#E8D5B7' }}>Floor</span>
                      </div>
                    </div>
                    <div style={styles.wallRight}>
                      <span style={styles.wallDate}>{new Date(f.updatedAt).toLocaleDateString()}</span>
                      <div style={styles.wallActions}>
                        <button
                          onClick={(e) => handleDeleteFloor(f.id, f.name, e)}
                          style={styles.deleteBtn}
                          aria-label={`Delete floor ${f.name}`}
                        >
                          <Trash2 size={11} style={{ marginRight: 3, verticalAlign: -1 }} />Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'wall' ? 'Delete Wall' : 'Delete Floor'}
        message={confirmDelete ? `Delete ${confirmDelete.type} "${confirmDelete.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={confirmDeleteItem}
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
  topBar: {
    padding: '20px 0 0',
  },
  backBtn: {
    padding: '6px 12px',
    background: 'none',
    color: BRAND.primary,
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
  headerButtons: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  headerLeft: {},
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: NEUTRAL.text,
    cursor: 'pointer',
  },
  renameInput: {
    padding: '4px 8px',
    fontSize: 24,
    fontWeight: 700,
    border: `1px solid ${BRAND.primary}`,
    borderRadius: RADIUS.sm,
    outline: 'none',
    width: '100%',
    maxWidth: 400,
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 14,
    color: NEUTRAL.textMuted,
  },
  newWallBtn: {
    padding: '10px 20px',
    background: BRAND.primary,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  newFloorBtn: {
    padding: '10px 20px',
    background: BRAND.floor,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  h1Btn: {
    padding: '10px 20px',
    background: BRAND.h1,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.md,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  // Location
  locationRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-end',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  locationField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    flex: 1,
    minWidth: 200,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: NEUTRAL.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationInput: {
    padding: '8px 12px',
    fontSize: 14,
    border: '1px solid #ddd',
    borderRadius: 6,
    background: '#fff',
    outline: 'none',
    fontFamily: 'inherit',
  },
  zoneBadge: {
    padding: '8px 16px',
    background: '#E8F5E9',
    color: '#2E7D32',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    marginBottom: 1,
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
    color: NEUTRAL.textFaint,
    margin: '0 0 16px',
  },
  emptyCta: {
    padding: '10px 20px',
    background: BRAND.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
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
    boxShadow: SHADOW.sm,
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
    color: NEUTRAL.textMuted,
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
    color: NEUTRAL.textFaint,
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
    color: NEUTRAL.textFaint,
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
