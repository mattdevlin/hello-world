import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import WallForm from '../components/WallForm.jsx';
import WallDrawing from '../components/WallDrawing.jsx';
import WallSummary from '../components/WallSummary.jsx';
import PanelPlans from '../components/PanelPlans.jsx';
import FramingElevation from '../components/FramingElevation.jsx';
import EpsElevation from '../components/EpsElevation.jsx';
import EpsCutPlans from '../components/EpsCutPlans.jsx';
import Offcuts from '../components/Offcuts.jsx';
import StickframeElevation from '../components/StickframeElevation.jsx';
import CollapsibleSection from '../components/CollapsibleSection.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../hooks/useToast.js';
import { calculateWallLayout } from '../utils/calculator.js';
import { computeWallTimberRatio } from '../utils/timberCalculator.js';
import { calculateStickframeLayout } from '../utils/stickframeCalculator.js';
import { REFERENCE_TIMBER_FRACTION, DEVPRO_WALL_R, REFERENCE_R_VALUES, getClimateZone } from '../utils/h1Constants.js';
import { getProjects, getProjectWalls, saveWall, getProjectH1 } from '../utils/storage.js';
import { checkH1Compliance } from '../utils/h1Calculator.js';
import { FONT_STACK, BRAND, NEUTRAL, RADIUS } from '../utils/designTokens.js';

function computeWallHeatLoss(projectId) {
  try {
    const h1Input = getProjectH1(projectId);
    if (!h1Input) return null;
    const result = checkH1Compliance(h1Input);
    if (result.error || !result.breakdown?.wall) return null;
    const devproHL = result.breakdown.wall.heatLoss;
    const refHL = result.referenceBreakdown?.wall?.heatLoss;
    if (devproHL == null) return null;
    return { devpro: devproHL, reference: refHL ?? null };
  } catch { return null; }
}

