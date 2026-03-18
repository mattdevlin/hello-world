import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import FloorForm from '../components/FloorForm.jsx';
import FloorPlanView from '../components/FloorPlanView.jsx';
import FloorFramingPlan from '../components/FloorFramingPlan.jsx';
import FloorEpsPlan from '../components/FloorEpsPlan.jsx';
import FloorPanelPlans from '../components/FloorPanelPlans.jsx';
import FloorEpsCutPlans from '../components/FloorEpsCutPlans.jsx';
import FloorOffcuts from '../components/FloorOffcuts.jsx';
import SplinePanels from '../components/SplinePanels.jsx';
import { extractFloorSplinePieces, groupSplinePanels } from '../utils/splineOptimizer.js';
import FloorSummary from '../components/FloorSummary.jsx';
import CollapsibleSection from '../components/CollapsibleSection.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../hooks/useToast.js';
import { HeatLossBadge, TimberBadge, InsulationBadge } from '../components/ThermalBadge.jsx';
import { calculateFloorLayout } from '../utils/floorCalculator.js';
import { getProjects, getProjectFloors, saveFloor } from '../utils/storage.js';
import { DEVPRO_FLOOR_R, REFERENCE_R_VALUES, REFERENCE_TIMBER_FRACTION, getClimateZone } from '../utils/h1Constants.js';
import { FONT_STACK, BRAND, NEUTRAL, RADIUS } from '../utils/designTokens.js';

