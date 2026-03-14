import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { calculateWallLayout } from '../utils/calculator.js';
import { computeWallTimberRatio } from '../utils/timberCalculator.js';
import { calculateStickframeLayout } from '../utils/stickframeCalculator.js';
import { REFERENCE_TIMBER_FRACTION } from '../utils/h1Constants.js';
import { getProjects, getProjectWalls, saveWall } from '../utils/storage.js';
import { FONT_STACK, BRAND, NEUTRAL, RADIUS } from '../utils/designTokens.js';

export default function WallBuilderPage() {
  const { projectId, wallId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [layout, setLayout] = useState(null);
  const [wallName, setWallName] = useState('');
  const [wallInput, setWallInput] = useState(null);
  const [loadKey, setLoadKey] = useState(0);
  const [generateKey, setGenerateKey] = useState(0);
  const [timberRatio, setTimberRatio] = useState(null);
  const [stickframeLayout, setStickframeLayout] = useState(null);

  useEffect(() => {
    const p = getProjects().find(p => p.id === projectId);
    if (!p) { navigate('/', { replace: true }); return; }
    setProject(p);

    if (wallId && wallId !== 'new') {
      const walls = getProjectWalls(projectId);
      const wall = walls.find(w => w.id === wallId);
      if (wall) {
        setWallInput(wall);
        setLoadKey(k => k + 1);
        const result = calculateWallLayout(wall);
        setLayout(result);
        setWallName(wall.name);
        try { setTimberRatio(computeWallTimberRatio(wall)); } catch (err) { console.warn('Failed to compute timber ratio:', err); setTimberRatio(null); }
        try { setStickframeLayout(calculateStickframeLayout(wall)); } catch (err) { console.warn('Failed to compute stickframe layout:', err); setStickframeLayout(null); }
      }
    } else {
      setWallInput(null);
      setLayout(null);
      setWallName('');
      setTimberRatio(null);
      setStickframeLayout(null);
      setLoadKey(k => k + 1);
    }
  }, [projectId, wallId, navigate]);

  const handleCalculate = (wall) => {
    const result = calculateWallLayout(wall);
    setLayout(result);
    setWallName(wall.name);
    setWallInput(wall);
    setGenerateKey(k => k + 1);
    try { setTimberRatio(computeWallTimberRatio(wall)); } catch (err) { console.warn('Failed to compute timber ratio:', err); setTimberRatio(null); }
    try { setStickframeLayout(calculateStickframeLayout(wall)); } catch (err) { console.warn('Failed to compute stickframe layout:', err); setStickframeLayout(null); }
  };

  const handleSave = () => {
    if (!wallInput || !projectId) return;
    const saved = saveWall(projectId, wallInput);
    setWallInput(saved);
    // If this was a new wall, update the URL to reflect the saved ID
    if (!wallId || wallId === 'new') {
      navigate(`/project/${projectId}/wall/${saved.id}`, { replace: true });
    }
  };

  if (!project) return null;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <div style={styles.headerLeft}>
            <button onClick={() => navigate(`/project/${projectId}`)} style={styles.backBtn}>
              &larr; {project.name}
            </button>
            {wallName && <span style={styles.wallLabel}>{wallName}</span>}
          </div>
          <div style={styles.headerActions}>
            <button
              onClick={() => navigate(`/project/${projectId}/wall/new`)}
              style={styles.newBtn}
            >
              + New Wall
            </button>
            {wallInput && (
              <button onClick={handleSave} style={styles.saveBtn}>
                Save Wall
              </button>
            )}
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <WallForm
          key={loadKey}
          onCalculate={handleCalculate}
          onChange={setWallInput}
          initialWall={wallInput}
        />

        {layout && (
          <>
            <CollapsibleSection sectionKey="wallDrawing" title="External Elevation" forceOpen={generateKey}>
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
  },
};
