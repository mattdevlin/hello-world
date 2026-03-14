import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RoofForm from '../components/RoofForm.jsx';
import RoofPlanView from '../components/RoofPlanView.jsx';
import RoofSlopeView from '../components/RoofSlopeView.jsx';
import RoofSummary from '../components/RoofSummary.jsx';
import CollapsibleSection from '../components/CollapsibleSection.jsx';
import { calculateRoofLayout, detectRoofType } from '../utils/roofCalculator.js';
import { getProjects, getProjectRoofs, saveRoof, getProjectWalls, getProjectFloors } from '../utils/storage.js';
import { DEVPRO_ROOF_R, REFERENCE_R_VALUES, REFERENCE_TIMBER_FRACTION, getClimateZone } from '../utils/h1Constants.js';
import { BRAND } from '../utils/designTokens.js';

export default function RoofBuilderPage() {
  const { projectId, roofId } = useParams();
  const navigate = useNavigate();

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

  useEffect(() => {
    const p = getProjects().find(p => p.id === projectId);
    if (!p) { navigate('/', { replace: true }); return; }
    setProject(p);

    // Load project walls and floors for auto-detection and defaults
    const walls = getProjectWalls(projectId);
    setProjectWalls(walls);
    const floors = getProjectFloors(projectId);
    setProjectFloors(floors);
    const detected = detectRoofType(walls);
    setDetectedType(detected);

    if (roofId && roofId !== 'new') {
      const roofs = getProjectRoofs(projectId);
      const roof = roofs.find(r => r.id === roofId);
      if (roof) {
        setRoofInput(roof);
        setLoadKey(k => k + 1);
        const result = calculateRoofLayout(roof, walls);
        if (!result.error) setLayout(result);
        setRoofName(roof.name);
      }
    } else {
      setRoofInput(null);
      setLayout(null);
      setRoofName('');
      setLoadKey(k => k + 1);
    }
  }, [projectId, roofId, navigate]);

  const handleCalculate = (roof) => {
    const walls = getProjectWalls(projectId);
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

  const handleSave = () => {
    if (!roofInput || !projectId) return;
    const saved = saveRoof(projectId, roofInput);
    setRoofInput(saved);
    setSaveKey(k => k + 1);
    if (!roofId || roofId === 'new') {
      navigate(`/project/${projectId}/roof/${saved.id}`, { replace: true });
    }
  };

  if (!project) return null;

  // ── Compute stats for header badges ──
  const zone = getClimateZone(project.territorialAuthority);
  const ref = REFERENCE_R_VALUES[zone] || REFERENCE_R_VALUES[1];

  // Spline (timber) area across all planes
  const splineArea = layout
    ? layout.splines.reduce((sum, s) => sum + s.width * s.length, 0)
    : 0;
  const totalPlaneArea = layout ? layout.totalPlanArea : 0;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <div style={styles.headerLeft}>
            <button onClick={() => navigate(`/project/${projectId}`)} style={styles.backBtn} aria-label={`Back to ${project.name}`}>
              &larr; {project.name}
            </button>
            {roofName && <span style={styles.roofLabel}>{roofName}</span>}
          </div>
          <div style={styles.headerActions}>
            <button
              onClick={() => navigate(`/project/${projectId}/roof/new`)}
              style={styles.newBtn}
            >
              + New Roof
            </button>
            {roofInput && (
              <button onClick={handleSave} style={styles.saveBtn}>
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
            onChange={setRoofInput}
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
            <CollapsibleSection sectionKey="roofPlan" title="Roof Plan View" forceOpen={generateKey} headerRight={(() => {
                const areaM2 = layout.internalRoofArea / 1e6;
                const devHL = areaM2 / DEVPRO_ROOF_R;
                const refHL = areaM2 / ref.roof;
                const devBetter = devHL < refHL;
                const pctMore = Math.round((refHL / devHL) * 100);
                return (
                  <span style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 500, alignItems: 'baseline' }}>
                    <span style={{ color: devBetter ? '#2E7D32' : '#E65100' }}>DEVPRO: {devHL.toFixed(2)} W/K</span>
                    <span style={{ color: devBetter ? '#E65100' : '#2E7D32' }}>NZBC: {refHL.toFixed(2)} W/K</span>
                    {devBetter && <span style={{ fontSize: 11, color: '#E65100', fontStyle: 'italic' }}>NZBC loses {pctMore}% more heat</span>}
                  </span>
                );
              })()}>
              <RoofPlanView layout={layout} roofName={roofName} projectName={project.name} />
            </CollapsibleSection>

            {/* Framing Plan — timber fraction comparison */}
            <CollapsibleSection sectionKey="roofFraming" title="Framing Plan" forceOpen={generateKey} headerRight={(() => {
                const devTimber = totalPlaneArea > 0 ? (splineArea / totalPlaneArea) * 100 : 0;
                const refTimber = REFERENCE_TIMBER_FRACTION * 100;
                const devBetter = devTimber < refTimber;
                const pctMore = devTimber > 0 ? Math.round((refTimber / devTimber) * 100) : 0;
                return (
                  <span style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 500, alignItems: 'baseline' }}>
                    <span style={{ color: devBetter ? '#2E7D32' : '#E65100' }}>DEVPRO: {devTimber.toFixed(1)}% timber</span>
                    <span style={{ color: devBetter ? '#E65100' : '#2E7D32' }}>NZBC: {refTimber.toFixed(0)}% timber</span>
                    {devBetter && <span style={{ fontSize: 11, color: '#E65100', fontStyle: 'italic' }}>NZBC has {pctMore}% more thermal bridging</span>}
                  </span>
                );
              })()}>
              <RoofSlopeView layout={layout} roofName={roofName} projectName={project.name} />
            </CollapsibleSection>

            {/* EPS Plan — insulation fraction comparison */}
            <CollapsibleSection sectionKey="roofEps" title="EPS Plan" defaultCollapsed forceOpen={generateKey} headerRight={(() => {
                const devIns = totalPlaneArea > 0 ? (1 - splineArea / totalPlaneArea) * 100 : 0;
                const refIns = (1 - REFERENCE_TIMBER_FRACTION) * 100;
                const devBetter = devIns > refIns;
                const pctLess = refIns > 0 ? Math.round(((devIns - refIns) / refIns) * 100) : 0;
                return (
                  <span style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 500, alignItems: 'baseline' }}>
                    <span style={{ color: devBetter ? '#2E7D32' : '#E65100' }}>DEVPRO: {devIns.toFixed(1)}% insulation</span>
                    <span style={{ color: devBetter ? '#E65100' : '#2E7D32' }}>NZBC: {refIns.toFixed(0)}% insulation</span>
                    {devBetter && <span style={{ fontSize: 11, color: '#E65100', fontStyle: 'italic' }}>NZBC has {pctLess}% less insulation</span>}
                  </span>
                );
              })()}>
              <RoofSlopeView layout={layout} roofName={roofName} projectName={project.name} />
            </CollapsibleSection>

            <CollapsibleSection sectionKey="roofSummary" title="Roof Summary">
              <RoofSummary layout={layout} />
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
    background: '#f0f2f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  roofLabel: {
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
    background: '#e67e22',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  saveBtn: {
    padding: '8px 20px',
    background: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
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
