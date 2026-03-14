import { useState, useEffect, useRef } from 'react';
import {
  ROOF_TYPES, ROOF_PANEL_DIRECTIONS, ROOF_THICKNESS_OPTIONS,
  DEFAULT_EAVE_OVERHANG, DEFAULT_GABLE_OVERHANG,
} from '../utils/constants.js';
import { boundingBox } from '../utils/polygonUtils.js';
import { BRAND, NEUTRAL } from '../utils/designTokens.js';

/**
 * Compute floor bounding-box extents from the first floor's polygon.
 * Returns { length, width } or null if no valid floor.
 */
function getFloorExtents(projectFloors) {
  if (!projectFloors || projectFloors.length === 0) return null;
  const floor = projectFloors[0];
  if (!floor.polygon || floor.polygon.length < 3) return null;
  const bb = boundingBox(floor.polygon);
  return { length: bb.width, width: bb.height };
}

function buildDefaultRoof(detectedType, projectWalls, projectFloors) {
  const type = detectedType || ROOF_TYPES.GABLE;
  const isFlat = type === ROOF_TYPES.FLAT;

  // For flat roofs, match the floor extents; otherwise use longest wall
  const floorExtents = getFloorExtents(projectFloors);
  let length_mm, width_mm;

  if (isFlat && floorExtents) {
    length_mm = floorExtents.length;
    width_mm = floorExtents.width;
  } else {
    const longestWall = (projectWalls || []).reduce(
      (max, w) => (w.length_mm > max ? w.length_mm : max), 0
    );
    length_mm = longestWall || 10000;
    width_mm = 8000;
  }

  return {
    name: 'R1',
    type,
    autoDetected: false,
    length_mm,
    width_mm,
    pitch_deg: isFlat ? 0 : 20,
    ridgeOffset_mm: 0,
    highEdge: 'left',
    panelDirection: ROOF_PANEL_DIRECTIONS.ALONG_RIDGE,
    thickness: 'roof',
    eaveOverhang_mm: DEFAULT_EAVE_OVERHANG,
    gableOverhang_mm: DEFAULT_GABLE_OVERHANG,
    penetrations: [],
  };
}