export default function WallBuilderPage() {
  const { projectId, wallId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [project, setProject] = useState(null);
  const [layout, setLayout] = useState(null);
  const [wallName, setWallName] = useState('');
  const [wallInput, setWallInput] = useState(null);
  const [loadKey, setLoadKey] = useState(0);
  const [generateKey, setGenerateKey] = useState(0);
  const [timberRatio, setTimberRatio] = useState(null);
  const [stickframeLayout, setStickframeLayout] = useState(null);
  const [saveKey, setSaveKey] = useState(0);
  const [wallHeatLoss, setWallHeatLoss] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [savedSnap, setSavedSnap] = useState(null);
  const [showNavWarning, setShowNavWarning] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(null);
  const autoSaveTimer = useRef(null);
  const blockerRef = useRef(null);

  useEffect(() => {
    const p = getProjects().find(p => p.id === projectId);
    if (!p) { navigate('/', { replace: true }); return; }
    setProject(p);

    if (wallId && wallId !== 'new') {
      const walls = getProjectWalls(projectId);
      const wall = walls.find(w => w.id === wallId);
      if (wall) {
        setWallInput(wall);
        setSavedSnap(JSON.stringify(wall));
        setDirty(false);
        setLoadKey(k => k + 1);
        const result = calculateWallLayout(wall);
        setLayout(result);
        setWallName(wall.name);
        try {
          const tr = computeWallTimberRatio(wall);
          setTimberRatio(tr);
          setWallHeatLoss(computeWallHeatLoss(projectId));
        } catch (err) { console.warn('Failed to compute timber ratio:', err); setTimberRatio(null); setWallHeatLoss(null); }
        try { setStickframeLayout(calculateStickframeLayout(wall)); } catch (err) { console.warn('Failed to compute stickframe layout:', err); setStickframeLayout(null); }
      }
    } else {
      setWallInput(null);
      setSavedSnap(null);
      setDirty(false);
      setLayout(null);
      setWallName('');
      setTimberRatio(null);
      setStickframeLayout(null);
      setWallHeatLoss(null);
      setLoadKey(k => k + 1);
    }
  }, [projectId, wallId, navigate]);

  // Track dirty state
  const handleWallChange = useCallback((wall) => {
    setWallInput(wall);
    if (savedSnap && JSON.stringify(wall) !== savedSnap) {
      setDirty(true);
    }
  }, [savedSnap]);

  // Auto-save (2s debounce)
  useEffect(() => {
    if (!dirty || !wallInput || !projectId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const saved = saveWall(projectId, wallInput);
      setWallInput(saved);
      setSavedSnap(JSON.stringify(saved));
      setDirty(false);
      setSaveIndicator('Saved');
      setTimeout(() => setSaveIndicator(null), 2000);
      if (!wallId || wallId === 'new') {
        navigate(`/project/${projectId}/wall/${saved.id}`, { replace: true });
      }
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [dirty, wallInput, projectId, wallId, navigate]);

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

  const handleCalculate = (wall) => {
    const result = calculateWallLayout(wall);
    setLayout(result);
    setWallName(wall.name);
    setWallInput(wall);
    setGenerateKey(k => k + 1);
    try {
      const tr = computeWallTimberRatio(wall);
      setTimberRatio(tr);
      setWallHeatLoss(computeWallHeatLoss(projectId));
    } catch (err) { console.warn('Failed to compute timber ratio:', err); setTimberRatio(null); setWallHeatLoss(null); }
    try { setStickframeLayout(calculateStickframeLayout(wall)); } catch (err) { console.warn('Failed to compute stickframe layout:', err); setStickframeLayout(null); }
  };

  const handleSave = () => {
    if (!wallInput || !projectId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const saved = saveWall(projectId, wallInput);
    setWallInput(saved);
    setSavedSnap(JSON.stringify(saved));
    setDirty(false);
    setSaveKey(k => k + 1);
    setSaveIndicator('Saved');
    setTimeout(() => setSaveIndicator(null), 2000);
    showToast({ type: 'success', message: 'Wall saved.' });
    if (!wallId || wallId === 'new') {
      navigate(`/project/${projectId}/wall/${saved.id}`, { replace: true });
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

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <div style={styles.headerLeft}>
            <button onClick={() => navigate(`/project/${projectId}`)} style={styles.backBtn} aria-label={`Back to ${project.name}`}>
              &larr; {project.name}
            </button>
            {wallName && <span style={styles.wallLabel}>{wallName}</span>}
            {saveIndicator && <span style={styles.saveIndicator}>{saveIndicator}</span>}
            {dirty && !saveIndicator && <span style={styles.dirtyIndicator}>Unsaved</span>}
          </div>
          <div style={styles.headerActions}>
            <button
              onClick={() => navigate(`/project/${projectId}/wall/new`)}
              style={styles.newBtn}
            >
              + New Wall
            </button>
            {wallInput && (
              <button onClick={handleSave} style={styles.saveBtn} title="Ctrl+S">
                Save Wall
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} style={styles.main}>
        <CollapsibleSection sectionKey="wallDimensions" title="Wall Dimensions" forceOpen={generateKey} forceCollapse={saveKey}>
          <WallForm
            key={loadKey}
            onCalculate={handleCalculate}
            onChange={handleWallChange}
            initialWall={wallInput}
          />
        </CollapsibleSection>

        {layout && (
          <>
            <CollapsibleSection sectionKey="wallDrawing" title="External Elevation" forceOpen={generateKey}
              headerRight={timberRatio && (() => {
                const zone = getClimateZone(project.territorialAuthority);
                const ref = REFERENCE_R_VALUES[zone] || REFERENCE_R_VALUES[1];
                const areaM2 = timberRatio.effectiveWallArea / 1e6;
                const devHL = areaM2 / DEVPRO_WALL_R;
                const refHL = areaM2 / ref.wall;
                const devBetter = devHL < refHL;
                const pctMore = devHL > 0 ? Math.round((refHL / devHL) * 100) : 0;
                return (
                  <span style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 500, alignItems: 'baseline' }}>
                    <span style={{ color: devBetter ? '#2E7D32' : '#E65100' }}>DEVPRO: {devHL.toFixed(2)} W/K</span>
                    <span style={{ color: devBetter ? '#E65100' : '#2E7D32' }}>NZBC: {refHL.toFixed(2)} W/K</span>
                    {devBetter && <span style={{ fontSize: 11, color: '#E65100', fontStyle: 'italic' }}>NZBC loses {pctMore}% more heat</span>}
                  </span>
                );
              })()}>
              <WallDrawing layout={layout} wallName={wallName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="framing" title="Framing Elevation" forceOpen={generateKey} headerRight={timberRatio && (
                <span style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 500 }}>
                  <span style={{ color: timberRatio.timberPercentage < REFERENCE_TIMBER_FRACTION * 100 ? '#2E7D32' : '#E65100' }}>DEVPRO: {timberRatio.timberPercentage.toFixed(1)}% timber</span>
                  <span style={{ color: REFERENCE_TIMBER_FRACTION * 100 > timberRatio.timberPercentage ? '#E65100' : '#2E7D32' }}>NZBC: {(REFERENCE_TIMBER_FRACTION * 100).toFixed(0)}% timber</span>
                </span>
              )}>
              <FramingElevation layout={layout} wallName={wallName} projectName={project.name} timberRatio={timberRatio} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="eps" title="EPS Elevation" defaultCollapsed forceOpen={generateKey} headerRight={timberRatio && (
                <span style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 500 }}>
                  <span style={{ color: timberRatio.insulationPercentage > (1 - REFERENCE_TIMBER_FRACTION) * 100 ? '#2E7D32' : '#E65100' }}>DEVPRO: {timberRatio.insulationPercentage.toFixed(1)}% insulation</span>
                  <span style={{ color: (1 - REFERENCE_TIMBER_FRACTION) * 100 < timberRatio.insulationPercentage ? '#E65100' : '#2E7D32' }}>NZBC: {((1 - REFERENCE_TIMBER_FRACTION) * 100).toFixed(0)}% insulation</span>
                </span>
              )}>
              <EpsElevation layout={layout} wallName={wallName} projectName={project.name} timberRatio={timberRatio} />
            </CollapsibleSection>
            {stickframeLayout && (
              <CollapsibleSection sectionKey="stickframe" title="NZS 3604 Stickframe Elevation" forceOpen={generateKey} headerRight={stickframeLayout.thermalRatio && timberRatio && (
                  <span style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 500 }}>
                    <span style={{ color: '#2E7D32' }}>DEVPRO: {timberRatio.timberPercentage.toFixed(1)}% timber</span>
                    <span style={{ color: '#E65100' }}>Stickframe: {stickframeLayout.thermalRatio.timberPercentage.toFixed(1)}% timber</span>
                  </span>
                )}>
                <StickframeElevation stickframeLayout={stickframeLayout} wallName={wallName} projectName={project.name} />
              </CollapsibleSection>
            )}
            <CollapsibleSection sectionKey="panelPlans" title="CNC Panel Plans" defaultCollapsed>
              <PanelPlans layout={layout} wallName={wallName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="epsCutPlans" title="EPS Cut Plans" defaultCollapsed>
              <EpsCutPlans layout={layout} wallName={wallName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="offcuts" title="Offcuts" defaultCollapsed>
              <Offcuts layout={layout} wallName={wallName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="summary" title="Wall Summary">
              <WallSummary layout={layout} wallName={wallName} projectName={project.name} />
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
    background: BRAND.primary,
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
  wallLabel: {
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
