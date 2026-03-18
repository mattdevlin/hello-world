import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PANEL_HEIGHTS, OPENING_TYPES, WALL_PROFILES } from '../utils/constants.js';
import CalcInput from './CalcInput.jsx';

const defaultOpening = {
  ref: '',
  type: OPENING_TYPES.WINDOW,
  width_mm: 1200,
  height_mm: 1200,
  sill_mm: 900,
  position_from_left_mm: 1000,
  lintel_height_mm: 200,
};

const defaultWall = {
  name: 'W01',
  length_mm: 9740,
  height_mm: 2440,
  profile: WALL_PROFILES.STANDARD,
  height_right_mm: 2440,
  peak_height_mm: 4000,
  peak_position_mm: 4870,
  deduction_left_mm: 162,
  deduction_right_mm: 0,
  openings: [],
};

export default function WallForm({ onCalculate, onChange, initialWall }) {
  const [wall, setWall] = useState(initialWall ? { ...defaultWall, ...initialWall } : defaultWall);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Notify parent of wall changes outside of render (fixes React warning)
  useEffect(() => {
    if (onChangeRef.current) onChangeRef.current(wall);
  }, [wall]);

  const updateWall = (updater) => {
    setWall(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  };

  const updateField = (field, value) => {
    updateWall(prev => ({ ...prev, [field]: value }));
  };

  const addOpening = () => {
    updateWall(prev => ({
      ...prev,
      openings: [...prev.openings, { ...defaultOpening, id: crypto.randomUUID(), ref: `W${String(prev.openings.length + 1).padStart(2, '0')}` }],
    }));
  };

  const updateOpening = (index, field, value) => {
    updateWall(prev => {
      const openings = [...prev.openings];
      openings[index] = { ...openings[index], [field]: value };
      // Auto-set defaults when switching type
      if (field === 'type') {
        if (value === OPENING_TYPES.DOOR) {
          openings[index].sill_mm = 0;
          openings[index].height_mm = 2150;
          openings[index].width_mm = 900;
        } else if (value === OPENING_TYPES.SINGLE_GARAGE) {
          openings[index].sill_mm = 0;
          openings[index].height_mm = 2100;
          openings[index].width_mm = 2440;
        } else if (value === OPENING_TYPES.DOUBLE_GARAGE) {
          openings[index].sill_mm = 0;
          openings[index].height_mm = 2100;
          openings[index].width_mm = 4880;
        } else if (value === OPENING_TYPES.WINDOW) {
          openings[index].height_mm = 1200;
          openings[index].width_mm = 1200;
          openings[index].sill_mm = 900;
        }
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

  const [validationError, setValidationError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const validateField = (field, value) => {
    const errors = { ...fieldErrors };
    switch (field) {
      case 'length_mm':
        if (value <= 0) errors.length_mm = 'Must be positive';
        else delete errors.length_mm;
        break;
      case 'height_mm':
        if (value <= 0) errors.height_mm = 'Must be positive';
        else delete errors.height_mm;
        break;
      case 'height_right_mm':
        if (value <= 0) errors.height_right_mm = 'Must be positive';
        else delete errors.height_right_mm;
        break;
      case 'peak_height_mm':
        if (value <= (wall.height_mm || 0)) errors.peak_height_mm = 'Must exceed eave height';
        else delete errors.peak_height_mm;
        break;
      default:
        break;
    }
    setFieldErrors(errors);
  };

  const validateOpeningField = (index, field, value, opening) => {
    const key = `opening_${index}_${field}`;
    const errors = { ...fieldErrors };
    if (field === 'width_mm' && value <= 0) {
      errors[key] = 'Must be positive';
    } else if (field === 'height_mm' && value <= 0) {
      errors[key] = 'Must be positive';
    } else if (field === 'position_from_left_mm' && value < 0) {
      errors[key] = 'Cannot be negative';
    } else if (field === 'position_from_left_mm' && value + (opening?.width_mm || 0) > wall.length_mm) {
      errors[key] = 'Extends beyond wall';
    } else {
      delete errors[key];
    }
    setFieldErrors(errors);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validate wall dimensions
    if (wall.length_mm <= 0 || wall.height_mm <= 0) {
      setValidationError('Wall length and height must be positive values.');
      return;
    }
    const dedTotal = (wall.deduction_left_mm || 0) + (wall.deduction_right_mm || 0);
    if (dedTotal >= wall.length_mm) {
      setValidationError('Corner deductions exceed wall length.');
      return;
    }
    // Validate openings
    for (const op of wall.openings) {
      if (op.width_mm <= 0 || op.height_mm <= 0) {
        setValidationError(`Opening "${op.ref}" has invalid dimensions.`);
        return;
      }
      if (op.position_from_left_mm < 0) {
        setValidationError(`Opening "${op.ref}" has a negative position.`);
        return;
      }
      if (op.position_from_left_mm + op.width_mm > wall.length_mm) {
        setValidationError(`Opening "${op.ref}" extends beyond wall length.`);
        return;
      }
      const openingTop = (op.sill_mm || 0) + op.height_mm;
      if (openingTop > wall.height_mm) {
        setValidationError(`Opening "${op.ref}" exceeds wall height (sill + height = ${openingTop}mm > ${wall.height_mm}mm).`);
        return;
      }
    }
    setValidationError(null);
    onCalculate(wall);
  };

  const profile = wall.profile || WALL_PROFILES.STANDARD;

  // Ctrl+Enter to generate
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit(e);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

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
          <CalcInput
            value={wall.length_mm}
            onChange={v => updateField('length_mm', v)}
            onBlur={() => validateField('length_mm', wall.length_mm)}
            style={{ ...styles.input, ...(fieldErrors.length_mm ? styles.inputError : {}) }}
          />
          {fieldErrors.length_mm && <span style={styles.fieldError}>{fieldErrors.length_mm}</span>}
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Wall Profile</label>
          <select
            value={profile}
            onChange={e => updateField('profile', e.target.value)}
            style={styles.input}
          >
            <option value={WALL_PROFILES.STANDARD}>Standard (rectangular)</option>
            <option value={WALL_PROFILES.RAKED}>Raked (mono-pitch slope)</option>
            <option value={WALL_PROFILES.GABLE}>Gable (peaked)</option>
          </select>
        </div>
      </div>

      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>
            {profile === WALL_PROFILES.RAKED ? 'Height Left (mm)' :
             profile === WALL_PROFILES.GABLE ? 'Eave Height (mm)' :
             'Height (mm)'}
          </label>
          <CalcInput
            value={wall.height_mm}
            onChange={v => updateField('height_mm', v)}
            onBlur={() => validateField('height_mm', wall.height_mm)}
            style={{ ...styles.input, ...(fieldErrors.height_mm ? styles.inputError : {}) }}
          />
          {fieldErrors.height_mm && <span style={styles.fieldError}>{fieldErrors.height_mm}</span>}
        </div>

        {profile === WALL_PROFILES.RAKED && (
          <div style={styles.field}>
            <label style={styles.label}>Height Right (mm)</label>
            <CalcInput
              value={wall.height_right_mm || wall.height_mm}
              onChange={v => updateField('height_right_mm', v)}
              style={styles.input}
            />
          </div>
        )}

        {profile === WALL_PROFILES.GABLE && (
          <>
            <div style={styles.field}>
              <label style={styles.label}>Peak Height (mm)</label>
              <CalcInput
                value={wall.peak_height_mm || 4000}
                onChange={v => updateField('peak_height_mm', v)}
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Peak Position from Left (mm)</label>
              <CalcInput
                value={wall.peak_position_mm || Math.round(wall.length_mm / 2)}
                onChange={v => updateField('peak_position_mm', v)}
                style={styles.input}
              />
            </div>
          </>
        )}
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
        <button type="button" onClick={addOpening} style={styles.addBtn} aria-label="Add opening to wall">
          <Plus size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Add Opening
        </button>
      </div>

      {wall.openings.length === 0 && (
        <p style={styles.emptyText}>No openings added. Click "+ Add Opening" to add windows or doors.</p>
      )}

      {wall.openings.map((op, i) => (
        <div key={op.id || i} style={styles.openingCard}>
          <div style={styles.openingCardHeader}>
            <strong>Opening {i + 1}</strong>
            <button type="button" onClick={() => removeOpening(i)} style={styles.removeBtn} aria-label={`Remove opening ${i + 1}`}>
              <Trash2 size={12} style={{ marginRight: 4, verticalAlign: -1 }} />Remove
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
                <option value={OPENING_TYPES.SINGLE_GARAGE}>Single Garage Door</option>
                <option value={OPENING_TYPES.DOUBLE_GARAGE}>Double Garage Door</option>
              </select>
            </div>
          </div>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Width (mm)</label>
              <CalcInput
                value={op.width_mm}
                onChange={v => updateOpening(i, 'width_mm', v)}
                onBlur={() => validateOpeningField(i, 'width_mm', op.width_mm, op)}
                style={{ ...styles.input, ...(fieldErrors[`opening_${i}_width_mm`] ? styles.inputError : {}) }}
              />
              {fieldErrors[`opening_${i}_width_mm`] && <span style={styles.fieldError}>{fieldErrors[`opening_${i}_width_mm`]}</span>}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Height (mm)</label>
              <CalcInput
                value={op.height_mm}
                onChange={v => updateOpening(i, 'height_mm', v)}
                onBlur={() => validateOpeningField(i, 'height_mm', op.height_mm, op)}
                style={{ ...styles.input, ...(fieldErrors[`opening_${i}_height_mm`] ? styles.inputError : {}) }}
              />
              {fieldErrors[`opening_${i}_height_mm`] && <span style={styles.fieldError}>{fieldErrors[`opening_${i}_height_mm`]}</span>}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Sill Height (mm)</label>
              <CalcInput
                value={op.sill_mm}
                onChange={v => updateOpening(i, 'sill_mm', v)}
                style={styles.input}
                disabled={op.type !== OPENING_TYPES.WINDOW}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Position from Left (mm)</label>
              <CalcInput
                value={op.position_from_left_mm}
                onChange={v => updateOpening(i, 'position_from_left_mm', v)}
                onBlur={() => validateOpeningField(i, 'position_from_left_mm', op.position_from_left_mm, op)}
                style={{ ...styles.input, ...(fieldErrors[`opening_${i}_position_from_left_mm`] ? styles.inputError : {}) }}
              />
              {fieldErrors[`opening_${i}_position_from_left_mm`] && <span style={styles.fieldError}>{fieldErrors[`opening_${i}_position_from_left_mm`]}</span>}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Lintel Height (mm)</label>
              <CalcInput
                value={op.lintel_height_mm ?? 200}
                onChange={v => updateOpening(i, 'lintel_height_mm', v)}
                style={styles.input}
              />
            </div>
          </div>
        </div>
      ))}

      {validationError && (
        <p style={styles.validationError}>{validationError}</p>
      )}

      <button type="submit" style={styles.submitBtn} title="Ctrl+Enter">
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
    color: '#737373',
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
    color: '#737373',
    fontStyle: 'italic',
    fontSize: 14,
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  fieldError: {
    display: 'block',
    color: '#e74c3c',
    fontSize: 11,
    marginTop: 2,
  },
  validationError: {
    color: '#e74c3c',
    background: '#fff5f5',
    border: '1px solid #fdd',
    borderRadius: 4,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 500,
    marginTop: 12,
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