export default function RoofForm({ onCalculate, onChange, initialRoof, detectedType, projectWalls, projectFloors }) {
  const [roof, setRoof] = useState(initialRoof || buildDefaultRoof(detectedType, projectWalls, projectFloors));
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (onChangeRef.current) onChangeRef.current(roof);
  }, [roof]);

  const updateField = (field, value) => {
    setRoof(prev => ({ ...prev, [field]: value }));
  };

  const updatePenetration = (index, field, value) => {
    setRoof(prev => {
      const penetrations = [...prev.penetrations];
      penetrations[index] = { ...penetrations[index], [field]: value };
      return { ...prev, penetrations };
    });
  };

  const addPenetration = (type) => {
    setRoof(prev => ({
      ...prev,
      penetrations: [
        ...prev.penetrations,
        {
          id: crypto.randomUUID(),
          ref: type === 'skylight' ? `SKY${prev.penetrations.length + 1}` : `PIPE${prev.penetrations.length + 1}`,
          type,
          width_mm: type === 'skylight' ? 800 : 0,
          length_mm: type === 'skylight' ? 1200 : 0,
          diameter_mm: type === 'pipe' ? 150 : 0,
          position_x_mm: 1000,
          position_y_mm: 1000,
          plane: 0,
        },
      ],
    }));
  };

  const removePenetration = (index) => {
    setRoof(prev => ({
      ...prev,
      penetrations: prev.penetrations.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate(roof);
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      {/* Name & Type */}
      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Roof Name</label>
          <input
            type="text"
            value={roof.name}
            onChange={e => updateField('name', e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>
            Roof Type
            {detectedType && <span style={styles.hint}> (auto-detected: {detectedType})</span>}
          </label>
          <select
            value={roof.type}
            onChange={e => updateField('type', e.target.value)}
            style={styles.input}
          >
            <option value="gable">Gable</option>
            <option value="skillion">Skillion</option>
            <option value="flat">Flat / Ceiling</option>
          </select>
        </div>
      </div>

      {/* Dimensions */}
      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Length (along ridge) mm</label>
          <input
            type="number"
            value={roof.length_mm}
            onChange={e => updateField('length_mm', Number(e.target.value))}
            min={1}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Width (eave-to-eave) mm</label>
          <input
            type="number"
            value={roof.width_mm}
            onChange={e => updateField('width_mm', Number(e.target.value))}
            min={1}
            style={styles.input}
          />
        </div>
      </div>

      {/* Pitch & Slope */}
      {roof.type !== 'flat' && (
        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Pitch (degrees)</label>
            <input
              type="number"
              value={roof.pitch_deg}
              onChange={e => updateField('pitch_deg', Number(e.target.value))}
              min={0}
              max={60}
              step={0.5}
              style={styles.input}
            />
          </div>
          {roof.type === 'gable' && (
            <div style={styles.field}>
              <label style={styles.label}>Ridge Offset mm (0 = symmetric)</label>
              <input
                type="number"
                value={roof.ridgeOffset_mm}
                onChange={e => updateField('ridgeOffset_mm', Number(e.target.value))}
                style={styles.input}
              />
            </div>
          )}
          {roof.type === 'skillion' && (
            <div style={styles.field}>
              <label style={styles.label}>High Edge</label>
              <select
                value={roof.highEdge}
                onChange={e => updateField('highEdge', e.target.value)}
                style={styles.input}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Panel Direction & Thickness */}
      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Panel Direction</label>
          <select
            value={roof.panelDirection}
            onChange={e => updateField('panelDirection', e.target.value)}
            style={styles.input}
          >
            <option value="along_ridge">Along Ridge</option>
            <option value="eave_to_ridge">Eave to Ridge</option>
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Panel Thickness</label>
          <select
            value={roof.thickness}
            onChange={e => updateField('thickness', e.target.value)}
            style={styles.input}
          >
            {Object.entries(ROOF_THICKNESS_OPTIONS).map(([key, opt]) => (
              <option key={key} value={key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Overhangs */}
      {roof.type !== 'flat' && (
        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Eave Overhang mm</label>
            <input
              type="number"
              value={roof.eaveOverhang_mm}
              onChange={e => updateField('eaveOverhang_mm', Number(e.target.value))}
              min={0}
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Gable Overhang mm</label>
            <input
              type="number"
              value={roof.gableOverhang_mm}
              onChange={e => updateField('gableOverhang_mm', Number(e.target.value))}
              min={0}
              style={styles.input}
            />
          </div>
        </div>
      )}

      {/* Penetrations */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h4 style={styles.sectionTitle}>Penetrations</h4>
          <div style={styles.sectionActions}>
            <button type="button" onClick={() => addPenetration('skylight')} style={styles.addBtn}>
              + Skylight
            </button>
            <button type="button" onClick={() => addPenetration('pipe')} style={styles.addBtn}>
              + Pipe
            </button>
          </div>
        </div>

        {roof.penetrations.map((pen, i) => (
          <div key={pen.id} style={styles.penRow}>
            <div style={styles.field}>
              <label style={styles.label}>Ref</label>
              <input
                type="text"
                value={pen.ref}
                onChange={e => updatePenetration(i, 'ref', e.target.value)}
                style={{ ...styles.input, width: 80 }}
              />
            </div>
            {pen.type === 'skylight' ? (
              <>
                <div style={styles.field}>
                  <label style={styles.label}>Width mm</label>
                  <input type="number" value={pen.width_mm} onChange={e => updatePenetration(i, 'width_mm', Number(e.target.value))} min={0} style={styles.input} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Length mm</label>
                  <input type="number" value={pen.length_mm} onChange={e => updatePenetration(i, 'length_mm', Number(e.target.value))} min={0} style={styles.input} />
                </div>
              </>
            ) : (
              <div style={styles.field}>
                <label style={styles.label}>Diameter mm</label>
                <input type="number" value={pen.diameter_mm} onChange={e => updatePenetration(i, 'diameter_mm', Number(e.target.value))} min={0} style={styles.input} />
              </div>
            )}
            <div style={styles.field}>
              <label style={styles.label}>X mm</label>
              <input type="number" value={pen.position_x_mm} onChange={e => updatePenetration(i, 'position_x_mm', Number(e.target.value))} style={styles.input} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Y mm</label>
              <input type="number" value={pen.position_y_mm} onChange={e => updatePenetration(i, 'position_y_mm', Number(e.target.value))} style={styles.input} />
            </div>
            {roof.type === 'gable' && (
              <div style={styles.field}>
                <label style={styles.label}>Plane</label>
                <select value={pen.plane} onChange={e => updatePenetration(i, 'plane', Number(e.target.value))} style={styles.input}>
                  <option value={0}>Left</option>
                  <option value={1}>Right</option>
                </select>
              </div>
            )}
            <button type="button" onClick={() => removePenetration(i)} style={styles.removeBtn}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <button type="submit" style={styles.calcBtn}>
        Calculate Roof Layout
      </button>
    </form>
  );
}

const styles = {
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  row: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 140 },
  label: { fontSize: 12, fontWeight: 600, color: NEUTRAL.textMuted },
  hint: { fontWeight: 400, fontStyle: 'italic', color: NEUTRAL.textFaint },
  input: {
    padding: '8px 12px', fontSize: 14, border: `1px solid ${NEUTRAL.inputBorder}`,
    borderRadius: 4, outline: 'none', fontFamily: 'inherit',
  },
  section: {
    border: `1px solid ${NEUTRAL.borderLight}`, borderRadius: 6,
    padding: 16, background: '#fafafa',
  },
  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 600, color: NEUTRAL.text },
  sectionActions: { display: 'flex', gap: 8 },
  addBtn: {
    padding: '4px 12px', background: '#f0f2f5', border: '1px solid #ddd',
    borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 500,
  },
  penRow: {
    display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
    padding: '8px 0', borderBottom: '1px solid #eee',
  },
  removeBtn: {
    padding: '6px 12px', background: '#fff5f5', color: '#e74c3c',
    border: '1px solid #fdd', borderRadius: 4, cursor: 'pointer',
    fontSize: 12, fontWeight: 500, marginBottom: 4,
  },
  calcBtn: {
    padding: '12px 24px', background: BRAND.roof, color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer',
    fontSize: 14, fontWeight: 600, alignSelf: 'flex-start',
  },
};
