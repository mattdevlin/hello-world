import { useState, useEffect } from 'react';
import {
  determineWindZone,
  determineEqZone,
  SITE_PARAM_DEFAULTS,
  WIND_REGIONS,
  GROUND_ROUGHNESS_OPTIONS,
  EXPOSURE_OPTIONS,
  TOPO_CLASS_OPTIONS,
  SOIL_TYPE_OPTIONS,
  ROOF_WEIGHT_OPTIONS,
  CLADDING_WEIGHT_OPTIONS,
} from '../utils/nzs3604/site.js';
import { TERRITORIAL_AUTHORITIES } from '../utils/h1Constants.js';
import { FONT_STACK, NEUTRAL, BRAND, RADIUS } from '../utils/designTokens.js';

/**
 * SiteParamsForm — NZS 3604 site parameter input form.
 *
 * Determines wind zone and EQ zone from site conditions.
 * Follows existing form patterns (WallForm, FloorForm, RoofForm).
 *
 * @param {Object} props
 * @param {Object} props.value — current site params
 * @param {Function} props.onChange — called with updated params
 * @param {string} [props.territorialAuthority] — TA from project (pre-filled)
 */
export default function SiteParamsForm({ value, onChange, territorialAuthority }) {
  const params = { ...SITE_PARAM_DEFAULTS, ...value };

  // Compute derived zones
  const windZone = determineWindZone(
    params.windRegion,
    params.groundRoughness,
    params.topoClass,
    params.exposure,
    params.leeZone
  );
  const eqZone = determineEqZone(territorialAuthority || params.territorialAuthority);

  const update = (field, val) => {
    onChange({ ...params, [field]: val });
  };

  return (
    <div style={styles.form}>
      <div style={styles.grid}>
        {/* Wind Region */}
        <div style={styles.field}>
          <label style={styles.label}>Wind Region</label>
          <select
            value={params.windRegion}
            onChange={e => update('windRegion', e.target.value)}
            style={styles.select}
          >
            {WIND_REGIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Ground Roughness */}
        <div style={styles.field}>
          <label style={styles.label}>Ground Roughness</label>
          <select
            value={params.groundRoughness}
            onChange={e => update('groundRoughness', e.target.value)}
            style={styles.select}
          >
            {GROUND_ROUGHNESS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Exposure */}
        <div style={styles.field}>
          <label style={styles.label}>Exposure</label>
          <select
            value={params.exposure}
            onChange={e => update('exposure', e.target.value)}
            style={styles.select}
          >
            {EXPOSURE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Topo Class */}
        <div style={styles.field}>
          <label style={styles.label}>Topographic Class</label>
          <select
            value={params.topoClass}
            onChange={e => update('topoClass', e.target.value)}
            style={styles.select}
          >
            {TOPO_CLASS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Lee Zone */}
        <div style={styles.field}>
          <label style={styles.label}>
            <input
              type="checkbox"
              checked={params.leeZone}
              onChange={e => update('leeZone', e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Lee Zone
          </label>
          <span style={styles.hint}>Accelerated wind behind hills/ridges</span>
        </div>

        {/* Soil Type */}
        <div style={styles.field}>
          <label style={styles.label}>Soil Type</label>
          <select
            value={params.soilType}
            onChange={e => update('soilType', e.target.value)}
            style={styles.select}
          >
            {SOIL_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Roof Weight */}
        <div style={styles.field}>
          <label style={styles.label}>Roof Weight</label>
          <select
            value={params.roofWeight}
            onChange={e => update('roofWeight', e.target.value)}
            style={styles.select}
          >
            {ROOF_WEIGHT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Cladding Weight */}
        <div style={styles.field}>
          <label style={styles.label}>Cladding Weight</label>
          <select
            value={params.claddingWeight}
            onChange={e => update('claddingWeight', e.target.value)}
            style={styles.select}
          >
            {CLADDING_WEIGHT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Derived zones display */}
      <div style={styles.zoneRow}>
        <div style={{
          ...styles.zoneBadge,
          background: windZone === 'SED' ? '#FFF3E0' : '#E8F5E9',
          color: windZone === 'SED' ? '#E65100' : '#2E7D32',
          borderColor: windZone === 'SED' ? '#FFE0B2' : '#C8E6C9',
        }}>
          <span style={styles.zoneLabel}>Wind Zone</span>
          <span style={styles.zoneValue}>{windZone}</span>
        </div>
        <div style={{
          ...styles.zoneBadge,
          background: eqZone !== null ? '#E8F5E9' : '#F5F5F5',
          color: eqZone !== null ? '#2E7D32' : '#999',
          borderColor: eqZone !== null ? '#C8E6C9' : '#E0E0E0',
        }}>
          <span style={styles.zoneLabel}>EQ Zone</span>
          <span style={styles.zoneValue}>{eqZone !== null ? eqZone : '—'}</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  form: {
    padding: '16px 20px',
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e0e0e0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px 16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: NEUTRAL.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  select: {
    padding: '8px 12px',
    fontSize: 14,
    border: '1px solid #ddd',
    borderRadius: 6,
    background: '#fff',
    outline: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  hint: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  zoneRow: {
    display: 'flex',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px solid #f0f0f0',
  },
  zoneBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 24px',
    borderRadius: 8,
    border: '1px solid',
    minWidth: 100,
  },
  zoneLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  zoneValue: {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.2,
  },
};
