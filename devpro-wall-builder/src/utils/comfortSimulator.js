/**
 * Comfort Simulator — ISO 13790 5R1C Simplified Hourly Method
 *
 * References:
 *   - EN ISO 13790:2008 Annex C — Simple hourly method (5R1C thermal network)
 *   - ASHRAE Standard 55-2023 §5.4 — Adaptive comfort model
 *   - NIWA CliFlo — Auckland (Mangere AWS) summer climate normals
 *   - RC_BuildingSimulator (ETH Zurich) — open-source ISO 13790 implementation
 *
 * The 5R1C network models a building zone with:
 *   5 thermal resistances: H_tr_em, H_tr_ms, H_tr_is, H_tr_w, H_ve
 *   1 thermal capacitance: C_m (building thermal mass)
 *   3 temperature nodes: T_air, T_surface, T_mass
 *   2 boundary nodes: T_ext (outdoor), T_supply (ventilation supply)
 */

// ── ISO 13790 Constants ──────────────────────────────────────────────────────

const H_IS_COEFF = 3.45;   // W/(m²·K) — convective air-to-surface coefficient
const H_MS_COEFF = 9.1;    // W/(m²·K) — radiative mass-to-surface coefficient
const LAMBDA_AT = 4.5;     // A_t / A_floor ratio (total internal surface area)
const AIR_VOL_HEAT_CAP = 0.33; // W·h/(m³·K) — volumetric heat capacity of air

// Thermal capacitance per floor area for construction classes (ISO 13790 Table 12)
// J/(m²·K) — "very light" = 80k, "light" = 110k, "medium" = 165k, "heavy" = 260k
const THERMAL_MASS_LIGHT = 110000;   // light timber frame
const THERMAL_MASS_MEDIUM = 165000;  // concrete slab + timber frame

// ── Auckland Summer Weather Data ─────────────────────────────────────────────
// Typical hot day (late January/early February), based on NIWA CliFlo records
// for Auckland Airport (Mangere AWS). Represents a clear, warm anticyclonic day.
// Hour 0 = midnight.

export const AUCKLAND_SUMMER = {
  label: 'Auckland — typical hot summer day (Jan/Feb)',
  // Outdoor dry-bulb temperature (°C)
  temperature: [
    19.5, 19.0, 18.5, 18.0, 17.5, 17.0,  // 00–05  overnight cooling
    17.5, 19.0, 21.0, 23.0, 24.5, 26.0,  // 06–11  morning warming
    27.0, 27.5, 28.0, 27.5, 27.0, 26.0,  // 12–17  afternoon peak
    24.5, 23.0, 22.0, 21.0, 20.5, 20.0,  // 18–23  evening cooling
  ],
  // Outdoor relative humidity (%)
  relativeHumidity: [
    82, 84, 85, 87, 88, 88,  // 00–05
    86, 80, 72, 65, 60, 56,  // 06–11
    53, 52, 50, 52, 55, 60,  // 12–17
    66, 72, 75, 78, 80, 81,  // 18–23
  ],
  // Global horizontal solar irradiance (W/m²) — clear sky, Auckland latitude ~37°S
  solarGHI: [
    0, 0, 0, 0, 0, 0,         // 00–05  night
    50, 180, 380, 560, 700, 790,  // 06–11  morning
    820, 790, 700, 560, 380, 180, // 12–17  afternoon
    50, 0, 0, 0, 0, 0,        // 18–23  evening/night
  ],
  // Mean outdoor temperature for ASHRAE adaptive comfort calculation
  meanOutdoorTemp: 22.0,
};

// ── Building Presets ─────────────────────────────────────────────────────────

