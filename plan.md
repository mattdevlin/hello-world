# Comfort Simulator — Implementation Plan

## Goal
Model indoor temperature and humidity hour-by-hour over a 24-hour Auckland summer day for two building envelopes (Typical NZ House vs DEVPRO SIP House). Show whether each house can maintain comfort for sleeping without active cooling, and if not, how much AC energy is required.

## Scientific Method: ISO 13790 5R1C Simplified Hourly Model

**Standard:** EN ISO 13790:2008 Annex C — "Simple hourly method"
**Superseded by:** ISO 52016-1:2017 (same core method, expanded)
**Comfort standard:** ASHRAE Standard 55-2023 — Adaptive Comfort Model
**Humidity model:** Simplified moisture balance (infiltration/ventilation exchange with outdoor humidity)

### References
- ISO 13790:2008, Clause C — 5R1C thermal network, hourly timestep
- ASHRAE Standard 55 — Adaptive comfort model for naturally ventilated buildings
- NIWA CliFlo — Auckland summer climate data (Mangere AWS)
- RC_BuildingSimulator (ETH Zurich) — open-source ISO 13790 implementation

### The 5R1C Thermal Network

Five resistances (R) and one capacitance (C) model the building zone:

```
  T_ext ──[H_tr_em]──┬──[H_tr_ms]── T_s ──[H_tr_is]── T_air
                      │                                   │
                     [C_m]                            [H_ve_adj]
                   (T_mass)                               │
                      │                                T_supply
                      └──[H_tr_w]── T_ext
```

**Temperature nodes:** T_air (indoor air), T_s (internal surfaces), T_mass (thermal mass)
**Boundary nodes:** T_ext (outdoor), T_supply (ventilation supply air)

### Key Equations (ISO 13790 Annex C)

```
// Combined conductances (C.6–C.8)
H_tr_1 = 1 / (1/H_ve + 1/H_tr_is)
H_tr_2 = H_tr_1 + H_tr_w
H_tr_3 = 1 / (1/H_tr_2 + 1/H_tr_ms)

// Total heat flux to mass node (C.5)
φ_m_tot = φ_m + H_tr_em × T_ext + H_tr_3 × (φ_st + H_tr_w × T_ext + H_tr_1 × (T_supply + φ_ia/H_ve)) / H_tr_2

// Thermal mass temperature update — Crank-Nicolson (C.4)
T_m_next = (T_m_prev × (C_m/3600 − 0.5×(H_tr_3 + H_tr_em)) + φ_m_tot) / (C_m/3600 + 0.5×(H_tr_3 + H_tr_em))
T_m = (T_m_next + T_m_prev) / 2                        // (C.9)

// Surface temperature (C.10)
T_s = (H_tr_ms × T_m + φ_st + H_tr_w × T_ext + H_tr_1 × (T_supply + φ_ia/H_ve)) / (H_tr_ms + H_tr_w + H_tr_1)

// Indoor air temperature (C.11)
T_air = (H_tr_is × T_s + H_ve × T_supply + φ_ia) / (H_tr_is + H_ve)

// ISO 13790 constants
h_is = 3.45 W/(m²·K)    // convective surface coefficient
h_ms = 9.1 W/(m²·K)     // radiative mass-surface coupling
λ_at = 4.5               // A_t / A_floor ratio
```

### Heat gain distribution (ISO 13790 §C.2)
- φ_ia = 0.5 × φ_int (internal gains to air node)
- φ_st = (1 − A_m/A_t − H_tr_w/(9.1×A_t)) × (0.5×φ_int + φ_sol) (to surface node)
- φ_m = (A_m/A_t) × (0.5×φ_int + φ_sol) (to mass node)

### ASHRAE 55 Adaptive Comfort Model
```
T_comfort = 0.31 × T_prevailing_outdoor + 17.8
80% acceptability band: T_comfort ± 3.5°C
90% acceptability band: T_comfort ± 2.5°C
```
For Auckland summer (mean outdoor ~22°C): T_comfort ≈ 24.6°C, 80% band = 21.1–28.1°C

