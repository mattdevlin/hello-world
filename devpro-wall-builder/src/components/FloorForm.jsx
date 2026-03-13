import { useState, useEffect, useRef } from 'react';
import { DEFAULT_PERIMETER_PLATE_WIDTH } from '../utils/constants.js';
import { boundingBox } from '../utils/polygonUtils.js';

const defaultFloor = {
  name: 'F1',
  polygon: [
    { x: 0, y: 0 },
    { x: 6000, y: 0 },
    { x: 6000, y: 4000 },
    { x: 0, y: 4000 },
  ],
  panelDirection: 0,
  perimeterPlateWidth: DEFAULT_PERIMETER_PLATE_WIDTH,
  boundaryJoistCount: 1,
  bearerLines: [],
  openings: [],
  recesses: [],
};

export default function FloorForm({ onCalculate, onChange, initialFloor }) {
  const [floor, setFloor] = useState(initialFloor || defaultFloor);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (onChangeRef.current) onChangeRef.current(floor);
  }, [floor]);

  const updateFloor = (updater) => {
    setFloor(prev => typeof updater === 'function' ? updater(prev) : updater);
  };

  const updateField = (field, value) => {
    updateFloor(prev => ({ ...prev, [field]: value }));
  };

  // Polygon point management
  const updatePoint = (index, axis, value) => {
    updateFloor(prev => {
      const polygon = [...prev.polygon];
      polygon[index] = { ...polygon[index], [axis]: value };
      return { ...prev, polygon };
    });
  };

  const addPoint = () => {
    updateFloor(prev => {
      const last = prev.polygon[prev.polygon.length - 1] || { x: 0, y: 0 };
      return { ...prev, polygon: [...prev.polygon, { x: last.x + 1000, y: last.y }] };
    });
  };

  const removePoint = (idx) => {
    updateFloor(prev => {
      if (prev.polygon.length <= 3) return prev;
      const polygon = prev.polygon.filter((_, i) => i !== idx);
      return { ...prev, polygon };
    });
  };

  // Bearer lines
  const addBearerLine = () => {
    updateFloor(prev => ({
      ...prev,
      bearerLines: [...prev.bearerLines, { position: 2410, orientation: 'vertical' }],
    }));
  };

  const updateBearerLine = (index, field, value) => {
    updateFloor(prev => {
      const bearerLines = [...prev.bearerLines];
      bearerLines[index] = { ...bearerLines[index], [field]: value };
      return { ...prev, bearerLines };
    });
  };

  const removeBearerLine = (index) => {
    updateFloor(prev => ({
      ...prev,
      bearerLines: prev.bearerLines.filter((_, i) => i !== index),
    }));
  };

  // Openings
  const addOpening = () => {
    updateFloor(prev => ({
      ...prev,
      openings: [...prev.openings, {
        ref: `P${String(prev.openings.length + 1).padStart(2, '0')}`,
        type: 'circular',
        diameter: 110,
        width: 400,
        length: 300,
        x: 1000,
        y: 1000,
      }],
    }));
  };

  const updateOpening = (index, field, value) => {
    updateFloor(prev => {
      const openings = [...prev.openings];
      openings[index] = { ...openings[index], [field]: value };
      return { ...prev, openings };
    });
  };

  const removeOpening = (index) => {
    updateFloor(prev => ({
      ...prev,
      openings: prev.openings.filter((_, i) => i !== index),
    }));
  };

  // Recesses
  const addRecess = () => {
    updateFloor(prev => ({
      ...prev,
      recesses: [...prev.recesses, {
        ref: `SH${String(prev.recesses.length + 1).padStart(2, '0')}`,
        type: 'shower',
        width: 1200,
        length: 1200,
        depth: 30,
        x: 500,
        y: 500,
        plateWidth: DEFAULT_PERIMETER_PLATE_WIDTH,
      }],
    }));
  };

  const updateRecess = (index, field, value) => {
    updateFloor(prev => {
      const recesses = [...prev.recesses];
      recesses[index] = { ...recesses[index], [field]: value };
      if (field === 'type' && value === 'door_rebate') {
        recesses[index].depth = recesses[index].depth || 20;
      }
      return { ...prev, recesses };
    });
  };

  const removeRecess = (index) => {
    updateFloor(prev => ({
      ...prev,
      recesses: prev.recesses.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate(floor);
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Floor Name</label>
          <input
            type="text"
            value={floor.name}
            onChange={e => updateField('name', e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Panel Direction</label>
          <select
            value={floor.panelDirection}
            onChange={e => updateField('panelDirection', parseInt(e.target.value))}
            style={styles.input}
          >
            <option value={0}>Along X (0°)</option>
            <option value={90}>Along Y (90°)</option>
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Perimeter Plate Width (mm)</label>
          <input
            type="number"
            value={floor.perimeterPlateWidth}
            onChange={e => updateField('perimeterPlateWidth', parseInt(e.target.value) || 45)}
            style={styles.input}
            min={20}
          />
        </div>
      </div>

      <div style={styles.divider} />

      {/* Polygon Points */}
      <div style={styles.openingsHeader}>
        <h2 style={styles.heading}>Polygon Points</h2>
        <button type="button" onClick={addPoint} style={styles.addBtn}>+ Add Point</button>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px' }}>
          <table style={styles.pointTable}>
            <thead>
              <tr>
                <th style={styles.ptTh}>#</th>
                <th style={styles.ptTh}>X (mm)</th>
                <th style={styles.ptTh}>Y (mm)</th>
                <th style={styles.ptTh}></th>
              </tr>
            </thead>
            <tbody>
              {floor.polygon.map((p, i) => (
                <tr key={i}>
                  <td style={styles.ptTd}>{i + 1}</td>
                  <td style={styles.ptTd}>
                    <input
                      type="number"
                      value={p.x}
                      onChange={e => updatePoint(i, 'x', parseInt(e.target.value) || 0)}
                      style={styles.ptInput}
                      disabled={i === 0}
                    />
                  </td>
                  <td style={styles.ptTd}>
                    <input
                      type="number"
                      value={p.y}
                      onChange={e => updatePoint(i, 'y', parseInt(e.target.value) || 0)}
                      style={styles.ptInput}
                      disabled={i === 0}
                    />
                  </td>
                  <td style={styles.ptTd}>
                    {i > 0 && floor.polygon.length > 3 && (
                      <button type="button" onClick={() => removePoint(i)} style={styles.removeSmBtn}>×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <PolygonPreview polygon={floor.polygon} />
        </div>
      </div>

      <div style={styles.divider} />

      {/* Bearer Lines */}
      <div style={styles.openingsHeader}>
        <h2 style={styles.heading}>Bearer Lines</h2>
        <button type="button" onClick={addBearerLine} style={styles.addBtn}>+ Add Bearer Line</button>
      </div>
      {floor.bearerLines.length === 0 && (
        <p style={styles.emptyText}>No bearer lines. Click "+ Add Bearer Line" to add.</p>
      )}
      {floor.bearerLines.map((bl, i) => (
        <div key={i} style={{ ...styles.row, marginBottom: 8 }}>
          <div style={styles.field}>
            <label style={styles.label}>Orientation</label>
            <select
              value={bl.orientation || 'vertical'}
              onChange={e => updateBearerLine(i, 'orientation', e.target.value)}
              style={styles.input}
            >
              <option value="vertical">Vertical (along Y)</option>
              <option value="horizontal">Horizontal (along X)</option>
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Position (mm from {(bl.orientation || 'vertical') === 'vertical' ? 'left edge' : 'bottom edge'})</label>
            <input
              type="number"
              value={bl.position}
              onChange={e => updateBearerLine(i, 'position', parseInt(e.target.value) || 0)}
              style={styles.input}
              min={0}
            />
          </div>
          <button type="button" onClick={() => removeBearerLine(i)} style={styles.removeBtn}>Remove</button>
        </div>
      ))}

      <div style={styles.divider} />

      {/* Boundary Joists */}
      <h2 style={styles.heading}>Boundary Joists</h2>
      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Number of Boundary Joists</label>
          <select
            value={floor.boundaryJoistCount || 1}
            onChange={e => updateField('boundaryJoistCount', parseInt(e.target.value))}
            style={styles.input}
          >
            <option value={1}>1 (single)</option>
            <option value={2}>2 (double)</option>
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Width</label>
          <input type="text" value="45 mm" disabled style={{ ...styles.input, background: '#f0f0f0', color: '#666' }} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Depth</label>
          <input type="text" value="170 mm" disabled style={{ ...styles.input, background: '#f0f0f0', color: '#666' }} />
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#888', margin: '0 0 4px', fontStyle: 'italic' }}>
        Outer joist aligns with panel edge. EPS recessed to fit.
        {(floor.boundaryJoistCount || 1) === 2 && ' Inner joist offset with standard gap to EPS.'}
      </p>

      <div style={styles.divider} />

      {/* Openings */}
      <div style={styles.openingsHeader}>
        <h2 style={styles.heading}>Openings</h2>
        <button type="button" onClick={addOpening} style={styles.addBtn}>+ Add Opening</button>
      </div>
      {floor.openings.length === 0 && (
        <p style={styles.emptyText}>No openings. Click "+ Add Opening" to add plumbing penetrations.</p>
      )}
      {floor.openings.map((op, i) => (
        <div key={i} style={styles.openingCard}>
          <div style={styles.openingCardHeader}>
            <strong>Opening {i + 1}</strong>
            <button type="button" onClick={() => removeOpening(i)} style={styles.removeBtn}>Remove</button>
          </div>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Reference</label>
              <input type="text" value={op.ref} onChange={e => updateOpening(i, 'ref', e.target.value)} style={styles.input} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Type</label>
              <select value={op.type} onChange={e => updateOpening(i, 'type', e.target.value)} style={styles.input}>
                <option value="circular">Circular</option>
                <option value="rectangular">Rectangular</option>
              </select>
            </div>
          </div>
          <div style={styles.row}>
            {op.type === 'circular' ? (
              <div style={styles.field}>
                <label style={styles.label}>Diameter (mm)</label>
                <input type="number" value={op.diameter} onChange={e => updateOpening(i, 'diameter', parseInt(e.target.value) || 0)} style={styles.input} min={0} />
              </div>
            ) : (
              <>
                <div style={styles.field}>
                  <label style={styles.label}>Width (mm)</label>
                  <input type="number" value={op.width} onChange={e => updateOpening(i, 'width', parseInt(e.target.value) || 0)} style={styles.input} min={0} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Length (mm)</label>
                  <input type="number" value={op.length} onChange={e => updateOpening(i, 'length', parseInt(e.target.value) || 0)} style={styles.input} min={0} />
                </div>
              </>
            )}
            <div style={styles.field}>
              <label style={styles.label}>X Position (mm)</label>
              <input type="number" value={op.x} onChange={e => updateOpening(i, 'x', parseInt(e.target.value) || 0)} style={styles.input} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Y Position (mm)</label>
              <input type="number" value={op.y} onChange={e => updateOpening(i, 'y', parseInt(e.target.value) || 0)} style={styles.input} />
            </div>
          </div>
        </div>
      ))}

      <div style={styles.divider} />

      {/* Recesses */}
      <div style={styles.openingsHeader}>
        <h2 style={styles.heading}>Recesses</h2>
        <button type="button" onClick={addRecess} style={styles.addBtn}>+ Add Recess</button>
      </div>
      {floor.recesses.length === 0 && (
        <p style={styles.emptyText}>No recesses. Click "+ Add Recess" for shower recesses or door rebates.</p>
      )}
      {floor.recesses.map((rec, i) => (
        <div key={i} style={styles.openingCard}>
          <div style={styles.openingCardHeader}>
            <strong>Recess {i + 1}</strong>
            <button type="button" onClick={() => removeRecess(i)} style={styles.removeBtn}>Remove</button>
          </div>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Reference</label>
              <input type="text" value={rec.ref} onChange={e => updateRecess(i, 'ref', e.target.value)} style={styles.input} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Type</label>
              <select value={rec.type} onChange={e => updateRecess(i, 'type', e.target.value)} style={styles.input}>
                <option value="shower">Shower</option>
                <option value="door_rebate">Door Rebate</option>
              </select>
            </div>
          </div>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Width (mm)</label>
              <input type="number" value={rec.width} onChange={e => updateRecess(i, 'width', parseInt(e.target.value) || 0)} style={styles.input} min={0} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Length (mm)</label>
              <input type="number" value={rec.length} onChange={e => updateRecess(i, 'length', parseInt(e.target.value) || 0)} style={styles.input} min={0} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Depth (mm)</label>
              <input type="number" value={rec.depth} onChange={e => updateRecess(i, 'depth', parseInt(e.target.value) || 0)} style={styles.input} min={0} />
            </div>
          </div>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>X Position (mm)</label>
              <input type="number" value={rec.x} onChange={e => updateRecess(i, 'x', parseInt(e.target.value) || 0)} style={styles.input} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Y Position (mm)</label>
              <input type="number" value={rec.y} onChange={e => updateRecess(i, 'y', parseInt(e.target.value) || 0)} style={styles.input} />
            </div>
            {rec.type === 'shower' && (
              <div style={styles.field}>
                <label style={styles.label}>Plate Width (mm)</label>
                <input type="number" value={rec.plateWidth} onChange={e => updateRecess(i, 'plateWidth', parseInt(e.target.value) || 45)} style={styles.input} min={20} />
              </div>
            )}
          </div>
        </div>
      ))}

      <button type="submit" style={styles.submitBtn}>
        Generate Floor Layout
      </button>
    </form>
  );
}

function PolygonPreview({ polygon }) {
  const pts = polygon;
  if (!pts || pts.length < 3) return null;
  const bb = boundingBox(pts);
  const pad = 20;
  const maxW = 300;
  const maxH = 200;
  const scaleX = (maxW - pad * 2) / (bb.width || 1);
  const scaleY = (maxH - pad * 2) / (bb.height || 1);
  const scale = Math.min(scaleX, scaleY);
  const svgW = bb.width * scale + pad * 2;
  const svgH = bb.height * scale + pad * 2;

  const points = pts.map(p =>
    `${(p.x - bb.minX) * scale + pad},${svgH - ((p.y - bb.minY) * scale + pad)}`
  ).join(' ');

  return (
    <svg width={svgW} height={svgH} style={{ background: '#f8f9fa', borderRadius: 4, border: '1px solid #e0e0e0' }}>
      <polygon points={points} fill="#4A90D9" fillOpacity={0.2} stroke="#2C5F8A" strokeWidth={2} />
      {pts.map((p, i) => {
        const sx = (p.x - bb.minX) * scale + pad;
        const sy = svgH - ((p.y - bb.minY) * scale + pad);
        return (
          <g key={i}>
            <circle cx={sx} cy={sy} r={4} fill={i === 0 ? '#e74c3c' : '#2C5F8A'} />
            <text x={sx + 6} y={sy - 6} fontSize={10} fill="#333">
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const styles = {
  form: {
    background: '#fff',
    borderRadius: 8,
    padding: 24,
    border: '1px solid #ddd',
    marginBottom: 24,
  },
  heading: {
    margin: '0 0 16px 0',
    fontSize: 18,
    color: '#333',
  },
  row: {
    display: 'flex',
    gap: 16,
    marginBottom: 12,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  field: {
    flex: '1 1 200px',
    minWidth: 150,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#555',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 4,
    boxSizing: 'border-box',
  },
  divider: {
    borderTop: '1px solid #eee',
    margin: '20px 0',
  },
  openingsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addBtn: {
    padding: '8px 16px',
    background: '#4A90D9',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  openingCard: {
    background: '#f9f9f9',
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
  },
  openingCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  removeBtn: {
    padding: '4px 12px',
    background: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  },
  removeSmBtn: {
    padding: '2px 8px',
    background: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1,
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    fontSize: 14,
  },
  submitBtn: {
    marginTop: 16,
    padding: '12px 32px',
    background: '#2C5F8A',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 700,
    width: '100%',
  },
  pointTable: {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: 13,
  },
  ptTh: {
    textAlign: 'left',
    padding: '4px 8px',
    borderBottom: '2px solid #e0e0e0',
    color: '#666',
    fontSize: 11,
    fontWeight: 600,
  },
  ptTd: {
    padding: '4px 8px',
    borderBottom: '1px solid #f0f0f0',
  },
  ptInput: {
    width: '100%',
    padding: '4px 6px',
    fontSize: 13,
    border: '1px solid #ccc',
    borderRadius: 3,
    boxSizing: 'border-box',
  },
};