export const HOUSE_PRESETS = {
  typical: {
    name: 'Typical NZ House',
    description: '1990s timber-frame, aluminium single-glazed, no mechanical ventilation',
    // Envelope — realistic NZ code-minimum construction (120m²)
    floorArea: 120,          // m² — typical 3-bed NZ house
    ceilingHeight: 2.7,      // m
    // Opaque envelope: walls R2.0 (90m²=45W/K) + roof R2.9 (120m²=41W/K) + floor R1.3 (120m²=92W/K)
    opaqueUA: 100,           // W/K — combined opaque envelope conductance
    // Windows: 30m² single-glazed aluminium (U=5.8), SHGC ≈ 0.7
    windowArea: 30,          // m²
    windowU: 5.8,            // W/(m²·K) — single glazed aluminium
    thermalMassClass: 'light',
    // Airtightness
    ach50: 6,                // ACH @ 50Pa — typical older NZ house
    nFactor: 20,             // Sherman-Grimsrud for suburban NZ
    // Ventilation
    ervEnabled: false,
    ervAch: 0,
    ervEfficiency: 0,
    // Solar — single glazed, high SHGC, mixed orientations → effective aperture
    solarAperture: 6.0,      // m² — 30m² × SHGC 0.7 × orientation factor ~0.3
    // Internal gains
    occupants: 3,
    internalGainsBase: 200,   // W — appliances, lighting base load
  },
  devpro: {
    name: 'DEVPRO SIP House',
    description: 'SIP panel construction, double-glazed low-e, ERV mechanical ventilation',
    floorArea: 120,
    ceilingHeight: 2.7,
    // Opaque envelope: SIP walls R6.0 (90m²=15W/K) + roof R6.0 (120m²=20W/K) + floor R3.0 (120m²=40W/K)
    opaqueUA: 35,            // W/K — well-insulated SIP envelope
    // Windows: 30m² double-glazed low-e argon (U=1.8), SHGC ≈ 0.4
    windowArea: 30,          // m²
    windowU: 1.8,            // W/(m²·K) — double-glazed low-e argon
    thermalMassClass: 'light',
    ach50: 1,                // ACH @ 50Pa — very tight SIP construction
    nFactor: 20,
    ervEnabled: true,
    ervAch: 0.5,
    ervEfficiency: 0.80,     // 80% heat recovery
    solarAperture: 3.5,      // m² — 30m² × SHGC 0.4 × orientation factor ~0.3
    occupants: 3,
    internalGainsBase: 200,
  },
};

// ── Parameter Derivation ─────────────────────────────────────────────────────

/**
 * Convert a house preset into the 5R1C network parameters needed by the simulator.
 * Maps the user-friendly building description to ISO 13790 Annex C thermal network.
 */
export function deriveISO13790Params(preset) {
  const volume = preset.floorArea * preset.ceilingHeight;
  const A_floor = preset.floorArea;
  const A_t = LAMBDA_AT * A_floor;               // total internal surface area
  const A_m = 2.5 * A_floor;                     // effective mass area (light construction)

  // Thermal capacitance
  const cmPerArea = preset.thermalMassClass === 'medium' ? THERMAL_MASS_MEDIUM : THERMAL_MASS_LIGHT;
  const C_m = cmPerArea * A_floor;                // J/K

  // Envelope conductances — directly from preset physical properties
  const H_tr_w = preset.windowU * preset.windowArea;  // window conductance (W/K)
  const H_tr_em = preset.opaqueUA;                     // opaque envelope conductance (W/K)

  // Internal couplings (ISO 13790 constants)
  const H_tr_ms = H_MS_COEFF * A_m;               // mass-surface coupling
  const H_tr_is = H_IS_COEFF * A_t;               // air-surface coupling

  // Ventilation conductance — natural infiltration
  const ACH_nat = preset.ach50 / preset.nFactor;
  const H_ve_inf = AIR_VOL_HEAT_CAP * ACH_nat * volume;

  // ERV ventilation conductance — two modes:
  //   Normal (outdoor hotter than indoor): recovery active, H_ve reduced by efficiency
  //   Bypass (outdoor cooler than indoor): recovery bypassed, full ventilation rate
  const H_ve_erv_normal = preset.ervEnabled
    ? AIR_VOL_HEAT_CAP * preset.ervAch * volume * (1 - preset.ervEfficiency)
    : 0;
  const H_ve_erv_bypass = preset.ervEnabled
    ? AIR_VOL_HEAT_CAP * preset.ervAch * volume  // full rate, no recovery
    : 0;

  return {
    volume,
    A_floor,
    A_t,
    A_m,
    C_m,
    H_tr_em,
    H_tr_w,
    H_tr_ms,
    H_tr_is,
    H_ve_inf,
    H_ve_erv_normal,
    H_ve_erv_bypass,
    ACH_nat,
    solarAperture: preset.solarAperture,
    occupants: preset.occupants,
    internalGainsBase: preset.internalGainsBase,
    ervEnabled: preset.ervEnabled,
    ervEfficiency: preset.ervEfficiency,
    ervAch: preset.ervAch,
  };
}

