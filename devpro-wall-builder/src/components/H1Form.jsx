import { useState, useEffect, useRef } from 'react';
import CollapsibleSection from './CollapsibleSection.jsx';
import {
  GLAZING_TYPES, FRAME_TYPES, lookupWindowR,
  SLAB_FLOOR_TYPES, SLAB_INSULATION_POSITIONS, lookupSlabR,
} from '../utils/h1Constants.js';
import { buildH1FromDesign } from '../utils/h1DesignImport.js';

const defaultConstruction = { area: 0, rValue: 0 };

const defaultGlazing = { area: 0, glazingType: 'double', ug: 2.9, frameType: 'aluminiumThermal', rValue: 0.30 };

const defaultH1Input = {
  grossWallArea: 0,
  constructions: {
    roof: [{ area: 0, rValue: 6.6 }],
    wall: [{ area: 0, rValue: 4.14 }],
    glazing: [{ ...defaultGlazing }],
    doorOpaque: [],
    skylight: [],
    floorSlab: [{ area: 0, rValue: 0 }],
    floorOther: [],
  },
  slab: {
    perimeter: 0,
    floorArea: 0,
    floorType: 'raft_no_masonry',
    insulationPosition: 'uninsulated',
    wallThickness: 162,
  },
  heatedElements: { ceiling: false, wall: false, floor: false, bathroomOnly: false },
};

