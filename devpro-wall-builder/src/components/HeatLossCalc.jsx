import { useState, useMemo } from "react";

const defaults = {
  a: { name: "Building A", fabricLoss: "", ach50: "", volume: "", deltaT: "15", nFactor: "20" },
  b: { name: "Building B", fabricLoss: "", ach50: "", volume: "", deltaT: "15", nFactor: "20" },
};

function calc(d) {
  const fabric = parseFloat(d.fabricLoss);
  const ach50 = parseFloat(d.ach50);
  const vol = parseFloat(d.volume);
  const dt = parseFloat(d.deltaT);
  const n = parseFloat(d.nFactor);
  if ([fabric, ach50, vol, dt, n].some(isNaN)) return null;
  const achNat = ach50 / n;
  const qInf = 0.33 * achNat * vol * dt;
  const qTotal = fabric + qInf;
  const pctInf = (qInf / qTotal) * 100;
  return { fabric, achNat, qInf, qTotal, pctInf };
}

function fmt(v, dp = 0) {
  return v.toLocaleString("en-NZ", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

const FONT = `'DM Sans', sans-serif`;
const MONO = `'DM Mono', monospace`;

const colors = {
  bg: "#0f1114",
  card: "#181b20",
  cardHover: "#1e2228",
  border: "#2a2e35",
  accent: "#4dd0a5",
  accentDim: "#2a7a5e",
  warn: "#e8794a",
  text: "#e4e6ea",
  textDim: "#8a8f9a",
  textMuted: "#5a5f6a",
  fabric: "#5b8def",
  infiltration: "#e8794a",
};

export default function HeatLossCalc() {
  const [a, setA] = useState(defaults.a);
  const [b, setB] = useState(defaults.b);

  const rA = useMemo(() => calc(a), [a]);
  const rB = useMemo(() => calc(b), [b]);

  const bothValid = rA && rB;
  const savings = bothValid ? Math.abs(rA.qTotal - rB.qTotal) : 0;
  const better = bothValid ? (rA.qTotal <= rB.qTotal ? "a" : "b") : null;
  const betterName = better === "a" ? a.name : b?.name;

  return (
    <div style={{ fontFamily: FONT, background: colors.bg, color: colors.text, minHeight: "100vh", padding: "24px 16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.accent }} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: colors.textDim, letterSpacing: 2, textTransform: "uppercase" }}>DEVPRO</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Heat Loss Comparison</h1>
          <p style={{ color: colors.textDim, fontSize: 13, margin: "6px 0 0", lineHeight: 1.5 }}>
            Compare total heat loss (fabric + infiltration) for two building envelopes using ACH50 blower door results.
          </p>
        </div>

        {/* Input panels */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <InputPanel label="A" data={a} setData={setA} colors={colors} />
          <InputPanel label="B" data={b} setData={setB} colors={colors} />
        </div>

        {/* Results */}
        {bothValid && (
          <div style={{ animation: "fadeIn .35s ease" }}>
            {/* Summary bar */}
            <div style={{
              background: `linear-gradient(135deg, ${colors.card}, ${colors.cardHover})`,
              border: `1px solid ${colors.accent}33`,
              borderRadius: 10,
              padding: "18px 22px",
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: colors.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                  Better envelope
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: colors.accent }}>{betterName}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: colors.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                  Infiltration saving
                </div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {fmt(savings)} <span style={{ fontSize: 13, fontWeight: 400, color: colors.textDim }}>W</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: colors.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                  Annual saving (est)
                </div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {fmt(savings * 8.76 / 1000, 0)} <span style={{ fontSize: 13, fontWeight: 400, color: colors.textDim }}>kWh/yr</span>
                </div>
              </div>
            </div>

            {/* Detail cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <ResultCard data={a} result={rA} isBetter={better === "a"} colors={colors} />
              <ResultCard data={b} result={rB} isBetter={better === "b"} colors={colors} />
            </div>

            {/* Total heat loss comparison */}
            {(() => {
              const higher = rA.qTotal >= rB.qTotal ? rA : rB;
              const lower = rA.qTotal < rB.qTotal ? rA : rB;
              const higherName = rA.qTotal >= rB.qTotal ? a.name : b.name;
              const lowerName = rA.qTotal < rB.qTotal ? a.name : b.name;
              const pctMore = lower.qTotal > 0 ? (higher.qTotal / lower.qTotal) * 100 : 0;
              const totalDiff = higher.qTotal - lower.qTotal;
              const annualDiffKwh = totalDiff * 8.76 / 1000;
              return (
                <div style={{
                  marginTop: 16,
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: "20px 22px",
                }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: colors.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>
                    Total heat loss — head to head
                  </div>

                  {/* Visual bar comparison */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
                    <div style={{ flex: 1 }}>
                      {/* Building with higher loss */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{higherName}</span>
                        <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: colors.warn }}>{fmt(higher.qTotal)} W</span>
                      </div>
                      <div style={{ height: 10, background: colors.bg, borderRadius: 5, overflow: "hidden", marginBottom: 10 }}>
                        <div style={{ height: "100%", width: "100%", background: colors.warn, borderRadius: 5, transition: "width .4s ease" }} />
                      </div>

                      {/* Building with lower loss */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{lowerName}</span>
                        <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: colors.accent }}>{fmt(lower.qTotal)} W</span>
                      </div>
                      <div style={{ height: 10, background: colors.bg, borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max((lower.qTotal / higher.qTotal) * 100, 2)}%`, background: colors.accent, borderRadius: 5, transition: "width .4s ease" }} />
                      </div>
                    </div>
                  </div>

                  {/* Percentage callout */}
                  <div style={{
                    background: colors.bg,
                    borderRadius: 8,
                    padding: "14px 18px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}>
                    <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                      <span style={{ color: colors.accent, fontWeight: 600 }}>{lowerName}</span>
                      <span style={{ color: colors.textDim }}> is </span>
                      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, color: colors.accent }}>{fmt(pctMore, 0)}%</span>
                      <span style={{ color: colors.textDim }}> better than </span>
                      <span style={{ color: colors.warn, fontWeight: 600 }}>{higherName}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: colors.textDim, letterSpacing: 0.5 }}>DIFFERENCE</div>
                      <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700 }}>
                        {fmt(totalDiff)} W
                        <span style={{ fontSize: 12, fontWeight: 400, color: colors.textDim }}> / {fmt(annualDiffKwh, 0)} kWh·yr</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Method note */}
            <div style={{
              marginTop: 20,
              padding: "14px 18px",
              background: colors.card,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              fontSize: 12,
              color: colors.textDim,
              lineHeight: 1.6,
              fontFamily: MONO,
            }}>
              <strong style={{ color: colors.textMuted }}>Method:</strong>{" "}
              ACHnat = ACH50 ÷ N-factor &nbsp;|&nbsp; Q_inf = 0.33 × ACHnat × V × ΔT &nbsp;|&nbsp; Q_total = Q_fabric + Q_inf
              <br />
              Annual kWh estimate assumes continuous heating (8,760 hrs). Adjust N-factor for exposure (14–26 range, 20 = typical NZ suburban).
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        input:focus { outline: none; border-color: ${colors.accent} !important; box-shadow: 0 0 0 2px ${colors.accent}22; }
      `}</style>
    </div>
  );
}

function InputPanel({ label, data, setData, colors }) {
  const upd = (k) => (e) => setData((d) => ({ ...d, [k]: e.target.value }));

  const inputStyle = {
    width: "100%",
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: "8px 10px",
    color: colors.text,
    fontFamily: MONO,
    fontSize: 14,
    boxSizing: "border-box",
    transition: "border-color .2s, box-shadow .2s",
  };

  const labelStyle = {
    display: "block",
    fontFamily: MONO,
    fontSize: 11,
    color: colors.textDim,
    marginBottom: 4,
    letterSpacing: 0.5,
  };

  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${colors.border}`,
      borderRadius: 10,
      padding: "18px 18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: label === "A" ? colors.fabric + "22" : colors.infiltration + "22",
          color: label === "A" ? colors.fabric : colors.infiltration,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: MONO, fontSize: 12, fontWeight: 600,
        }}>{label}</div>
        <input
          value={data.name}
          onChange={upd("name")}
          style={{ ...inputStyle, fontFamily: FONT, fontWeight: 600, fontSize: 15, border: "none", background: "transparent", padding: 0 }}
          placeholder={`Building ${label}`}
        />
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <Field label="Fabric heat loss (W)" value={data.fabricLoss} onChange={upd("fabricLoss")} style={inputStyle} labelStyle={labelStyle} placeholder="e.g. 2400" />
        <Field label="ACH50 (air changes/hr @ 50Pa)" value={data.ach50} onChange={upd("ach50")} style={inputStyle} labelStyle={labelStyle} placeholder="e.g. 3.0" />
        <Field label="Internal volume (m³)" value={data.volume} onChange={upd("volume")} style={inputStyle} labelStyle={labelStyle} placeholder="e.g. 320" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="ΔT (°C)" value={data.deltaT} onChange={upd("deltaT")} style={inputStyle} labelStyle={labelStyle} placeholder="15" />
          <Field label="N-factor" value={data.nFactor} onChange={upd("nFactor")} style={inputStyle} labelStyle={labelStyle} placeholder="20" />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, style, labelStyle, placeholder }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type="number" value={value} onChange={onChange} style={style} placeholder={placeholder} step="any" />
    </div>
  );
}

function ResultCard({ data, result, isBetter, colors }) {
  const r = result;

  const Bar = ({ val, color, label }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: colors.textDim }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500 }}>{fmt(val)} W</span>
      </div>
      <div style={{ height: 6, background: colors.bg, borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${Math.max((val / (r.qTotal)) * 100, 2)}%`,
          background: color,
          borderRadius: 3,
          transition: "width .4s ease",
        }} />
      </div>
    </div>
  );

  return (
    <div style={{
      background: colors.card,
      border: `1px solid ${isBetter ? colors.accent + "55" : colors.border}`,
      borderRadius: 10,
      padding: "18px 18px 20px",
      position: "relative",
    }}>
      {isBetter && (
        <div style={{
          position: "absolute", top: -1, right: 16,
          background: colors.accent, color: colors.bg,
          fontFamily: MONO, fontSize: 10, fontWeight: 600,
          padding: "3px 10px", borderRadius: "0 0 6px 6px",
          letterSpacing: 1, textTransform: "uppercase",
        }}>Better</div>
      )}
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>{data.name}</div>

      <Bar val={r.fabric} color={colors.fabric} label="Fabric" />
      <Bar val={r.qInf} color={colors.infiltration} label="Infiltration" />

      <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: 12, paddingTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: colors.textDim }}>Total heat loss</span>
          <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: isBetter ? colors.accent : colors.text }}>
            {fmt(r.qTotal)} <span style={{ fontSize: 12, fontWeight: 400, color: colors.textDim }}>W</span>
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: colors.textDim }}>ACHnat</span>
          <span style={{ fontFamily: MONO, fontSize: 13 }}>{r.achNat.toFixed(3)} ACH</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: colors.textDim }}>Infiltration share</span>
          <span style={{ fontFamily: MONO, fontSize: 13 }}>{r.pctInf.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
