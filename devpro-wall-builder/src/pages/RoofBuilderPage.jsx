import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import RoofForm from '../components/RoofForm.jsx';
import RoofPlanView from '../components/RoofPlanView.jsx';
import RoofSlopeView from '../components/RoofSlopeView.jsx';
import RoofSummary from '../components/RoofSummary.jsx';
import RoofPanelPlans from '../components/RoofPanelPlans.jsx';
import RoofEpsCutPlans from '../components/RoofEpsCutPlans.jsx';
import RoofOffcuts from '../components/RoofOffcuts.jsx';
import SplinePanels from '../components/SplinePanels.jsx';
import { extractRoofSplinePieces, groupSplinePanels } from '../utils/splineOptimizer.js';
import CollapsibleSection from '../components/CollapsibleSection.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../hooks/useToast.js';
import { HeatLossBadge, TimberBadge, InsulationBadge } from '../components/ThermalBadge.jsx';
import { calculateRoofLayout, detectRoofType } from '../utils/roofCalculator.js';
import { getProjects, getProjectRoofs, saveRoof, getProjectWalls, getProjectFloors } from '../utils/storage.js';
import { DEVPRO_ROOF_R, REFERENCE_R_VALUES, REFERENCE_TIMBER_FRACTION, getClimateZone } from '../utils/h1Constants.js';
import { FONT_STACK, BRAND, NEUTRAL, RADIUS } from '../utils/designTokens.js';

