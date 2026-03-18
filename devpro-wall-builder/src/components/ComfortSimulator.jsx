import { useState, useMemo } from 'react';
import {
  AUCKLAND_SUMMER,
  HOUSE_PRESETS,
  simulate,
  adaptiveComfortBand,
  evaluateSleepComfort,
} from '../utils/comfortSimulator.js';

// ── Design Tokens (matching HeatLossCalc) ────────────────────────────────────

const FONT = `'DM Sans', sans-serif`;
const MONO = `'DM Mono', monospace`;

const C = {
  bg: '#0f1114', card: '#181b20', cardHover: '#1e2228', border: '#2a2e35',
  accent: '#4dd0a5', accentDim: '#2a7a5e', warn: '#e8794a', hot: '#e85a5a',
  text: '#e4e6ea', textDim: '#8a8f9a', textMuted: '#5a5f6a',
  fabric: '#5b8def', infiltration: '#e8794a', erv: '#b07de8',
  comfort: '#4dd0a5', comfortBg: '#4dd0a522', nightBg: '#0a0b0d',
  houseA: '#e8794a', houseB: '#4dd0a5', outdoor: '#5a5f6a',
};

const CHART = { width: 800, height: 260, padL: 50, padR: 20, padT: 20, padB: 35 };
const CHART_H = { ...CHART, height: 200 }; // shorter humidity chart

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v, dp = 1) {
  return v.toLocaleString('en-NZ', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}



// ── Main Component ───────────────────────────────────────────────────────────

export default function ComfortSimulator() {
  const [acMode, setAcMode] = useState(false);
  const [acSetpoint, setAcSetpoint] = useState(24);
  const [houseA, setHouseA] = useState({ ...HOUSE_PRESETS.typical });
  const [houseB, setHouseB] = useState({ ...HOUSE_PRESETS.devpro });

  const weather = AUCKLAND_SUMMER;
  const comfortBand = useMemo(() => adaptiveComfortBand(weather.meanOutdoorTemp), [weather.meanOutdoorTemp]);

  const opts = useMemo(() => ({ acEnabled: acMode, acSetpoint }), [acMode, acSetpoint]);
  const resultsA = useMemo(() => simulate(houseA, weather, opts), [houseA, weather, opts]);
  const resultsB = useMemo(() => simulate(houseB, weather, opts), [houseB, weather, opts]);

  const sleepA = useMemo(() => evaluateSleepComfort(resultsA, comfortBand), [resultsA, comfortBand]);
  const sleepB = useMemo(() => evaluateSleepComfort(resultsB, comfortBand), [resultsB, comfortBand]);

  return (
    <div style={{ fontFamily: FONT, background: C.bg, color: C.text, minHeight: '100vh', padding: '24px 16px' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {/* Header */}
        <Header />

        {/* Mode toggle */}
        <ModeToggle acMode={acMode} setAcMode={setAcMode} acSetpoint={acSetpoint} setAcSetpoint={setAcSetpoint} />

        {/* Input panels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <InputPanel label="A" preset={houseA} setPreset={setHouseA} color={C.houseA} />
          <InputPanel label="B" preset={houseB} setPreset={setHouseB} color={C.houseB} />
        </div>

        {/* Temperature chart */}
        <ChartCard title="Indoor Temperature — 24 Hours">
          <TemperatureChart resultsA={resultsA} resultsB={resultsB} weather={weather} comfortBand={comfortBand} nameA={houseA.name} nameB={houseB.name} />
        </ChartCard>

        {/* Humidity chart */}
        <ChartCard title="Indoor Relative Humidity — 24 Hours">
          <HumidityChart resultsA={resultsA} resultsB={resultsB} weather={weather} nameA={houseA.name} nameB={houseB.name} />
        </ChartCard>

        {/* Sleep comfort scorecard */}
        <SleepScorecard sleepA={sleepA} sleepB={sleepB} nameA={houseA.name} nameB={houseB.name} comfortBand={comfortBand} acMode={acMode} />

        {/* AC Energy (when enabled) */}
        {acMode && <ACEnergySummary sleepA={sleepA} sleepB={sleepB} nameA={houseA.name} nameB={houseB.name} />}

        {/* Method references */}
        <MethodNotes />
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        input:focus { outline: none; border-color: ${C.accent} !important; box-shadow: 0 0 0 2px ${C.accent}22; }
      `}</style>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent }} />
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.textDim, letterSpacing: 2, textTransform: 'uppercase' }}>DEVPRO</span>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
        Summer Comfort Simulator
      </h1>
      <p style={{ color: C.textDim, fontSize: 13, margin: '6px 0 0', lineHeight: 1.5 }}>
        24-hour thermal simulation of an Auckland summer day. Models indoor temperature and humidity
        using the ISO 13790 5R1C method. Can you sleep comfortably without air conditioning?
      </p>
    </div>
  );
}

// ── Mode Toggle ──────────────────────────────────────────────────────────────

function ModeToggle({ acMode, setAcMode, acSetpoint, setAcSetpoint }) {
  const btnStyle = (active) => ({
    fontFamily: MONO, fontSize: 12, padding: '8px 16px', borderRadius: 6,
    border: 'none', cursor: 'pointer', transition: 'all .2s',
    background: active ? C.accent + '22' : 'transparent',
    color: active ? C.accent : C.textDim,
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 4, background: C.card, borderRadius: 8, padding: 4, border: `1px solid ${C.border}` }}>
        <button onClick={() => setAcMode(false)} style={btnStyle(!acMode)}>Passive Only</button>
        <button onClick={() => setAcMode(true)} style={btnStyle(acMode)}>With AC</button>
      </div>
      {acMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.textDim }}>AC setpoint:</span>
          <input type="number" value={acSetpoint} step="0.5" min="18" max="28"
            onChange={(e) => setAcSetpoint(parseFloat(e.target.value) || 24)}
            style={{
              width: 60, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '6px 8px', color: C.text, fontFamily: MONO, fontSize: 13, textAlign: 'center',
            }}
          />
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.textDim }}>°C</span>
        </div>
      )}
    </div>
  );
}

// ── Input Panel ──────────────────────────────────────────────────────────────

function InputPanel({ label, preset, setPreset, color }) {
  const upd = (k, numeric = true) => (e) => {
    const val = numeric ? parseFloat(e.target.value) || 0 : e.target.value;
    setPreset((p) => ({ ...p, [k]: val }));
  };
  const toggle = (k) => () => setPreset((p) => ({ ...p, [k]: !p[k] }));

  const inputStyle = {
    width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
    padding: '7px 9px', color: C.text, fontFamily: MONO, fontSize: 13, boxSizing: 'border-box',
    transition: 'border-color .2s, box-shadow .2s',
  };
  const labelStyle = { display: 'block', fontFamily: MONO, fontSize: 10, color: C.textDim, marginBottom: 3, letterSpacing: 0.5 };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 5, background: color + '22', color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontSize: 11, fontWeight: 600,
        }}>{label}</div>
        <input value={preset.name} onChange={upd('name', false)}
          style={{ ...inputStyle, fontFamily: FONT, fontWeight: 600, fontSize: 14, border: 'none', background: 'transparent', padding: 0 }}
        />
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Floor area (m²)" value={preset.floorArea} onChange={upd('floorArea')} style={inputStyle} labelStyle={labelStyle} />
          <Field label="Opaque UA (W/K)" value={preset.opaqueUA} onChange={upd('opaqueUA')} style={inputStyle} labelStyle={labelStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Window U (W/m²K)" value={preset.windowU} onChange={upd('windowU')} style={inputStyle} labelStyle={labelStyle} />
          <Field label="Window area (m²)" value={preset.windowArea} onChange={upd('windowArea')} style={inputStyle} labelStyle={labelStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="ACH50 (blower door)" value={preset.ach50} onChange={upd('ach50')} style={inputStyle} labelStyle={labelStyle} />
          <Field label="Solar aperture (m²)" value={preset.solarAperture} onChange={upd('solarAperture')} style={inputStyle} labelStyle={labelStyle} />
        </div>

        {/* ERV toggle */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={toggle('ervEnabled')}>
            <div style={{
              width: 34, height: 18, borderRadius: 9, padding: 2, transition: 'background .2s',
              background: preset.ervEnabled ? C.accent + '44' : C.border, position: 'relative',
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: 7, transition: 'all .2s',
                background: preset.ervEnabled ? C.accent : C.textMuted,
                transform: preset.ervEnabled ? 'translateX(16px)' : 'translateX(0)',
              }} />
            </div>
            <span style={{ fontFamily: MONO, fontSize: 11, color: preset.ervEnabled ? C.text : C.textDim }}>ERV / HRV system</span>
          </div>
          {preset.ervEnabled && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <Field label="ERV airflow (ACH)" value={preset.ervAch} onChange={upd('ervAch')} style={inputStyle} labelStyle={labelStyle} />
              <Field label="Efficiency (%)" value={preset.ervEfficiency * 100} onChange={(e) => setPreset(p => ({ ...p, ervEfficiency: (parseFloat(e.target.value) || 0) / 100 }))} style={inputStyle} labelStyle={labelStyle} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, style, labelStyle }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="number" value={value} onChange={onChange} style={style} step="any" />
    </div>
  );
}

// ── Chart Wrapper ────────────────────────────────────────────────────────────

function ChartCard({ title, children }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: '18px 18px 14px', marginBottom: 16, animation: 'fadeIn .35s ease',
    }}>
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Temperature Chart (SVG) ──────────────────────────────────────────────────

function TemperatureChart({ resultsA, resultsB, weather, comfortBand, nameA, nameB }) {
  const { width, height, padL, padR, padT, padB } = CHART;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Y range: 14°C to 32°C
  const yMin = 14, yMax = 32;
  const xScale = (h) => padL + (h / 23) * plotW;
  const yScale = (t) => padT + plotH - ((t - yMin) / (yMax - yMin)) * plotH;

  const makePath = (data, key) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(d.hour).toFixed(1)},${yScale(d[key]).toFixed(1)}`).join(' ');

  const outdoorPath = weather.temperature.map((t, i) =>
    `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(t).toFixed(1)}`
  ).join(' ');

  // Night overlay regions (22:00–05:00)
  const nightRects = [];
  // 22-23
  nightRects.push({ x: xScale(22), w: xScale(23) - xScale(22) });
  // 0-5 doesn't render at start since we go 0-23, but 0-5 maps to left of chart
  nightRects.push({ x: xScale(0), w: xScale(5) - xScale(0) });

  // Y gridlines
  const yTicks = [16, 18, 20, 22, 24, 26, 28, 30];

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: width, display: 'block' }}>
        {/* Night overlays */}
        {nightRects.map((r, i) => (
          <rect key={i} x={r.x} y={padT} width={r.w} height={plotH} fill={C.nightBg} opacity={0.5} />
        ))}

        {/* ASHRAE 80% comfort band */}
        <rect
          x={padL} y={yScale(comfortBand.upper80)}
          width={plotW} height={yScale(comfortBand.lower80) - yScale(comfortBand.upper80)}
          fill={C.comfort} opacity={0.08}
        />
        {/* 90% band (tighter) */}
        <rect
          x={padL} y={yScale(comfortBand.upper90)}
          width={plotW} height={yScale(comfortBand.lower90) - yScale(comfortBand.upper90)}
          fill={C.comfort} opacity={0.08}
        />

        {/* Grid lines */}
        {yTicks.map(t => (
          <g key={t}>
            <line x1={padL} y1={yScale(t)} x2={width - padR} y2={yScale(t)} stroke={C.border} strokeWidth={0.5} />
            <text x={padL - 6} y={yScale(t) + 4} textAnchor="end" fill={C.textMuted} fontSize={10} fontFamily={MONO}>{t}°</text>
          </g>
        ))}

        {/* X axis labels */}
        {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
          <text key={h} x={xScale(h)} y={height - 6} textAnchor="middle" fill={C.textMuted} fontSize={10} fontFamily={MONO}>
            {h.toString().padStart(2, '0')}:00
          </text>
        ))}

        {/* Comfort band labels */}
        <text x={width - padR - 4} y={yScale(comfortBand.upper80) - 3} textAnchor="end" fill={C.comfort} fontSize={9} fontFamily={MONO} opacity={0.6}>
          ASHRAE 80%
        </text>
        <text x={width - padR - 4} y={yScale(comfortBand.upper90) - 3} textAnchor="end" fill={C.comfort} fontSize={9} fontFamily={MONO} opacity={0.6}>
          90%
        </text>

        {/* Night labels */}
        <text x={xScale(1.5)} y={padT + 14} textAnchor="middle" fill={C.textMuted} fontSize={9} fontFamily={MONO} opacity={0.5}>SLEEP</text>
        <text x={xScale(22.5)} y={padT + 14} textAnchor="middle" fill={C.textMuted} fontSize={9} fontFamily={MONO} opacity={0.5}>SLEEP</text>

        {/* Outdoor temperature line */}
        <path d={outdoorPath} fill="none" stroke={C.outdoor} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.6} />

        {/* House A line */}
        <path d={makePath(resultsA, 'T_air')} fill="none" stroke={C.houseA} strokeWidth={2} />

        {/* House B line */}
        <path d={makePath(resultsB, 'T_air')} fill="none" stroke={C.houseB} strokeWidth={2} />

        {/* Data point dots */}
        {resultsA.map((d, i) => (
          <circle key={`a${i}`} cx={xScale(d.hour)} cy={yScale(d.T_air)} r={2.5} fill={C.houseA} />
        ))}
        {resultsB.map((d, i) => (
          <circle key={`b${i}`} cx={xScale(d.hour)} cy={yScale(d.T_air)} r={2.5} fill={C.houseB} />
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <LegendItem color={C.houseA} label={nameA} />
        <LegendItem color={C.houseB} label={nameB} />
        <LegendItem color={C.outdoor} label="Outdoor" dashed />
        <LegendItem color={C.comfort} label="ASHRAE comfort band" filled />
      </div>
    </div>
  );
}

// ── Humidity Chart (SVG) ─────────────────────────────────────────────────────

function HumidityChart({ resultsA, resultsB, weather, nameA, nameB }) {
  const { width, height, padL, padR, padT, padB } = CHART_H;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const yMin = 30, yMax = 100;
  const xScale = (h) => padL + (h / 23) * plotW;
  const yScale = (rh) => padT + plotH - ((rh - yMin) / (yMax - yMin)) * plotH;

  const makePath = (data, key) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(d.hour).toFixed(1)},${yScale(d[key]).toFixed(1)}`).join(' ');

  const outdoorPath = weather.relativeHumidity.map((rh, i) =>
    `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(rh).toFixed(1)}`
  ).join(' ');

  const yTicks = [40, 50, 60, 70, 80, 90];

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: width, display: 'block' }}>
        {/* Acceptable humidity band 40-70% */}
        <rect
          x={padL} y={yScale(70)}
          width={plotW} height={yScale(40) - yScale(70)}
          fill={C.comfort} opacity={0.08}
        />

        {/* Grid lines */}
        {yTicks.map(rh => (
          <g key={rh}>
            <line x1={padL} y1={yScale(rh)} x2={width - padR} y2={yScale(rh)} stroke={C.border} strokeWidth={0.5} />
            <text x={padL - 6} y={yScale(rh) + 4} textAnchor="end" fill={C.textMuted} fontSize={10} fontFamily={MONO}>{rh}%</text>
          </g>
        ))}

        {/* X axis labels */}
        {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
          <text key={h} x={xScale(h)} y={height - 6} textAnchor="middle" fill={C.textMuted} fontSize={10} fontFamily={MONO}>
            {h.toString().padStart(2, '0')}:00
          </text>
        ))}

        {/* Band label */}
        <text x={width - padR - 4} y={yScale(70) - 3} textAnchor="end" fill={C.comfort} fontSize={9} fontFamily={MONO} opacity={0.6}>
          40–70% acceptable
        </text>

        {/* Outdoor humidity */}
        <path d={outdoorPath} fill="none" stroke={C.outdoor} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.6} />

        {/* House lines */}
        <path d={makePath(resultsA, 'RH_indoor')} fill="none" stroke={C.houseA} strokeWidth={2} />
        <path d={makePath(resultsB, 'RH_indoor')} fill="none" stroke={C.houseB} strokeWidth={2} />
      </svg>

      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <LegendItem color={C.houseA} label={nameA} />
        <LegendItem color={C.houseB} label={nameB} />
        <LegendItem color={C.outdoor} label="Outdoor" dashed />
      </div>
    </div>
  );
}

// ── Legend Item ───────────────────────────────────────────────────────────────

function LegendItem({ color, label, dashed, filled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {filled ? (
        <div style={{ width: 14, height: 10, background: color, opacity: 0.25, borderRadius: 2 }} />
      ) : (
        <svg width={18} height={3}>
          <line x1={0} y1={1.5} x2={18} y2={1.5} stroke={color} strokeWidth={2}
            strokeDasharray={dashed ? '4 2' : 'none'} />
        </svg>
      )}
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.textDim }}>{label}</span>
    </div>
  );
}

// ── Sleep Comfort Scorecard ──────────────────────────────────────────────────

function SleepScorecard({ sleepA, sleepB, nameA, nameB, comfortBand, acMode }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16,
      animation: 'fadeIn .35s ease',
    }}>
      <SleepCard name={nameA} sleep={sleepA} color={C.houseA} comfortBand={comfortBand} acMode={acMode} />
      <SleepCard name={nameB} sleep={sleepB} color={C.houseB} comfortBand={comfortBand} acMode={acMode} />
    </div>
  );
}

function SleepCard({ name, sleep, color, comfortBand, acMode }) {
  const allComfy = sleep.hoursComfortable === sleep.totalHours;
  const borderColor = allComfy ? C.accent + '55' : C.border;

  return (
    <div style={{
      background: C.card, border: `1px solid ${borderColor}`, borderRadius: 10,
      padding: '18px 18px 20px', position: 'relative',
    }}>
      {allComfy && (
        <div style={{
          position: 'absolute', top: -1, right: 16, background: C.accent, color: C.bg,
          fontFamily: MONO, fontSize: 10, fontWeight: 600, padding: '3px 10px',
          borderRadius: '0 0 6px 6px', letterSpacing: 1, textTransform: 'uppercase',
        }}>Comfortable</div>
      )}

      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14, color }}>{name}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.textDim }}>Sleep hours in comfort zone</span>
        <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: allComfy ? C.accent : C.warn }}>
          {sleep.hoursComfortable}/{sleep.totalHours}
        </span>
      </div>

      {/* Comfort hour indicator blocks */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
        {[22, 23, 0, 1, 2, 3, 4, 5].map((h, i) => {
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 6, borderRadius: 3, marginBottom: 4,
                background: i < sleep.hoursComfortable ? C.accent : C.hot + '44',
              }} />
              <span style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted }}>{h.toString().padStart(2, '0')}</span>
            </div>
          );
        })}
      </div>

      <Stat label="Peak overnight temp" value={`${fmt(sleep.peakTemp)}°C`} warn={sleep.peakTemp > comfortBand.upper80} />
      <Stat label="Min overnight temp" value={`${fmt(sleep.minTemp)}°C`} />
      <Stat label="Avg overnight temp" value={`${fmt(sleep.avgTemp)}°C`} />
      <Stat label="Avg overnight RH" value={`${fmt(sleep.avgHumidity, 0)}%`} />

      {acMode && (
        <>
          <div style={{ borderTop: `1px solid ${C.border}`, margin: '10px 0' }} />
          <Stat label="Avg cooling power" value={sleep.avgCoolingPower < 10 ? 'None needed' : `${fmt(sleep.avgCoolingPower / 1000, 2)} kW`} accent={sleep.avgCoolingPower < 10} />
          <Stat label="Overnight energy" value={sleep.totalCoolingWh < 10 ? '0 Wh' : `${fmt(sleep.totalCoolingWh / 1000, 2)} kWh`} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, warn, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.textDim }}>{label}</span>
      <span style={{
        fontFamily: MONO, fontSize: 13, fontWeight: 500,
        color: warn ? C.hot : accent ? C.accent : C.text,
      }}>{value}</span>
    </div>
  );
}

// ── AC Energy Summary ────────────────────────────────────────────────────────

function ACEnergySummary({ sleepA, sleepB, nameA, nameB }) {
  const dayA = sleepA.totalDayCoolingWh;
  const dayB = sleepB.totalDayCoolingWh;
  const maxWh = Math.max(dayA, dayB, 1);
  const saving = dayA - dayB;
  const savingPct = dayA > 0 ? (saving / dayA * 100) : 0;

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: '18px 22px', marginBottom: 16, animation: 'fadeIn .35s ease',
    }}>
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
        AC Cooling Energy — Full Day
      </div>

      {[{ name: nameA, wh: dayA, peak: sleepA.peakCoolingPower, color: C.houseA },
        { name: nameB, wh: dayB, peak: sleepB.peakCoolingPower, color: C.houseB }].map((row, i) => (
        <div key={i} style={{ marginBottom: i === 0 ? 12 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{row.name}</span>
            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: row.color }}>
              {fmt(row.wh / 1000, 1)} kWh
            </span>
          </div>
          <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.max((row.wh / maxWh) * 100, 2)}%`,
              background: row.color, borderRadius: 4, transition: 'width .4s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.textMuted }}>Peak: {fmt(row.peak / 1000, 1)} kW</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.textMuted }}>~${fmt(row.wh / 1000 * 0.30, 2)}/day</span>
          </div>
        </div>
      ))}

      {saving > 100 && (
        <div style={{ marginTop: 14, padding: '12px 16px', background: C.accent + '0a', border: `1px solid ${C.accent}22`, borderRadius: 8, fontSize: 12, color: C.textDim, lineHeight: 1.7 }}>
          <strong style={{ color: C.accent }}>{nameB}</strong> uses{' '}
          <strong style={{ color: C.accent }}>{fmt(savingPct, 0)}% less cooling energy</strong> than{' '}
          <strong style={{ color: C.houseA }}>{nameA}</strong> — saving{' '}
          <strong>{fmt(saving / 1000, 1)} kWh/day</strong> ({fmt(saving / 1000 * 0.30, 2)} NZD/day).
          <br />
          Over a 90-day summer that is approximately{' '}
          <strong style={{ color: C.accent }}>{fmt(saving / 1000 * 90, 0)} kWh</strong> and{' '}
          <strong style={{ color: C.accent }}>${fmt(saving / 1000 * 90 * 0.30, 0)} NZD</strong> saved.
        </div>
      )}
    </div>
  );
}