export default function H1Form({ projectId, climateZone, initialData, onChange, onCalculate }) {
  const [input, setInput] = useState(initialData || defaultH1Input);
  const [importSummary, setImportSummary] = useState(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (onChangeRef.current) onChangeRef.current(input);
  }, [input]);

  const update = (updater) => {
    setInput(prev => (typeof updater === 'function' ? updater(prev) : updater));
  };

  const setField = (field, value) => update(prev => ({ ...prev, [field]: value }));

  const setConstruction = (element, index, field, value) => {
    update(prev => {
      const arr = [...prev.constructions[element]];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, constructions: { ...prev.constructions, [element]: arr } };
    });
  };

  const addConstruction = (element, template = defaultConstruction) => {
    update(prev => ({
      ...prev,
      constructions: {
        ...prev.constructions,
        [element]: [...prev.constructions[element], { ...template }],
      },
    }));
  };

  const removeConstruction = (element, index) => {
    update(prev => ({
      ...prev,
      constructions: {
        ...prev.constructions,
        [element]: prev.constructions[element].filter((_, i) => i !== index),
      },
    }));
  };

  // Glazing: auto-lookup R-value when type/frame changes
  const setGlazingField = (index, field, value) => {
    update(prev => {
      const arr = [...prev.constructions.glazing];
      const entry = { ...arr[index], [field]: value };
      // Auto-lookup R-value
      const r = lookupWindowR(entry.glazingType, entry.ug, entry.frameType);
      if (r !== null) entry.rValue = r;
      arr[index] = entry;
      return { ...prev, constructions: { ...prev.constructions, glazing: arr } };
    });
  };

  // Slab: auto-lookup R-value when config changes
  const setSlabField = (field, value) => {
    update(prev => {
      const slab = { ...prev.slab, [field]: value };
      const apRatio = slab.perimeter > 0 ? slab.floorArea / slab.perimeter : 0;
      const slabR = lookupSlabR(slab.floorType, slab.insulationPosition, apRatio, slab.wallThickness);

      const floorSlabArr = prev.constructions.floorSlab.length > 0
        ? [{ area: slab.floorArea, rValue: slabR || prev.constructions.floorSlab[0].rValue }]
        : [{ area: slab.floorArea, rValue: slabR || 0 }];

      return {
        ...prev,
        slab,
        constructions: { ...prev.constructions, floorSlab: floorSlabArr },
      };
    });
  };

  const glazingArea = input.constructions.glazing.reduce((s, g) => s + (g.area || 0), 0);
  const glazingRatio = input.grossWallArea > 0 ? ((glazingArea / input.grossWallArea) * 100).toFixed(1) : '0.0';
  const glazingOk = parseFloat(glazingRatio) <= 40;

  const handleImportDesign = () => {
    if (!projectId) return;
    const { input: imported, summary } = buildH1FromDesign(projectId, input);
    setInput(imported);
    setImportSummary(summary);
  };

  const handleCalculate = () => {
    if (onCalculate) onCalculate(input);
  };

  return (
    <div>
      {/* Import from Design */}
      {projectId && (
        <div style={styles.importRow}>
          <button style={styles.importBtn} onClick={handleImportDesign}>
            Import from Design
          </button>
          {importSummary && (
            <span style={styles.importSummary}>
              {importSummary.wallsImported} wall{importSummary.wallsImported !== 1 ? 's' : ''}
              {importSummary.glazingCount > 0 && `, ${importSummary.glazingCount} window${importSummary.glazingCount !== 1 ? 's' : ''}`}
              {importSummary.doorCount > 0 && `, ${importSummary.doorCount} door${importSummary.doorCount !== 1 ? 's' : ''}`}
              {importSummary.floorCount > 0 && `, ${importSummary.floorAreaM2.toFixed(1)} m\u00B2 floor`}
              {' '}imported
            </span>
          )}
        </div>
      )}

      {/* Building Envelope Areas */}
      <CollapsibleSection sectionKey="h1-areas" title="Building Envelope Areas">
        <div style={styles.section}>
          <div style={styles.fieldRow}>
            <Field label="Gross wall area (m\u00B2)" value={input.grossWallArea}
              onChange={v => setField('grossWallArea', v)} />
          </div>
          <div style={styles.ratioRow}>
            <span>Glazing ratio: <strong style={{ color: glazingOk ? '#2E7D32' : '#c62828' }}>
              {glazingRatio}%</strong></span>
            <span style={{ fontSize: 11, color: '#888' }}>(max 40%)</span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Roof Constructions */}
      <CollapsibleSection sectionKey="h1-roof" title="Roof Constructions">
        <div style={styles.section}>
          {input.constructions.roof.map((c, i) => (
            <div key={i} style={styles.constructionRow}>
              <Field label="Area (m\u00B2)" value={c.area} onChange={v => setConstruction('roof', i, 'area', v)} />
              <Field label="R-value" value={c.rValue} onChange={v => setConstruction('roof', i, 'rValue', v)} step="0.1" />
              {input.constructions.roof.length > 1 && (
                <button style={styles.removeBtn} onClick={() => removeConstruction('roof', i)}>x</button>
              )}
            </div>
          ))}
          <button style={styles.addBtn} onClick={() => addConstruction('roof')}>+ Add roof type</button>
        </div>
      </CollapsibleSection>

      {/* Wall Constructions */}
      <CollapsibleSection sectionKey="h1-wall" title="Wall Constructions">
        <div style={styles.section}>
          {input.constructions.wall.map((c, i) => (
            <div key={i} style={styles.constructionRow}>
              <Field label="Area (m\u00B2)" value={c.area} onChange={v => setConstruction('wall', i, 'area', v)} />
              <Field label="R-value" value={c.rValue} onChange={v => setConstruction('wall', i, 'rValue', v)} step="0.1" />
              {input.constructions.wall.length > 1 && (
                <button style={styles.removeBtn} onClick={() => removeConstruction('wall', i)}>x</button>
              )}
            </div>
          ))}
          <button style={styles.addBtn} onClick={() => addConstruction('wall')}>+ Add wall type</button>
        </div>
      </CollapsibleSection>

      {/* Glazing */}
      <CollapsibleSection sectionKey="h1-glazing" title="Glazing">
        <div style={styles.section}>
          {input.constructions.glazing.map((g, i) => (
            <div key={i} style={styles.glazingRow}>
              <Field label="Area (m\u00B2)" value={g.area} onChange={v => setGlazingField(i, 'area', v)} />
              <SelectField label="Glazing" value={g.glazingType}
                options={GLAZING_TYPES} onChange={v => setGlazingField(i, 'glazingType', v)} />
              <Field label="Ug" value={g.ug} onChange={v => setGlazingField(i, 'ug', v)} step="0.1" />
              <SelectField label="Frame" value={g.frameType}
                options={FRAME_TYPES} onChange={v => setGlazingField(i, 'frameType', v)} />
              <div style={styles.rDisplay}>R{g.rValue?.toFixed(2)}</div>
              {input.constructions.glazing.length > 1 && (
                <button style={styles.removeBtn} onClick={() => removeConstruction('glazing', i)}>x</button>
              )}
            </div>
          ))}
          <button style={styles.addBtn} onClick={() => addConstruction('glazing', { ...defaultGlazing })}>+ Add glazing type</button>
        </div>
      </CollapsibleSection>

      {/* Opaque Doors */}
      <CollapsibleSection sectionKey="h1-doors" title="Opaque Doors" defaultCollapsed={true}>
        <div style={styles.section}>
          {input.constructions.doorOpaque.map((c, i) => (
            <div key={i} style={styles.constructionRow}>
              <Field label="Area (m\u00B2)" value={c.area} onChange={v => setConstruction('doorOpaque', i, 'area', v)} />
              <Field label="R-value" value={c.rValue} onChange={v => setConstruction('doorOpaque', i, 'rValue', v)} step="0.1" />
              <button style={styles.removeBtn} onClick={() => removeConstruction('doorOpaque', i)}>x</button>
            </div>
          ))}
          <button style={styles.addBtn} onClick={() => addConstruction('doorOpaque')}>+ Add opaque door</button>
        </div>
      </CollapsibleSection>

      {/* Skylights */}
      <CollapsibleSection sectionKey="h1-skylights" title="Skylights" defaultCollapsed={true}>
        <div style={styles.section}>
          {input.constructions.skylight.map((c, i) => (
            <div key={i} style={styles.constructionRow}>
              <Field label="Area (m\u00B2)" value={c.area} onChange={v => setConstruction('skylight', i, 'area', v)} />
              <Field label="R-value" value={c.rValue} onChange={v => setConstruction('skylight', i, 'rValue', v)} step="0.1" />
              <button style={styles.removeBtn} onClick={() => removeConstruction('skylight', i)}>x</button>
            </div>
          ))}
          <button style={styles.addBtn} onClick={() => addConstruction('skylight')}>+ Add skylight</button>
        </div>
      </CollapsibleSection>

      {/* Floor: Slab-on-Ground */}
      <CollapsibleSection sectionKey="h1-slab" title="Floor: Slab-on-Ground">
        <div style={styles.section}>
          <div style={styles.constructionRow}>
            <Field label="Floor area (m\u00B2)" value={input.slab.floorArea} onChange={v => setSlabField('floorArea', v)} />
            <Field label="Perimeter (m)" value={input.slab.perimeter} onChange={v => setSlabField('perimeter', v)} />
            <Field label="Wall thickness (mm)" value={input.slab.wallThickness} onChange={v => setSlabField('wallThickness', v)} />
          </div>
          <div style={styles.constructionRow}>
            <SelectField label="Floor type" value={input.slab.floorType}
              options={SLAB_FLOOR_TYPES} onChange={v => setSlabField('floorType', v)} />
            <SelectField label="Insulation" value={input.slab.insulationPosition}
              options={SLAB_INSULATION_POSITIONS} onChange={v => setSlabField('insulationPosition', v)} />
          </div>
          <div style={styles.ratioRow}>
            <span>A/P ratio: <strong>
              {input.slab.perimeter > 0 ? (input.slab.floorArea / input.slab.perimeter).toFixed(2) : '—'}
            </strong></span>
            <span>Slab R-value: <strong style={{ color: '#2E7D32' }}>
              {input.constructions.floorSlab[0]?.rValue > 0
                ? `R${input.constructions.floorSlab[0].rValue.toFixed(2)}`
                : '—'}
            </strong></span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Floor: Other (Suspended) */}
      <CollapsibleSection sectionKey="h1-floor-other" title="Floor: Other (Suspended)" defaultCollapsed={true}>
        <div style={styles.section}>
          {input.constructions.floorOther.map((c, i) => (
            <div key={i} style={styles.constructionRow}>
              <Field label="Area (m\u00B2)" value={c.area} onChange={v => setConstruction('floorOther', i, 'area', v)} />
              <Field label="R-value" value={c.rValue} onChange={v => setConstruction('floorOther', i, 'rValue', v)} step="0.1" />
              <button style={styles.removeBtn} onClick={() => removeConstruction('floorOther', i)}>x</button>
            </div>
          ))}
          <button style={styles.addBtn} onClick={() => addConstruction('floorOther')}>+ Add suspended floor type</button>
        </div>
      </CollapsibleSection>

      {/* Calculate button */}
      <div style={styles.calcRow}>
        <button style={styles.calcBtn} onClick={handleCalculate}>
          Check Compliance
        </button>
        {climateZone && (
          <span style={styles.zoneNote}>Climate Zone {climateZone}</span>
        )}
      </div>
    </div>
  );
}