// ── Internal Gains Schedule ──────────────────────────────────────────────────

/**
 * Hourly internal heat gains (W) — occupants + appliances + lighting.
 * Occupant sensible heat ≈ 70W/person (seated/sleeping).
 * Gains are lower overnight (sleeping, fewer appliances).
 */
function getInternalGains(hour, occupants, baseGains) {
  const occupantHeat = 70; // W/person sensible
  // Occupancy fraction: 1.0 when home, 0.3 when some are out (9am–5pm)
  let occFrac = 1.0;
  if (hour >= 9 && hour < 17) occFrac = 0.3;

  // Appliance/lighting multiplier: lower overnight
  let applianceMult = 1.0;
  if (hour >= 23 || hour < 6) applianceMult = 0.3;
  else if (hour >= 6 && hour < 9) applianceMult = 0.8;

  return occupants * occupantHeat * occFrac + baseGains * applianceMult;
}

// ── ISO 13790 Hourly Simulation ──────────────────────────────────────────────

/**
 * Run a single hourly timestep of the ISO 13790 5R1C model.
 *
 * @param {number} T_m_prev — mass temperature from previous hour (°C)
 * @param {object} p — derived ISO 13790 parameters
 * @param {number} T_ext — outdoor temperature (°C)
 * @param {number} solarGHI — global horizontal irradiance (W/m²)
 * @param {number} hour — hour of day (0-23)
 * @param {object} options — { acEnabled, acSetpoint }
 * @returns {object} — { T_air, T_s, T_m_next, coolingPower }
 */