// ── Method Notes ─────────────────────────────────────────────────────────────

function MethodNotes() {
  return (
    <div style={{
      marginTop: 4, padding: '14px 18px', background: C.card, borderRadius: 8,
      border: `1px solid ${C.border}`, fontSize: 12, color: C.textDim, lineHeight: 1.7, fontFamily: MONO,
    }}>
      <strong style={{ color: C.textMuted }}>Method &amp; References:</strong>
      <br />
      <strong>Thermal model:</strong> EN ISO 13790:2008 Annex C — Simple hourly method (5R1C thermal network).
      Uses Crank-Nicolson finite difference for thermal mass. Constants: h_is = 3.45 W/(m²·K),
      h_ms = 9.1 W/(m²·K), λ_at = 4.5.
      <br />
      <strong>Comfort standard:</strong> ASHRAE Standard 55-2023 §5.4 — Adaptive comfort model for
      naturally ventilated buildings. T_comfort = 0.31 × T_outdoor_mean + 17.8, ±3.5°C for 80% acceptability.
      <br />
      <strong>Humidity:</strong> Simplified single-zone moisture balance. Acceptable indoor RH: 40–70% (ASHRAE 55).
      <br />
      <strong>Weather data:</strong> Typical Auckland hot summer day based on NIWA CliFlo records (Mangere AWS).
      <br />
      <strong>Limitations:</strong> Simplified single-zone model. Does not account for: furniture/contents thermal mass,
      ground coupling, stack effect, window opening behavior, radiant asymmetry, or microclimate variations.
      Annual energy estimates assume this day repeats — actual seasonal variation will differ.
      <br />
      <strong>Open-source reference implementation:</strong> RC_BuildingSimulator (ETH Zurich, GitHub).
    </div>
  );
}
