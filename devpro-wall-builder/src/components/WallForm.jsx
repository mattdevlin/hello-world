import { useState } from 'react';
import { PANEL_HEIGHTS, OPENING_TYPES, WALL_THICKNESS } from '../utils/constants.js';

const defaultOpening = {
  ref: '',
  type: OPENING_TYPES.WINDOW,
  width_mm: 1200,
  height_mm: 1200,
  sill_mm: 900,
  position_from_left_mm: 1000,
};

const defaultWall = {
  name: 'N-W1',
  length_mm: 9740,
  height_mm: 2440,
  deduction_left_mm: 162,
  deduction_right_mm: 0,
  openings: [],
};

export default function WallForm({ onCalculate, onChange, initialWall }) {
  const [wall, setWall] = useState(initialWall || defaultWall);

  const updateWall = (updater) => {
    setWall(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (onChange) onChange(next);
      return next;
    });
  };

  const updateField = (field, value) => {
    updateWall(prev => ({ ...prev, [field]: value }));
  };

  const addOpening = () => {
    updateWall(prev => ({
      ...prev,
      openings: [...prev.openings, { ...defaultOpening, ref: `W${String(prev.openings.length + 1).padStart(2, '0')}` }],
    }));
  };

  const updateOpening = (index, field, value) => {
    updateWall(prev => {
      const openings = [...prev.openings];
      openings[index] = { ...openings[index], [field]: value };
      // Auto-set sill to 0 for doors
      if (field === 'type' && (value === OPENING_TYPES.DOOR || value === OPENING_TYPES.GARAGE_DOOR)) {
        openings[index].sill_mm = 0;
      }
      return { ...prev, openings };
    });
  };

  const removeOpening = (index) => {
    updateWall(prev => ({
      ...prev,
      openings: prev.openings.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate(wall);
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.heading}>Wall Dimensions</h2>

      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>Wall Name</label>
          <input
            type="text"
            value={wall.name}
            onChange={e => updateField('name', e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Length (mm)</label>
          <input
            type="number"
            value={wall.length_mm}
            onChange={e => updateField('length_mm', parseInt(e.target.value) || 0)}
            style={styles.input}
            min={300}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Height (mm)</label>
          <select
            value={wall.height_mm}
            onChange={e => updateField('height_mm', parseInt(e.target.value))}
            style={styles.input}
          >
            {PANEL_HEIGHTS.map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
            <option value={2440}>2440 (common NZ)</option>
          </select>
        </div>
      </div>

      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>
            Corner Deduction Left (mm)
            <span style={styles.hint}> — looking from outside</span>
          </label>
          <select
            value={wall.deduction_left_mm}
            onChange={e => updateField('deduction_left_mm', parseInt(e.target.value))}
            style={styles.input}
          >
            <option value={0}>None (0mm)</option>
            <option value={162}>162mm (wall thickness)</option>
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>
            Corner Deduction Right (mm)
          </label>
          <select
            value={wall.deduction_right_mm}
            onChange={e => updateField('deduction_right_mm', parseInt(e.target.value))}
            style={styles.input}
          >
            <option value={0}>None (0mm)</option>
            <option value={162}>162mm (wall thickness)</option>
          </select>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.openingsHeader}>
        <h2 style={styles.heading}>Openings</h2>
        <button type="button" onClick={addOpening} style={styles.addBtn}>
          + Add Opening
        </button>
      </div>

      {wall.openings.length === 0 && (
        <p style={styles.emptyText}>No openings added. Click "+ Add Opening" to add windows or doors.</p>
      )}

      {wall.openings.map((op, i) => (
        <div key={i} style={styles.openingCard}>
          <div style={styles.openingCardHeader}>
            <strong>Opening {i + 1}</strong>
            <button type="button" onClick={() => removeOpening(i)} style={styles.removeBtn}>
              Remove
            </button>
          </div>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Reference</label>
              <input
                type="text"
                value={op.ref}
                onChange={e => updateOpening(i, 'ref', e.target.value)}
                style={styles.input}
                placeholder="W01, D01..."
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Type</label>
              <select
                value={op.type}
                onChange={e => updateOpening(i, 'type', e.target.value)}
                style={styles.input}
              >
                <option value={OPENING_TYPES.WINDOW}>Window</option>
                <option value={OPENING_TYPES.DOOR}>Door</option>
                <option value={OPENING_TYPES.GARAGE_DOOR}>Garage Door</option>
              </select>
            </div>
          </div>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Width (mm)</label>
              <input
                type="number"
                value={op.width_mm}
                onChange={e => updateOpening(i, 'width_mm', parseInt(e.target.value) || 0)}
                style={styles.input}
                min={0}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Height (mm)</label>
              <input
                type="number"
                value={op.height_mm}
                onChange={e => updateOpening(i, 'height_mm', parseInt(e.target.value) || 0)}
                style={styles.input}
                min={0}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Sill Height (mm)</label>
              <input
                type="number"
                value={op.sill_mm}
                onChange={e => updateOpening(i, 'sill_mm', parseInt(e.target.value) || 0)}
                style={styles.input}
                min={0}
                disabled={op.type !== OPENING_TYPES.WINDOW}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Position from Left (mm)</label>
              <input
                type="number"
                value={op.position_from_left_mm}
                onChange={e => updateOpening(i, 'position_from_left_mm', parseInt(e.target.value) || 0)}
                style={styles.input}
                min={0}
              />
            </div>
          </div>
        </div>
      ))}

      <button type="submit" style={styles.submitBtn}>
        Generate Wall Drawing
      </button>
    </form>
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
  hint: {
    fontWeight: 400,
    color: '#999',
    fontSize: 11,
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
};