function simulateHour(T_m_prev, p, T_ext, solarGHI, hour, options = {}, T_air_prev = null) {
  // Heat gains
  const phi_int = getInternalGains(hour, p.occupants, p.internalGainsBase);
  const phi_sol = solarGHI * p.solarAperture; // solar gain through glazing (W)

  // ISO 13790 §C.2 — distribute gains to nodes
  const phi_ia = 0.5 * phi_int;
  const phi_st_coeff = 1 - p.A_m / p.A_t - p.H_tr_w / (9.1 * p.A_t);
  const phi_st = Math.max(0, phi_st_coeff) * (0.5 * phi_int + phi_sol);
  const phi_m = (p.A_m / p.A_t) * (0.5 * phi_int + phi_sol);

  // ERV summer bypass: when outdoor is cooler than indoor, bypass heat recovery
  // to allow free cooling. A well-designed ERV automatically does this.
  const indoorEstimate = T_air_prev !== null ? T_air_prev : T_m_prev;
  const freeCooling = T_ext < indoorEstimate;
  const H_ve_erv = freeCooling ? p.H_ve_erv_bypass : p.H_ve_erv_normal;
  const H_ve = Math.max(p.H_ve_inf + H_ve_erv, 0.001); // prevent division by zero

  const T_supply = T_ext; // ERV effect modeled via H_ve conductance

  // Combined conductances (ISO 13790 equations C.6–C.8)
  const H_tr_1 = 1 / (1 / H_ve + 1 / p.H_tr_is);
  const H_tr_2 = H_tr_1 + p.H_tr_w;
  const H_tr_3 = 1 / (1 / H_tr_2 + 1 / p.H_tr_ms);

  // Run the 5R1C without active cooling first
  const result = solve5R1C(T_m_prev, p, T_ext, T_supply, H_ve, H_tr_1, H_tr_2, H_tr_3, phi_ia, phi_st, phi_m, 0);

  let coolingPower = 0;

  // If AC enabled and too warm, find cooling power to reach setpoint
  if (options.acEnabled && result.T_air > options.acSetpoint) {
    // Binary search for cooling power (negative phi_HC)
    let lo = 0;
    let hi = 10000; // max 10kW cooling
    for (let iter = 0; iter < 30; iter++) {
      const mid = (lo + hi) / 2;
      const trial = solve5R1C(T_m_prev, p, T_ext, T_supply, H_ve, H_tr_1, H_tr_2, H_tr_3, phi_ia, phi_st, phi_m, -mid);
      if (trial.T_air > options.acSetpoint) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    coolingPower = (lo + hi) / 2;
    const cooled = solve5R1C(T_m_prev, p, T_ext, T_supply, H_ve, H_tr_1, H_tr_2, H_tr_3, phi_ia, phi_st, phi_m, -coolingPower);
    return { ...cooled, coolingPower };
  }

  return { ...result, coolingPower };
}

/**
 * Solve the 5R1C network for a single timestep (ISO 13790 Annex C equations C.4–C.11).
 *
 * @param {number} phi_HC — heating/cooling power (W), negative = cooling
 */
function solve5R1C(T_m_prev, p, T_ext, T_supply, H_ve, H_tr_1, H_tr_2, H_tr_3, phi_ia, phi_st, phi_m, phi_HC) {

  // Distribute HC power: 50% to air, 50% to surface (ISO 13790 simplified assumption)
  const phi_ia_total = phi_ia + 0.5 * phi_HC;
  const phi_st_total = phi_st + 0.5 * phi_HC;

  // Total heat flux to mass node (equation C.5)
  const phi_m_tot = phi_m + p.H_tr_em * T_ext +
    H_tr_3 * (phi_st_total + p.H_tr_w * T_ext + H_tr_1 * (T_supply + phi_ia_total / H_ve)) / H_tr_2;

  // Thermal mass temperature update — Crank-Nicolson (equation C.4)
  const C_m_dt = p.C_m / 3600; // convert J/K to Wh/K for hourly timestep
  const T_m_next = (T_m_prev * (C_m_dt - 0.5 * (H_tr_3 + p.H_tr_em)) + phi_m_tot) /
    (C_m_dt + 0.5 * (H_tr_3 + p.H_tr_em));

  // Average mass temperature over timestep (equation C.9)
  const T_m = (T_m_next + T_m_prev) / 2;

  // Surface temperature (equation C.10)
  const T_s = (p.H_tr_ms * T_m + phi_st_total + p.H_tr_w * T_ext +
    H_tr_1 * (T_supply + phi_ia_total / H_ve)) /
    (p.H_tr_ms + p.H_tr_w + H_tr_1);

  // Indoor air temperature (equation C.11)
  const T_air = (p.H_tr_is * T_s + H_ve * T_supply + phi_ia_total) /
    (p.H_tr_is + H_ve);

  return { T_air, T_s, T_m_next };
}

// ── Humidity Model ───────────────────────────────────────────────────────────

/**
 * Simplified indoor humidity calculation.
 *
 * Uses a single-zone moisture balance:
 *   dW/dt = ACH × (W_outdoor - W_indoor) + moisture_generation / (ρ × V)
 *
 * Where W = humidity ratio (g/kg dry air).
 * Converted back to RH using psychrometric relations.
 */

/** Saturation vapor pressure (Pa) — Magnus formula */
function satVaporPressure(T) {
  return 610.78 * Math.exp((17.27 * T) / (T + 237.3));
}

/** Convert RH (%) + temperature (°C) → humidity ratio (g/kg) */
function rhToHumidityRatio(rh, T) {
  const pSat = satVaporPressure(T);
  const pV = (rh / 100) * pSat;
  const P = 101325; // atmospheric pressure (Pa)
  return 622 * pV / (P - pV); // g/kg
}

/** Convert humidity ratio (g/kg) + temperature (°C) → RH (%) */
function humidityRatioToRH(w, T) {
  const P = 101325;
  const pV = (w * P) / (622 + w);
  const pSat = satVaporPressure(T);
  return Math.min(100, Math.max(0, (pV / pSat) * 100));
}

/**
 * Update indoor humidity ratio for one hour.
 *
 * @param {number} w_indoor — current indoor humidity ratio (g/kg)
 * @param {number} T_air — indoor air temp (°C)
 * @param {number} T_ext — outdoor temp (°C)
 * @param {number} rh_ext — outdoor RH (%)
 * @param {number} ACH — total air changes per hour
 * @param {number} occupants — number of people
 * @param {number} hour — hour of day
 * @returns {number} — updated indoor humidity ratio (g/kg)
 */
function updateHumidity(w_indoor, T_ext, rh_ext, ACH, volume, occupants, hour) {
  const w_outdoor = rhToHumidityRatio(rh_ext, T_ext);

  // Moisture generation: ~50 g/hr per person (breathing + skin), less when sleeping
  const isSleeping = hour >= 23 || hour < 6;
  const moisturePerPerson = isSleeping ? 30 : 50; // g/hr
  const occFrac = (hour >= 9 && hour < 17) ? 0.3 : 1.0;
  const moistureGen = occupants * occFrac * moisturePerPerson; // g/hr

  // Air density ≈ 1.2 kg/m³
  const airMass = 1.2 * volume; // kg

  // Moisture balance: infiltration exchange + internal generation
  // dW = ACH × (W_out - W_in) × dt + moistureGen / airMass × dt
  const dW = ACH * (w_outdoor - w_indoor) + moistureGen / airMass;

  return Math.max(0, w_indoor + dW);
}

// ── Full 24-Hour Simulation ──────────────────────────────────────────────────

/**
 * Run a full 24-hour simulation for one building.
 *
 * @param {object} preset — house preset (from HOUSE_PRESETS or user-modified)
 * @param {object} weather — hourly weather data (AUCKLAND_SUMMER)
 * @param {object} options — { acEnabled: bool, acSetpoint: number }
 * @returns {Array<object>} — 24 entries with hourly results
 */
export function simulate(preset, weather = AUCKLAND_SUMMER, options = { acEnabled: false, acSetpoint: 23 }) {
  const p = deriveISO13790Params(preset);
  const results = [];

  // Initialize: assume building starts at equilibrium with midnight outdoor temp
  let T_m = weather.temperature[0];
  let T_air_prev = weather.temperature[0];
  // Initial indoor humidity from outdoor conditions
  let w_indoor = rhToHumidityRatio(weather.relativeHumidity[0], weather.temperature[0]);

  const totalACH = p.ACH_nat + (preset.ervAch || 0);

  // Run a 24-hour "warm-up" cycle first to stabilize thermal mass
  for (let hour = 0; hour < 24; hour++) {
    const step = simulateHour(T_m, p, weather.temperature[hour], weather.solarGHI[hour], hour, options, T_air_prev);
    T_m = step.T_m_next;
    T_air_prev = step.T_air;
    w_indoor = updateHumidity(w_indoor, weather.temperature[hour], weather.relativeHumidity[hour], totalACH, p.volume, p.occupants, hour);
  }

  // Now run the actual 24-hour simulation
  for (let hour = 0; hour < 24; hour++) {
    const T_ext = weather.temperature[hour];
    const step = simulateHour(T_m, p, T_ext, weather.solarGHI[hour], hour, options, T_air_prev);

    w_indoor = updateHumidity(w_indoor, T_ext, weather.relativeHumidity[hour], totalACH, p.volume, p.occupants, hour);
    const rh_indoor = humidityRatioToRH(w_indoor, step.T_air);

    results.push({
      hour,
      T_ext,
      T_air: step.T_air,
      T_surface: step.T_s,
      T_mass: step.T_m_next,
      RH_ext: weather.relativeHumidity[hour],
      RH_indoor: rh_indoor,
      solarGHI: weather.solarGHI[hour],
      coolingPower: step.coolingPower,
    });

    T_m = step.T_m_next;
    T_air_prev = step.T_air;
  }

  return results;
}

// ── ASHRAE 55 Adaptive Comfort ───────────────────────────────────────────────

/**
 * ASHRAE Standard 55-2023 §5.4 — Adaptive comfort model.
 *
 * For naturally ventilated buildings, the acceptable operative temperature
 * is a function of the prevailing mean outdoor temperature:
 *   T_comfort = 0.31 × T_prevailing_outdoor + 17.8
 *
 * 80% acceptability band: T_comfort ± 3.5°C
 * 90% acceptability band: T_comfort ± 2.5°C
 *
 * Valid for 10°C ≤ T_prevailing_outdoor ≤ 33.5°C
 */
export function adaptiveComfortBand(meanOutdoorTemp) {
  const T_comfort = 0.31 * meanOutdoorTemp + 17.8;
  return {
    neutral: T_comfort,
    lower80: T_comfort - 3.5,
    upper80: T_comfort + 3.5,
    lower90: T_comfort - 2.5,
    upper90: T_comfort + 2.5,
  };
}

// ── Sleep Comfort Evaluation ─────────────────────────────────────────────────

/**
 * Evaluate overnight sleep comfort (10pm – 6am).
 *
 * @param {Array} results — 24-hour simulation output
 * @param {object} comfortBand — from adaptiveComfortBand()
 * @returns {object} — sleep comfort metrics
 */
export function evaluateSleepComfort(results, comfortBand) {
  // Sleep hours: 22, 23, 0, 1, 2, 3, 4, 5 (8 hours)
  const sleepHours = [22, 23, 0, 1, 2, 3, 4, 5];
  const sleepData = sleepHours.map(h => results[h]);

  const temps = sleepData.map(d => d.T_air);
  const humidities = sleepData.map(d => d.RH_indoor);

  // Count hours within comfort band
  const hoursInTempBand = sleepData.filter(d =>
    d.T_air >= comfortBand.lower80 && d.T_air <= comfortBand.upper80
  ).length;

  // Humidity comfort: 40-70% is acceptable per ASHRAE 55
  const hoursInHumidityBand = sleepData.filter(d =>
    d.RH_indoor >= 40 && d.RH_indoor <= 70
  ).length;

  // Hours where both temp AND humidity are comfortable
  const hoursComfortable = sleepData.filter(d =>
    d.T_air >= comfortBand.lower80 && d.T_air <= comfortBand.upper80 &&
    d.RH_indoor >= 40 && d.RH_indoor <= 70
  ).length;

  const peakTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);
  const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
  const avgHumidity = humidities.reduce((a, b) => a + b, 0) / humidities.length;

  // Total cooling energy overnight (Wh)
  const totalCoolingWh = sleepData.reduce((sum, d) => sum + d.coolingPower, 0); // each hour = 1 Wh per W
  const avgCoolingPower = totalCoolingWh / sleepHours.length;

  // Full-day cooling energy (Wh)
  const totalDayCoolingWh = results.reduce((sum, d) => sum + d.coolingPower, 0);
  const peakCoolingPower = Math.max(...results.map(d => d.coolingPower));
  const peakDayTemp = Math.max(...results.map(d => d.T_air));

  return {
    totalHours: sleepHours.length,
    hoursInTempBand,
    hoursInHumidityBand,
    hoursComfortable,
    peakTemp,
    minTemp,
    avgTemp,
    avgHumidity,
    totalCoolingWh,
    avgCoolingPower,
    totalDayCoolingWh,
    peakCoolingPower,
    peakDayTemp,
  };
}