export default function FloorBuilderPage() {
  const { projectId, floorId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [project, setProject] = useState(null);
  const [layout, setLayout] = useState(null);
  const [floorName, setFloorName] = useState('');
  const [floorInput, setFloorInput] = useState(null);
  const [loadKey, setLoadKey] = useState(0);
  const [generateKey, setGenerateKey] = useState(0);
  const [saveKey, setSaveKey] = useState(0);
  const [calcError, setCalcError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [savedSnap, setSavedSnap] = useState(null);
  const [showNavWarning, setShowNavWarning] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(null);
  const autoSaveTimer = useRef(null);
  const blockerRef = useRef(null);

  useEffect(() => {
    async function load() {
      const projects = await getProjects();
      const p = projects.find(p => p.id === projectId);
      if (!p) { navigate('/', { replace: true }); return; }
      setProject(p);

      if (floorId && floorId !== 'new') {
        const floors = await getProjectFloors(projectId);
        const floor = floors.find(f => f.id === floorId);
        if (floor) {
          setFloorInput(floor);
          setSavedSnap(JSON.stringify(floor));
          setDirty(false);
          setLoadKey(k => k + 1);
          const result = calculateFloorLayout(floor);
          if (!result.error) setLayout(result);
          setFloorName(floor.name);
        }
      } else {
        setFloorInput(null);
        setSavedSnap(null);
        setDirty(false);
        setLayout(null);
        setFloorName('');
        setLoadKey(k => k + 1);
      }
    }
    load();
  }, [projectId, floorId, navigate]);

  // Track dirty state
  const handleFloorChange = useCallback((floor) => {
    setFloorInput(floor);
    if (savedSnap && JSON.stringify(floor) !== savedSnap) {
      setDirty(true);
    }
  }, [savedSnap]);

  // Auto-save (2s debounce)
  useEffect(() => {
    if (!dirty || !floorInput || !projectId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const saved = await saveFloor(projectId, floorInput);
      setFloorInput(saved);
      setSavedSnap(JSON.stringify(saved));
      setDirty(false);
      setSaveIndicator('Saved');
      setTimeout(() => setSaveIndicator(null), 2000);
      if (!floorId || floorId === 'new') {
        navigate(`/project/${projectId}/floor/${saved.id}`, { replace: true });
      }
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [dirty, floorInput, projectId, floorId, navigate]);

  // Unsaved changes: block navigation
  const blocker = useBlocker(dirty);
  useEffect(() => {
    blockerRef.current = blocker;
    if (blocker.state === 'blocked') {
      setShowNavWarning(true);
    }
  }, [blocker]);

  // Unsaved changes: beforeunload
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleCalculate = (floor) => {
    const result = calculateFloorLayout(floor);
    if (result.error) {
      setCalcError(result.error);
      return;
    }
    setCalcError(null);
    setLayout(result);
    setFloorName(floor.name);
    setFloorInput(floor);
    setGenerateKey(k => k + 1);
  };

  const handleSave = async () => {
    if (!floorInput || !projectId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const saved = await saveFloor(projectId, floorInput);
    setFloorInput(saved);
    setSavedSnap(JSON.stringify(saved));
    setDirty(false);
    setSaveKey(k => k + 1);
    setSaveIndicator('Saved');
    setTimeout(() => setSaveIndicator(null), 2000);
    showToast({ type: 'success', message: 'Floor saved.' });
    if (!floorId || floorId === 'new') {
      navigate(`/project/${projectId}/floor/${saved.id}`, { replace: true });
    }
  };

  // Keyboard shortcuts
  const handleSaveRef = useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; });
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleNavConfirm = (action) => {
    setShowNavWarning(false);
    if (action === 'save') {
      handleSave();
      blockerRef.current?.proceed?.();
    } else if (action === 'discard') {
      setDirty(false);
      blockerRef.current?.proceed?.();
    } else {
      blockerRef.current?.reset?.();
    }
  };

  if (!project) return null;

  // Compute stats for header badges
  const zone = getClimateZone(project.territorialAuthority);
  const ref = REFERENCE_R_VALUES[zone] || REFERENCE_R_VALUES[1];
  const refTimber = REFERENCE_TIMBER_FRACTION * 100;

  const computeFloorTimberStats = () => {
    if (!layout) return null;
    const splineArea = [...layout.reinforcedSplines, ...layout.unreinforcedSplines]
      .reduce((sum, s) => sum + s.width * s.length, 0);
    const plateArea = layout.perimeterPlates.reduce((sum, p) => {
      const len = Math.sqrt((p.x2 - p.x1) ** 2 + (p.y2 - p.y1) ** 2);
      return sum + len * layout.perimeterPlateWidth * layout.boundaryJoistCount;
    }, 0);
    const timberPct = layout.totalArea > 0 ? (splineArea + plateArea) / layout.totalArea * 100 : 0;
    const insPct = layout.totalArea > 0 ? (1 - (splineArea + plateArea) / layout.totalArea) * 100 : 0;
    return { timberPct, insPct };
  };

  const floorStats = computeFloorTimberStats();

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <div style={styles.headerLeft}>
            <button onClick={() => navigate(`/project/${projectId}`)} style={styles.backBtn} aria-label={`Back to ${project.name}`}>
              &larr; {project.name}
            </button>
            {floorName && <span style={styles.floorLabel}>{floorName}</span>}
            {saveIndicator && <span style={styles.saveIndicator}>{saveIndicator}</span>}
            {dirty && !saveIndicator && <span style={styles.dirtyIndicator}>Unsaved</span>}
          </div>
          <div style={styles.headerActions}>
            <button
              onClick={() => navigate(`/project/${projectId}/floor/new`)}
              style={styles.newBtn}
            >
              + New Floor
            </button>
            {floorInput && (
              <button onClick={handleSave} style={styles.saveBtn} title="Ctrl+S">
                Save Floor
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} style={styles.main}>
        <CollapsibleSection sectionKey="floorDimensions" title="Floor Dimensions" forceOpen={generateKey} forceCollapse={saveKey}>
          <FloorForm
            key={loadKey}
            onCalculate={handleCalculate}
            onChange={handleFloorChange}
            initialFloor={floorInput}
          />
        </CollapsibleSection>

        {calcError && (
          <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginTop: 16, color: '#991b1b', fontSize: 14 }}>
            {calcError}
          </div>
        )}

        {layout && (
          <>
            <CollapsibleSection sectionKey="floorPlan" title="Floor Plan View" forceOpen={generateKey}
              headerRight={(() => {
                const areaM2 = layout.totalArea / 1e6;
                const devHL = areaM2 / DEVPRO_FLOOR_R;
                const refHL = areaM2 / ref.otherFloor;
                return <HeatLossBadge devHL={devHL} refHL={refHL} />;
              })()}>
              <FloorPlanView layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorFraming" title="Floor Framing Plan" forceOpen={generateKey}
              headerRight={floorStats && <TimberBadge devTimber={floorStats.timberPct} refTimber={refTimber} />}>
              <FloorFramingPlan layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorEps" title="EPS Plan" defaultCollapsed forceOpen={generateKey}
              headerRight={floorStats && <InsulationBadge devIns={floorStats.insPct} refIns={(1 - REFERENCE_TIMBER_FRACTION) * 100} />}>
              <FloorEpsPlan layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorPanelPlans" title="Panel Cut Plans" defaultCollapsed>
              <FloorPanelPlans layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorEpsCutPlans" title="EPS Cut Plans" defaultCollapsed>
              <FloorEpsCutPlans layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorSplinePanels" title="Spline Panels" defaultCollapsed>
              <SplinePanels splinePanels={groupSplinePanels(extractFloorSplinePieces(layout))} systemLabel="Floor" name={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorOffcuts" title="Offcuts" defaultCollapsed>
              <FloorOffcuts layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorSummary" title="Floor Summary">
              <FloorSummary layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
          </>
        )}
      </main>

      <ConfirmDialog
        open={showNavWarning}
        title="Unsaved Changes"
        message="You have unsaved changes. Would you like to save before leaving?"
        confirmLabel="Save & Leave"
        cancelLabel="Discard"
        danger={false}
        onConfirm={() => handleNavConfirm('save')}
        onCancel={() => handleNavConfirm('discard')}
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
  header: {
    background: BRAND.floor,
    padding: '12px 32px',
    color: '#fff',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 1280,
    margin: '0 auto',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: RADIUS.sm,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  floorLabel: {
    fontSize: 16,
    fontWeight: 600,
    opacity: 0.9,
  },
  saveIndicator: {
    fontSize: 12,
    fontWeight: 500,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  dirtyIndicator: {
    fontSize: 12,
    fontWeight: 500,
    opacity: 0.6,
    background: 'rgba(255,255,255,0.15)',
    padding: '2px 8px',
    borderRadius: RADIUS.sm,
  },
  headerActions: {
    display: 'flex',
    gap: 8,
  },
  newBtn: {
    padding: '8px 20px',
    background: BRAND.warning,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.sm,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  saveBtn: {
    padding: '8px 20px',
    background: BRAND.success,
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS.sm,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  main: {
    maxWidth: 1280,
    margin: '24px auto',
    padding: '0 24px',
    outline: 'none',
  },
};
