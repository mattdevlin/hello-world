import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FloorForm from '../components/FloorForm.jsx';
import FloorPlanView from '../components/FloorPlanView.jsx';
import FloorFramingPlan from '../components/FloorFramingPlan.jsx';
import FloorEpsPlan from '../components/FloorEpsPlan.jsx';
import FloorPanelPlans from '../components/FloorPanelPlans.jsx';
import FloorEpsCutPlans from '../components/FloorEpsCutPlans.jsx';
import FloorOffcuts from '../components/FloorOffcuts.jsx';
import FloorSummary from '../components/FloorSummary.jsx';
import CollapsibleSection from '../components/CollapsibleSection.jsx';
import { calculateFloorLayout } from '../utils/floorCalculator.js';
import { getProjects, getProjectFloors, saveFloor } from '../utils/storage.js';
import { DEVPRO_FLOOR_R, REFERENCE_R_VALUES, REFERENCE_TIMBER_FRACTION, getClimateZone } from '../utils/h1Constants.js';

export default function FloorBuilderPage() {
  const { projectId, floorId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [layout, setLayout] = useState(null);
  const [floorName, setFloorName] = useState('');
  const [floorInput, setFloorInput] = useState(null);
  const [loadKey, setLoadKey] = useState(0);
  const [generateKey, setGenerateKey] = useState(0);
  const [saveKey, setSaveKey] = useState(0);

  useEffect(() => {
    const p = getProjects().find(p => p.id === projectId);
    if (!p) { navigate('/', { replace: true }); return; }
    setProject(p);

    if (floorId && floorId !== 'new') {
      const floors = getProjectFloors(projectId);
      const floor = floors.find(f => f.id === floorId);
      if (floor) {
        setFloorInput(floor);
        setLoadKey(k => k + 1);
        const result = calculateFloorLayout(floor);
        if (!result.error) setLayout(result);
        setFloorName(floor.name);
      }
    } else {
      setFloorInput(null);
      setLayout(null);
      setFloorName('');
      setLoadKey(k => k + 1);
    }
  }, [projectId, floorId, navigate]);

  const handleCalculate = (floor) => {
    const result = calculateFloorLayout(floor);
    if (result.error) {
      alert(result.error);
      return;
    }
    setLayout(result);
    setFloorName(floor.name);
    setFloorInput(floor);
    setGenerateKey(k => k + 1);
  };

  const handleSave = () => {
    if (!floorInput || !projectId) return;
    const saved = saveFloor(projectId, floorInput);
    setFloorInput(saved);
    setSaveKey(k => k + 1);
    if (!floorId || floorId === 'new') {
      navigate(`/project/${projectId}/floor/${saved.id}`, { replace: true });
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
            {floorName && <span style={styles.floorLabel}>{floorName}</span>}
          </div>
          <div style={styles.headerActions}>
            <button
              onClick={() => navigate(`/project/${projectId}/floor/new`)}
              style={styles.newBtn}
            >
              + New Floor
            </button>
            {floorInput && (
              <button onClick={handleSave} style={styles.saveBtn}>
                Save Floor
              </button>
            )}
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <CollapsibleSection sectionKey="floorDimensions" title="Floor Dimensions" forceOpen={generateKey} forceCollapse={saveKey}>
          <FloorForm
            key={loadKey}
            onCalculate={handleCalculate}
            onChange={setFloorInput}
            initialFloor={floorInput}
          />
        </CollapsibleSection>

        {layout && (
          <>
            <CollapsibleSection sectionKey="floorPlan" title="Floor Plan View" forceOpen={generateKey} headerRight={(() => {
                const zone = getClimateZone(project.territorialAuthority);
                const ref = REFERENCE_R_VALUES[zone] || REFERENCE_R_VALUES[1];
                const areaM2 = layout.totalArea / 1e6;
                const devHL = areaM2 / DEVPRO_FLOOR_R;
                const refHL = areaM2 / ref.otherFloor;
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
              <FloorPlanView layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorFraming" title="Framing Plan" forceOpen={generateKey} headerRight={(() => {
                const splineArea = [...layout.reinforcedSplines, ...layout.unreinforcedSplines]
                  .reduce((sum, s) => sum + s.width * s.length, 0);
                const plateArea = layout.perimeterPlates.reduce((sum, p) => {
                  const len = Math.sqrt((p.x2 - p.x1) ** 2 + (p.y2 - p.y1) ** 2);
                  return sum + len * layout.perimeterPlateWidth * layout.boundaryJoistCount;
                }, 0);
                const devTimber = layout.totalArea > 0 ? (splineArea + plateArea) / layout.totalArea * 100 : 0;
                const refTimber = REFERENCE_TIMBER_FRACTION * 100;
                const devBetter = devTimber < refTimber;
                const pctMore = Math.round((refTimber / devTimber) * 100);
                return (
                  <span style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 500, alignItems: 'baseline' }}>
                    <span style={{ color: devBetter ? '#2E7D32' : '#E65100' }}>DEVPRO: {devTimber.toFixed(1)}% timber</span>
                    <span style={{ color: devBetter ? '#E65100' : '#2E7D32' }}>NZBC: {refTimber.toFixed(0)}% timber</span>
                    {devBetter && <span style={{ fontSize: 11, color: '#E65100', fontStyle: 'italic' }}>NZBC has {pctMore}% more thermal bridging</span>}
                  </span>
                );
              })()}>
              <FloorFramingPlan layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorEps" title="EPS Plan" defaultCollapsed forceOpen={generateKey} headerRight={(() => {
                const splineArea = [...layout.reinforcedSplines, ...layout.unreinforcedSplines]
                  .reduce((sum, s) => sum + s.width * s.length, 0);
                const plateArea = layout.perimeterPlates.reduce((sum, p) => {
                  const len = Math.sqrt((p.x2 - p.x1) ** 2 + (p.y2 - p.y1) ** 2);
                  return sum + len * layout.perimeterPlateWidth * layout.boundaryJoistCount;
                }, 0);
                const devIns = layout.totalArea > 0 ? (1 - (splineArea + plateArea) / layout.totalArea) * 100 : 0;
                const refIns = (1 - REFERENCE_TIMBER_FRACTION) * 100;
                const devBetter = devIns > refIns;
                const pctLess = Math.round(((devIns - refIns) / refIns) * 100);
                return (
                  <span style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 500, alignItems: 'baseline' }}>
                    <span style={{ color: devBetter ? '#2E7D32' : '#E65100' }}>DEVPRO: {devIns.toFixed(1)}% insulation</span>
                    <span style={{ color: devBetter ? '#E65100' : '#2E7D32' }}>NZBC: {refIns.toFixed(0)}% insulation</span>
                    {devBetter && <span style={{ fontSize: 11, color: '#E65100', fontStyle: 'italic' }}>NZBC has {pctLess}% less insulation</span>}
                  </span>
                );
              })()}>
              <FloorEpsPlan layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorPanelPlans" title="Panel Cut Plans" defaultCollapsed>
              <FloorPanelPlans layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorEpsCutPlans" title="EPS Cut Plans" defaultCollapsed>
              <FloorEpsCutPlans layout={layout} floorName={floorName} projectName={project.name} />
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
    background: '#5D4037',
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
  floorLabel: {
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
