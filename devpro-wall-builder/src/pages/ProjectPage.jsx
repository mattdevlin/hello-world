import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Copy } from 'lucide-react';
import {
  getProjects, getProjectWalls, deleteWall, renameProject,
  copyWallToProject, getProjectConnections, saveProjectConnections,
  getProjectPlacements, saveProjectPlacements,
  getProjectWallPositions, saveProjectWallPositions,
  getProjectFloors, deleteFloor,
  getProjectRoofs, deleteRoof,
  updateProjectDetails,
} from '../utils/storage.js';
import { TERRITORIAL_AUTHORITIES, TA_CLIMATE_ZONES, DEVPRO_WALL_R, DEVPRO_FLOOR_R, DEVPRO_ROOF_R, REFERENCE_R_VALUES, REFERENCE_TIMBER_FRACTION, getClimateZone } from '../utils/h1Constants.js';
import { computeWallTimberRatio } from '../utils/timberCalculator.js';
import { calculateFloorLayout } from '../utils/floorCalculator.js';
import { calculateRoofLayout } from '../utils/roofCalculator.js';
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
import { calculateProjectPrice } from '../utils/priceCalculator.js';

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
  const [roofs, setRoofs] = useState([]);
  const [address, setAddress] = useState('');
  const [ta, setTa] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [projectPrice, setProjectPrice] = useState(null);
  const [buildingStats, setBuildingStats] = useState(null);

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
    setRoofs(getProjectRoofs(projectId));
    setConnections(getProjectConnections(projectId));
    setPlacedWallIds(getProjectPlacements(projectId));
    setWallPositions(getProjectWallPositions(projectId));
  }, [projectId, navigate]);

  // Compute building stats (heat loss, timber %, insulation %) from design data
  useEffect(() => {
    if (walls.length === 0 && floors.length === 0 && roofs.length === 0) {
      setBuildingStats(null);
      return;
    }
    try {
      const zone = getClimateZone(ta);
      const ref = REFERENCE_R_VALUES[zone] || REFERENCE_R_VALUES[1];

      let wallAreaM2 = 0;
      let wallTimberAreaMm2 = 0;
      let wallTotalAreaMm2 = 0;
      for (const wall of walls) {
        try {
          const tr = computeWallTimberRatio(wall);
          wallAreaM2 += tr.effectiveWallArea / 1e6;
          wallTimberAreaMm2 += tr.effectiveWallArea * (tr.timberPercentage / 100);
          wallTotalAreaMm2 += tr.effectiveWallArea;
        } catch { /* skip */ }
      }

      let floorAreaM2 = 0;
      let floorTimberAreaMm2 = 0;
      let floorTotalAreaMm2 = 0;
      for (const floor of floors) {
        try {
          const layout = calculateFloorLayout(floor);
          if (layout.error) continue;
          floorAreaM2 += layout.totalArea / 1e6;
          const splineArea = [...layout.reinforcedSplines, ...layout.unreinforcedSplines]
            .reduce((s, sp) => s + sp.width * sp.length, 0);
          const plateArea = layout.perimeterPlates.reduce((s, p) => {
            const len = Math.sqrt((p.x2 - p.x1) ** 2 + (p.y2 - p.y1) ** 2);
            return s + len * layout.perimeterPlateWidth * layout.boundaryJoistCount;
          }, 0);
          floorTimberAreaMm2 += splineArea + plateArea;
          floorTotalAreaMm2 += layout.totalArea;
        } catch { /* skip */ }
      }

      let roofAreaM2 = 0;
      let roofTimberAreaMm2 = 0;
      let roofTotalAreaMm2 = 0;
      for (const roof of roofs) {
        try {
          const layout = calculateRoofLayout(roof);
          if (layout.error) continue;
          roofAreaM2 += layout.internalRoofArea / 1e6;
          roofTimberAreaMm2 += layout.splines.reduce((s, sp) => s + sp.width * sp.length, 0);
          roofTotalAreaMm2 += layout.totalPlanArea;
        } catch { /* skip */ }
      }

      // Heat loss
      const devHL = (wallAreaM2 > 0 ? wallAreaM2 / DEVPRO_WALL_R : 0)
        + (floorAreaM2 > 0 ? floorAreaM2 / DEVPRO_FLOOR_R : 0)
        + (roofAreaM2 > 0 ? roofAreaM2 / DEVPRO_ROOF_R : 0);
      const refHL = (wallAreaM2 > 0 ? wallAreaM2 / ref.wall : 0)
        + (floorAreaM2 > 0 ? floorAreaM2 / ref.otherFloor : 0)
        + (roofAreaM2 > 0 ? roofAreaM2 / ref.roof : 0);

      // Timber / insulation — weighted average across all elements
      const totalTimberArea = wallTimberAreaMm2 + floorTimberAreaMm2 + roofTimberAreaMm2;
      const totalEnvelopeArea = wallTotalAreaMm2 + floorTotalAreaMm2 + roofTotalAreaMm2;
      const devTimber = totalEnvelopeArea > 0 ? (totalTimberArea / totalEnvelopeArea) * 100 : 0;
      const devInsulation = 100 - devTimber;
      const refTimber = REFERENCE_TIMBER_FRACTION * 100;
      const refInsulation = 100 - refTimber;

      if (devHL > 0 || totalEnvelopeArea > 0) {
        setBuildingStats({ devHL, refHL, devTimber, refTimber, devInsulation, refInsulation });
      } else {
        setBuildingStats(null);
      }
    } catch { setBuildingStats(null); }
  }, [walls, floors, roofs, ta]);

  // Calculate project price whenever walls/floors/roofs change
  useEffect(() => {
    if (walls.length === 0 && floors.length === 0 && roofs.length === 0) {
      setProjectPrice(null);
      return;
    }
    let cancelled = false;
    calculateProjectPrice(walls, floors, roofs).then(price => {
      if (!cancelled) setProjectPrice(price);
    }).catch(() => {
      if (!cancelled) setProjectPrice(null);
    });
    return () => { cancelled = true; };
  }, [walls, floors, roofs]);

  const refresh = () => {
    setWalls(getProjectWalls(projectId));
    setFloors(getProjectFloors(projectId));
    setRoofs(getProjectRoofs(projectId));
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

  const handleDeleteRoof = (roofId, roofNameVal, e) => {
    e.stopPropagation();
    setConfirmDelete({ type: 'roof', id: roofId, name: roofNameVal });
  };

  const confirmDeleteItem = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'wall') {
      deleteWall(projectId, confirmDelete.id);
    } else if (confirmDelete.type === 'floor') {
      deleteFloor(projectId, confirmDelete.id);
    } else if (confirmDelete.type === 'roof') {
      deleteRoof(projectId, confirmDelete.id);
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
              {projectPrice && projectPrice.totalIncGst > 0 && (
                <span style={styles.priceTag}>
                  ${projectPrice.totalIncGst.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style={styles.priceGst}> incl GST</span>
                </span>
              )}
              </h1>
            )}
            <p style={styles.subtitle}>
              {walls.length} wall{walls.length !== 1 ? 's' : ''}
              {floors.length > 0 && ` · ${floors.length} floor${floors.length !== 1 ? 's' : ''}`}
              {roofs.length > 0 && ` · ${roofs.length} roof${roofs.length !== 1 ? 's' : ''}`}
              {projectPrice && projectPrice.totalExGst > 0 && ` · $${projectPrice.totalExGst.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + GST`}
            </p>
            {buildingStats && (
              <div style={styles.compareCards}>
                {/* Heat Loss */}
                {buildingStats.devHL > 0 && (() => {
                  const better = buildingStats.devHL <= buildingStats.refHL;
                  const pct = buildingStats.devHL > 0 ? Math.round((buildingStats.refHL / buildingStats.devHL) * 100) : 0;
                  return (
                    <div style={{ ...styles.compareCard, borderTopColor: better ? '#2E7D32' : '#E65100' }}>
                      <div style={styles.compareLabel}>Heat Loss</div>
                      <div style={styles.compareValues}>
                        <div style={styles.compareCol}>
                          <span style={styles.compareBrand}>DEVPRO</span>
                          <span style={{ ...styles.compareNum, color: better ? '#2E7D32' : '#E65100' }}>{buildingStats.devHL.toFixed(2)}</span>
                          <span style={styles.compareUnit}>W/K</span>
                        </div>
                        <div style={styles.compareDivider} />
                        <div style={styles.compareCol}>
                          <span style={styles.compareBrand}>NZBC</span>
                          <span style={{ ...styles.compareNum, color: better ? '#E65100' : '#2E7D32' }}>{buildingStats.refHL.toFixed(2)}</span>
                          <span style={styles.compareUnit}>W/K</span>
                        </div>
                      </div>
                      {better && <div style={styles.compareNote}>NZBC loses {pct}% more heat</div>}
                    </div>
                  );
                })()}
                {/* Thermal Bridging */}
                {buildingStats.devTimber > 0 && (() => {
                  const better = buildingStats.devTimber < buildingStats.refTimber;
                  const pct = buildingStats.devTimber > 0 ? Math.round((buildingStats.refTimber / buildingStats.devTimber) * 100) : 0;
                  return (
                    <div style={{ ...styles.compareCard, borderTopColor: better ? '#2E7D32' : '#E65100' }}>
                      <div style={styles.compareLabel}>Thermal Bridging</div>
                      <div style={styles.compareValues}>
                        <div style={styles.compareCol}>
                          <span style={styles.compareBrand}>DEVPRO</span>
                          <span style={{ ...styles.compareNum, color: better ? '#2E7D32' : '#E65100' }}>{buildingStats.devTimber.toFixed(1)}%</span>
                          <span style={styles.compareUnit}>timber</span>
                        </div>
                        <div style={styles.compareDivider} />
                        <div style={styles.compareCol}>
                          <span style={styles.compareBrand}>NZBC</span>
                          <span style={{ ...styles.compareNum, color: better ? '#E65100' : '#2E7D32' }}>{buildingStats.refTimber.toFixed(0)}%</span>
                          <span style={styles.compareUnit}>timber</span>
                        </div>
                      </div>
                      {better && <div style={styles.compareNote}>NZBC has {pct}% more bridging</div>}
                    </div>
                  );
                })()}
                {/* Insulation */}
                {buildingStats.devInsulation > 0 && (() => {
                  const better = buildingStats.devInsulation > buildingStats.refInsulation;
                  const pct = buildingStats.refInsulation > 0 ? Math.round(((buildingStats.devInsulation - buildingStats.refInsulation) / buildingStats.refInsulation) * 100) : 0;
                  return (
                    <div style={{ ...styles.compareCard, borderTopColor: better ? '#2E7D32' : '#E65100' }}>
                      <div style={styles.compareLabel}>Insulation Coverage</div>
                      <div style={styles.compareValues}>
                        <div style={styles.compareCol}>
                          <span style={styles.compareBrand}>DEVPRO</span>
                          <span style={{ ...styles.compareNum, color: better ? '#2E7D32' : '#E65100' }}>{buildingStats.devInsulation.toFixed(1)}%</span>
                          <span style={styles.compareUnit}>insulated</span>
                        </div>
                        <div style={styles.compareDivider} />
                        <div style={styles.compareCol}>
                          <span style={styles.compareBrand}>NZBC</span>
                          <span style={{ ...styles.compareNum, color: better ? '#E65100' : '#2E7D32' }}>{buildingStats.refInsulation.toFixed(0)}%</span>
                          <span style={styles.compareUnit}>insulated</span>
                        </div>
                      </div>
                      {better && <div style={styles.compareNote}>NZBC has {pct}% less insulation</div>}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <div style={styles.headerButtons}>
            <ExportProjectButton projectName={project.name} walls={walls} floors={floors} roofs={roofs} />
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
            <button
              onClick={() => navigate(`/project/${projectId}/roof/new`)}
              style={styles.newRoofBtn}
            >
              <Plus size={14} style={{ marginRight: 4, verticalAlign: -2 }} />New Roof
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
          {(walls.length > 0 || floors.length > 0 || roofs.length > 0) && <MagboardSheetSummary walls={walls} floors={floors} roofs={roofs} />}
          {(walls.length > 0 || floors.length > 0 || roofs.length > 0) && <EpsBlockSummary walls={walls} floors={floors} roofs={roofs} projectName={project.name} />}
          {(walls.length > 0 || floors.length > 0 || roofs.length > 0) && <GlueSummary walls={walls} floors={floors} roofs={roofs} />}
          {(walls.length > 0 || floors.length > 0 || roofs.length > 0) && <TimberTakeoffSummary walls={walls} floors={floors} roofs={roofs} />}

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

          {/* Roof list */}
          {roofs.length > 0 && (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#333', margin: '24px 0 8px' }}>Roofs</h3>
              <div style={styles.wallList}>
                {roofs.map(r => (
                  <div
                    key={r.id}
                    style={styles.wallCard}
                    onClick={() => navigate(`/project/${projectId}/roof/${r.id}`)}
                  >
                    <div style={styles.wallBody}>
                      <div style={styles.wallName}>{r.name}</div>
                      <div style={styles.wallMeta}>
                        <span>{r.length_mm} x {r.width_mm} mm</span>
                        {r.pitch_deg > 0 && <span> &middot; {r.pitch_deg}°</span>}
                        {r.penetrations?.length > 0 && (
                          <span> &middot; {r.penetrations.length} penetration{r.penetrations.length > 1 ? 's' : ''}</span>
                        )}
                        <span style={{ ...styles.wallProfile, background: '#D7CCC8' }}>
                          {r.type === 'gable' ? 'Gable' : r.type === 'skillion' ? 'Skillion' : 'Flat'}
                        </span>
                      </div>
                    </div>
                    <div style={styles.wallRight}>
                      <span style={styles.wallDate}>{new Date(r.updatedAt).toLocaleDateString()}</span>
                      <div style={styles.wallActions}>
                        <button
                          onClick={(e) => handleDeleteRoof(r.id, r.name, e)}
                          style={styles.deleteBtn}
                          aria-label={`Delete roof ${r.name}`}
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
        title={confirmDelete?.type === 'wall' ? 'Delete Wall' : confirmDelete?.type === 'floor' ? 'Delete Floor' : 'Delete Roof'}
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
    padding: '0 24px 80px',
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
  compareCards: {
    display: 'flex',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  compareCard: {
    flex: '1 1 200px',
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e8e8e8',
    borderTop: '3px solid #2E7D32',
    padding: '12px 16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  compareLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#888',
    marginBottom: 8,
  },
  compareValues: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  compareCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  },
  compareBrand: {
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#999',
  },
  compareNum: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  compareUnit: {
    fontSize: 10,
    color: '#999',
    fontWeight: 500,
  },
  compareDivider: {
    width: 1,
    height: 36,
    background: '#e0e0e0',
    flexShrink: 0,
  },
  compareNote: {
    fontSize: 10,
    color: '#E65100',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTop: '1px solid #f0f0f0',
  },
  priceTag: {
    fontSize: 18,
    fontWeight: 600,
    color: BRAND.success,
    marginLeft: 16,
    whiteSpace: 'nowrap',
  },
  priceGst: {
    fontSize: 12,
    fontWeight: 400,
    color: NEUTRAL.textMuted,
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
  newRoofBtn: {
    padding: '10px 20px',
    background: BRAND.roof,
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