### Humidity Model (simplified moisture balance)
Indoor humidity ratio updated each hour based on:
- Air exchange with outdoor humidity (via infiltration + ventilation)
- Internal moisture gains (occupants, ~50g/hr per person)
- Psychrometric conversion from humidity ratio to RH at indoor temperature

## Implementation Steps

### Step 1: Create `src/utils/comfortSimulator.js` — Pure calculation engine

**Contents:**
- `AUCKLAND_SUMMER_DAY` — 24-hour weather profile (temperature, RH, solar radiation) based on NIWA CliFlo typical hot day data
- `ISO_CONSTANTS` — h_is, h_ms, λ_at values from ISO 13790
- `deriveISO13790Params(preset)` — convert house presets to 5R1C network parameters (C_m, H_tr_em, H_tr_w, H_tr_ms, H_tr_is, H_ve)
- `simulateHour(state, params, weather, hour, options)` — single ISO 13790 Annex C timestep
- `simulate(params, weather, options)` — 24-hour loop returning hourly {T_air, T_mass, T_surface, RH_indoor, coolingPower}
- `adaptiveComfortBand(T_outdoor_mean)` — ASHRAE 55 adaptive comfort bounds
- `computeIndoorHumidity(T_air, T_ext, RH_ext, ACH, volume)` — simplified psychrometric moisture balance
- `evaluateSleepComfort(results, comfortBand)` — score 10pm–6am: hours in comfort zone, peak temp, avg cooling needed

### Step 2: Create `src/components/ComfortSimulator.jsx` — React UI

**Layout (top to bottom):**
1. Header with DEVPRO branding (matching HeatLossCalc style)
2. Mode toggle: [Passive Only] [With AC]
3. Two input panels side-by-side (house A / house B parameters)
4. SVG temperature chart — outdoor line (dashed), House A line, House B line, ASHRAE comfort band (green shading), night hours (dark overlay 10pm-6am)
5. SVG humidity chart — outdoor RH (dashed), House A RH, House B RH, target band shading
6. Sleep comfort scorecard — side-by-side cards showing: hours in comfort zone, peak overnight temp, avg cooling power needed (AC mode)
7. AC energy summary (when AC mode): total kWh overnight per house
8. Method references section

**SVG Charts (no dependencies):**
- X axis: 0–24 hours, Y axis: temperature (°C) or humidity (%)
- Comfort band as semi-transparent rectangle
- Night hours (22:00–06:00) as dark overlay columns
- Smooth polyline paths for temperature curves
- Tooltip on hover showing exact values per hour

**State:** `acMode`, `acSetpoint`, `houseA`, `houseB` — results computed via `useMemo`

### Step 3: Create `src/pages/ComfortPage.jsx` — thin page wrapper

Minimal wrapper matching H1Page.jsx pattern — just renders `<ComfortSimulator />`.

### Step 4: Update `src/App.jsx` — add route

```js
{ path: '/comfort', element: <ComfortPage /> }
```

## File Change Summary

| File | Action |
|------|--------|
| `src/utils/comfortSimulator.js` | **New** — ISO 13790 5R1C simulation engine |
| `src/components/ComfortSimulator.jsx` | **New** — React UI with SVG charts |
| `src/pages/ComfortPage.jsx` | **New** — page wrapper |
| `src/App.jsx` | **Update** — add `/comfort` route |

## Expected Outputs

**Typical NZ House (leaky, no ERV):**
- Indoor temp peaks ~27-28°C mid-afternoon (2-3hr lag behind outdoor peak)
- Stays above 24°C from 11am to 10pm
- Night temp stays ~24-25°C (thermal mass releases stored heat)
- Cannot sleep comfortably without AC
- AC needs ~1.5-2.5 kW cooling to maintain 23°C overnight

**DEVPRO SIP House (tight, with ERV):**
- Indoor temp peaks ~22-23°C (much lower due to insulation + controlled ventilation)
- ERV pre-cools incoming air, reducing ventilation heat gain by 80%
- Night temp drops to ~21-22°C
- Comfortable sleeping without AC
- AC needed: 0 or minimal (<0.3 kW)