// ── Reusable field components ──

function Field({ label, value, onChange, step = '1', type = 'number' }) {
  return (
    <label style={styles.fieldLabel}>
      <span style={styles.fieldLabelText}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        style={styles.fieldInput}
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label style={styles.fieldLabel}>
      <span style={styles.fieldLabelText}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={styles.fieldSelect}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}


// ── Styles ──

const styles = {
  section: {
    padding: '12px 16px',
    background: '#fff',
    border: '1px solid #ddd',
    borderTop: 'none',
    borderRadius: '0 0 8px 8px',
  },
  fieldRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  constructionRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-end',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  glazingRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  fieldLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 80,
  },
  fieldLabelText: {
    fontSize: 11,
    fontWeight: 600,
    color: '#888',
  },
  fieldInput: {
    padding: '6px 10px',
    fontSize: 14,
    border: '1px solid #ddd',
    borderRadius: 4,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  fieldSelect: {
    padding: '6px 10px',
    fontSize: 14,
    border: '1px solid #ddd',
    borderRadius: 4,
    outline: 'none',
    fontFamily: 'inherit',
    background: '#fff',
    width: '100%',
    boxSizing: 'border-box',
  },
  rDisplay: {
    padding: '6px 12px',
    fontSize: 14,
    fontWeight: 600,
    color: '#2E7D32',
    background: '#E8F5E9',
    borderRadius: 4,
    whiteSpace: 'nowrap',
    alignSelf: 'flex-end',
  },
  addBtn: {
    padding: '6px 12px',
    background: 'none',
    color: '#2C5F8A',
    border: '1px dashed #2C5F8A',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    marginTop: 4,
  },
  removeBtn: {
    padding: '6px 10px',
    background: '#fff5f5',
    color: '#e74c3c',
    border: '1px solid #fdd',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    alignSelf: 'flex-end',
  },
  ratioRow: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    marginTop: 8,
    fontSize: 13,
    color: '#555',
  },
  calcRow: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  calcBtn: {
    padding: '12px 32px',
    background: '#2E7D32',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 700,
  },
  zoneNote: {
    fontSize: 13,
    color: '#888',
    fontWeight: 500,
  },
  importRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  importBtn: {
    padding: '10px 20px',
    background: '#E8F5E9',
    color: '#2E7D32',
    border: '1px solid #A5D6A7',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  importSummary: {
    fontSize: 13,
    color: '#555',
    fontWeight: 500,
  },
};