export default function RoofBuilderPage() {
  const { projectId, roofId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [project, setProject] = useState(null);
  const [layout, setLayout] = useState(null);
  const [roofName, setRoofName] = useState('');
  const [roofInput, setRoofInput] = useState(null);
  const [loadKey, setLoadKey] = useState(0);
  const [generateKey, setGenerateKey] = useState(0);
  const [saveKey, setSaveKey] = useState(0);
  const [calcError, setCalcError] = useState(null);
  const [detectedType, setDetectedType] = useState(null);
  const [projectWalls, setProjectWalls] = useState([]);
  const [projectFloors, setProjectFloors] = useState([]);
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

      // Load project walls and floors for auto-detection and defaults
      const [walls, floors] = await Promise.all([
        getProjectWalls(projectId),
        getProjectFloors(projectId),
      ]);
      setProjectWalls(walls);
      setProjectFloors(floors);
      const detected = detectRoofType(walls);
      setDetectedType(detected);

      if (roofId && roofId !== 'new') {
        const roofs = await getProjectRoofs(projectId);
        const roof = roofs.find(r => r.id === roofId);
        if (roof) {
          setRoofInput(roof);
          setSavedSnap(JSON.stringify(roof));
          setDirty(false);
          setLoadKey(k => k + 1);
          const result = calculateRoofLayout(roof, walls);
          if (!result.error) setLayout(result);
          setRoofName(roof.name);
        }
      } else {
        setRoofInput(null);
        setSavedSnap(null);
        setDirty(false);
        setLayout(null);
        setRoofName('');
        setLoadKey(k => k + 1);
      }
    }
    load();
  }, [projectId, roofId, navigate]);

  // Track dirty state
  const handleRoofChange = useCallback((roof) => {
    setRoofInput(roof);
    if (savedSnap && JSON.stringify(roof) !== savedSnap) {
      setDirty(true);
    }
  }, [savedSnap]);

  // Auto-save (2s debounce)
  useEffect(() => {
    if (!dirty || !roofInput || !projectId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const saved = await saveRoof(projectId, roofInput);
      setRoofInput(saved);
      setSavedSnap(JSON.stringify(saved));
      setDirty(false);
      setSaveIndicator('Saved');
      setTimeout(() => setSaveIndicator(null), 2000);
      if (!roofId || roofId === 'new') {
        navigate(`/project/${projectId}/roof/${saved.id}`, { replace: true });
      }
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [dirty, roofInput, projectId, roofId, navigate]);

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

  const handleCalculate = async (roof) => {
    const walls = await getProjectWalls(projectId);
    const result = calculateRoofLayout(roof, walls);
    if (result.error) {
      setCalcError(result.error);
      return;
    }
    setCalcError(null);
    setLayout(result);
    setRoofName(roof.name);
    setRoofInput(roof);
    setGenerateKey(k => k + 1);
  };

  const handleSave = async () => {
    if (!roofInput || !projectId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const saved = await saveRoof(projectId, roofInput);
    setRoofInput(saved);
    setSavedSnap(JSON.stringify(saved));
    setDirty(false);
    setSaveKey(k => k + 1);
    setSaveIndicator('Saved');
    setTimeout(() => setSaveIndicator(null), 2000);
    showToast({ type: 'success', message: 'Roof saved.' });
    if (!roofId || roofId === 'new') {
      navigate(`/project/${projectId}/roof/${saved.id}`, { replace: true });
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

  const splineArea = layout
    ? layout.splines.reduce((sum, s) => sum + s.width * s.length, 0)
    : 0;
  const totalPlaneArea = layout ? layout.totalPlanArea : 0;
  const roofTimberPct = totalPlaneArea > 0 ? (splineArea / totalPlaneArea) * 100 : 0;
  const roofInsPct = totalPlaneArea > 0 ? (1 - splineArea / totalPlaneArea) * 100 : 0;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <div style={styles.headerLeft}>
            <button onClick={() => navigate(`/project/${projectId}`)} style={styles.backBtn} aria-label={`Back to ${project.name}`}>
              &larr; {project.name}
            </button>
            {roofName && <span style={styles.roofLabel}>{roofName}</span>}
            {saveIndicator && <span style={styles.saveIndicator}>{saveIndicator}</span>}
            {dirty && !saveIndicator && <span style={styles.dirtyIndicator}>Unsaved</span>}
          </div>
          <div style={styles.headerActions}>
            <button
              onClick={() => navigate(`/project/${projectId}/roof/new`)}
              style={styles.newBtn}
            >
              + New Roof
            </button>
            {roofInput && (
              <button onClick={handleSave} style={styles.saveBtn} title="Ctrl+S">
                Save Roof
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} style={styles.main}>
        <CollapsibleSection sectionKey="roofDimensions" title="Roof Dimensions" forceOpen={generateKey} forceCollapse={saveKey}>
          <RoofForm
            key={loadKey}
            onCalculate={handleCalculate}
            onChange={handleRoofChange}
            initialRoof={roofInput}
            detectedType={detectedType}
            projectWalls={projectWalls}
            projectFloors={projectFloors}
          />
        </CollapsibleSection>

        {calcError && (
          <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginTop: 16, color: '#991b1b', fontSize: 14 }}>
            {calcError}
          </div>
        )}

        {layout && (
          <>
            {/* Roof Plan View — heat loss comparison */}
            <CollapsibleSection sectionKey="roofPlan" title="Roof Plan View" forceOpen={generateKey}
              headerRight={(() => {
                const areaM2 = layout.internalRoofArea / 1e6;
                const devHL = areaM2 / DEVPRO_ROOF_R;
                const refHL = areaM2 / ref.roof;
                return <HeatLossBadge devHL={devHL} refHL={refHL} />;
              })()}>
              <RoofPlanView layout={layout} roofName={roofName} projectName={project.name} />
            </CollapsibleSection>

            {/* Framing Plan — timber fraction comparison */}
            <CollapsibleSection sectionKey="roofFraming" title="Roof Framing Plan" forceOpen={generateKey}
              headerRight={<TimberBadge devTimber={roofTimberPct} refTimber={refTimber} />}>
              <RoofSlopeView layout={layout} roofName={roofName} projectName={project.name} mode="framing" />
            </CollapsibleSection>

            {/* EPS Plan — insulation fraction comparison */}
            <CollapsibleSection sectionKey="roofEps" title="EPS Plan" defaultCollapsed forceOpen={generateKey}
              headerRight={<InsulationBadge devIns={roofInsPct} refIns={(1 - REFERENCE_TIMBER_FRACTION) * 100} />}>
              <RoofSlopeView layout={layout} roofName={roofName} projectName={project.name} mode="eps" />
            </CollapsibleSection>

            {/* Panel Cut Plans — no longer forced open on generate */}
            <CollapsibleSection sectionKey="roofPanelPlans" title="Panel Cut Plans" defaultCollapsed>
              <RoofPanelPlans layout={layout} roofName={roofName} projectName={project.name} />
            </CollapsibleSection>

            {/* EPS Cut Plans */}
            <CollapsibleSection sectionKey="roofEpsCutPlans" title="EPS Cut Plans" defaultCollapsed>
              <RoofEpsCutPlans layout={layout} roofName={roofName} projectName={project.name} />
            </CollapsibleSection>

            {/* Spline Panels */}
            <CollapsibleSection sectionKey="roofSplinePanels" title="Spline Panels" defaultCollapsed>
              <SplinePanels splinePanels={groupSplinePanels(extractRoofSplinePieces(layout))} systemLabel="Roof" name={roofName} projectName={project.name} />
            </CollapsibleSection>

            {/* Offcuts */}
            <CollapsibleSection sectionKey="roofOffcuts" title="Offcuts" defaultCollapsed>
              <RoofOffcuts layout={layout} roofName={roofName} projectName={project.name} />
            </CollapsibleSection>

            <CollapsibleSection sectionKey="roofSummary" title="Roof Summary">
              <RoofSummary layout={layout} roofName={roofName} projectName={project.name} />
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
    background: BRAND.roof,
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
  roofLabel: {
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
