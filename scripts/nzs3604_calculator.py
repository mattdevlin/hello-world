#!/usr/bin/env python3
"""
NZS 3604:2011 Stickframe Calculator Engine

Calculates full prescriptive timber framing specifications for NZ residential
buildings per NZS 3604:2011. SG8 grade only. Reads measurements JSON + site
params, looks up nzs3604_tables.json, and outputs a design JSON.

Usage:
    python nzs3604_calculator.py measurements.json [output.json]
"""

import json
import math
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# 1. TABLE LOADER
# ---------------------------------------------------------------------------

_TABLES = None  # cached after first load


def load_tables(path: str | None = None) -> dict:
    """Load and cache nzs3604_tables.json. Default path is repo root."""
    global _TABLES
    if _TABLES is not None:
        return _TABLES
    if path is None:
        # Look relative to this script's directory, then one level up (repo root)
        script_dir = Path(__file__).resolve().parent
        path = script_dir.parent / "nzs3604_tables.json"
    with open(path, "r") as f:
        _TABLES = json.load(f)
    return _TABLES


# ---------------------------------------------------------------------------
# 2. CORE LOOKUP FUNCTIONS
# ---------------------------------------------------------------------------


def table_lookup(entries: dict, value: float) -> str:
    """Generic NZS 3604 table lookup — round UP to the next row (conservative).

    `entries` is a dict keyed by string numbers (e.g. "2.4", "3.0").
    Returns the key of the smallest entry >= value, or None if value exceeds
    all entries.

    Example:
        table_lookup({"2.4": ..., "2.8": ..., "3.2": ...}, 2.5)
        → "2.8"  (rounds up from 2.5 to next row 2.8)
    """
    numeric_keys = []
    for k in entries:
        if k.startswith("_"):
            continue
        try:
            numeric_keys.append((float(k), k))
        except ValueError:
            continue
    numeric_keys.sort(key=lambda x: x[0])

    for num, key in numeric_keys:
        if num >= value - 1e-9:  # tolerance for float comparison
            return key
    return None  # value exceeds table range


def size_lookup(entries: dict, required_span: float) -> str | None:
    """Find the smallest member size where max_span >= required_span.

    `entries` is a dict keyed by size string (e.g. "90x45", "140x45"),
    where each value is a max span number (or a dict containing a span).

    Returns the size string, or None if no size is adequate.
    """
    candidates = []
    for size, data in entries.items():
        if size.startswith("_"):
            continue
        if isinstance(data, (int, float)):
            max_span = data
        elif isinstance(data, dict) and "max_span" in data:
            max_span = data["max_span"]
        else:
            continue
        if max_span >= required_span - 1e-9:
            # Parse size to get a sortable dimension (e.g. 90x45 → 90*45=4050)
            try:
                parts = size.split("x")
                area = int(parts[0]) * int(parts[1])
            except (ValueError, IndexError):
                area = 0
            candidates.append((area, size))

    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0])
    return candidates[0][1]  # smallest adequate member


# ---------------------------------------------------------------------------
# 3. SITE CLASSIFICATION
# ---------------------------------------------------------------------------


def determine_wind_zone(site: dict) -> str:
    """Determine wind zone from site parameters using Table 5.4.

    Args:
        site: dict with keys:
            - wind_region: "A" or "W"
            - ground_roughness: "urban" or "open"
            - topographic_class: "T1", "T2", "T3", or "T4"
            - site_exposure: "sheltered" or "exposed"
            - lee_zone: bool

    Returns:
        Wind zone string: "L", "M", "H", "VH", "EH", or "SED"
    """
    tables = load_tables()
    wz = tables["wind_zones"]

    region = site.get("wind_region", "A")
    roughness = site.get("ground_roughness", "open")
    topo = site.get("topographic_class", "T1")
    exposure = site.get("site_exposure", "sheltered")
    lee = site.get("lee_zone", False)

    # Build the lookup key: e.g. "T1_sheltered"
    topo_exp_key = f"{topo}_{exposure}"

    # Look up base wind zone
    if region not in wz:
        raise ValueError(f"Unknown wind region: {region}")
    region_data = wz[region]
    if roughness not in region_data:
        raise ValueError(f"Unknown ground roughness: {roughness}")
    roughness_data = region_data[roughness]
    if topo_exp_key not in roughness_data:
        raise ValueError(f"Unknown topo/exposure combo: {topo_exp_key}")

    zone = roughness_data[topo_exp_key]

    # Apply lee zone upgrade if applicable
    if lee and zone in wz.get("lee_zone_upgrade", {}):
        zone = wz["lee_zone_upgrade"][zone]

    return zone


def determine_eq_zone(territorial_authority: str) -> int:
    """Determine earthquake zone from territorial authority using Figure 5.4.

    Returns zone number (1, 2, or 3). Raises ValueError if TA not found.
    """
    tables = load_tables()
    eq = tables["eq_zones"]
    ta = territorial_authority.strip()

    if ta in eq:
        return eq[ta]

    # Try case-insensitive match
    ta_lower = ta.lower()
    for key, zone in eq.items():
        if key.startswith("_"):
            continue
        if key.lower() == ta_lower:
            return zone

    raise ValueError(f"Unknown territorial authority: {ta}")


def determine_topographic_class(topography: str, gradient: str) -> str:
    """Determine topographic class from Table 5.3.

    Args:
        topography: "crest" or "outer"
        gradient: "gentle", "low", "mild", "moderate", or "steep"

    Returns: "T1", "T2", "T3", or "T4"
    """
    tables = load_tables()
    tc = tables["topographic_class"]
    if topography not in tc:
        return "T1"  # default for sites not on crest or outer slopes
    topo_data = tc[topography]
    if gradient not in topo_data:
        raise ValueError(f"Unknown gradient: {gradient}")
    return topo_data[gradient]


# ---------------------------------------------------------------------------
# 4. BRACING DEMAND CALCULATION
# ---------------------------------------------------------------------------


def _get_wind_bracing_table(storey_type: str) -> str:
    """Map storey type to wind bracing table key."""
    mapping = {
        "subfloor": "wind_bracing_demand_subfloor",
        "single_upper": "wind_bracing_demand_single_upper",
        "lower_two": "wind_bracing_demand_lower_two",
    }
    return mapping.get(storey_type)


def calculate_bracing_demand(
    wind_zone: str,
    eq_zone: int,
    site: dict,
    storeys: list[dict],
) -> dict:
    """Calculate bracing demand for all storeys.

    Wind bracing: Tables 5.5-5.7 give BU/m for High wind zone.
    Multiply by wind_zone_multipliers for actual zone.
    Demand = BU/m × plan_length (across) or plan_width (along).

    EQ bracing: Tables 5.8-5.10 give BU/m² for zone 3, soil D/E.
    Multiply by eq_multiplication_factors for actual zone/soil.
    Demand = BU/m² × floor_area.

    Governing demand = max(wind, EQ) per direction per storey.

    Args:
        wind_zone: "L", "M", "H", "VH", or "EH"
        eq_zone: 1, 2, or 3
        site: dict with soil_type, roof_weight, cladding weights
        storeys: list of storey dicts with dimensions and heights

    Returns:
        dict with per-storey bracing demands and governing values
    """
    tables = load_tables()
    wind_mult = tables["wind_zone_multipliers"].get(wind_zone, 1.0)
    soil = site.get("soil_type", "C")

    # Map soil type to EQ factor key
    if soil in ("A", "B"):
        soil_key = "AB"
    elif soil == "C":
        soil_key = "C"
    elif soil in ("D", "E"):
        soil_key = "DE"
    else:
        soil_key = "C"  # default

    eq_factor = tables["eq_multiplication_factors"].get(
        str(eq_zone), {}
    ).get(soil_key, 1.0)

    results = []
    num_storeys = len(storeys)

    for i, storey in enumerate(storeys):
        is_top = storey.get("is_top_storey", i == 0)
        floor_type = storey.get("floor_type", "timber")
        plan_length = storey.get("plan_length_mm", 0) / 1000  # convert to m
        plan_width = storey.get("plan_width_mm", 0) / 1000
        floor_area = plan_length * plan_width

        # Determine heights for wind bracing lookup
        # H_apex = floor to apex (for single/upper) or total height
        floor_to_ceiling = storey.get("floor_to_ceiling_height_mm", 2400) / 1000
        roof_pitch = storey.get("roof_pitch", 22.5)
        # Approximate roof height above eaves from pitch and half-span
        rafter_span = storey.get("rafter_span_m", plan_width / 1000 if plan_width else 4.0)
        h_eaves = (rafter_span / 2) * math.tan(math.radians(roof_pitch))

        # Determine which wind bracing table to use
        if num_storeys == 1:
            if floor_type == "slab":
                # Single storey on slab — use single_upper table
                storey_type = "single_upper"
            else:
                # Single storey on subfloor — need both subfloor and upper
                storey_type = "single_upper"  # for the wall level
        elif is_top:
            storey_type = "single_upper"
        else:
            storey_type = "lower_two"

        # Wind bracing lookup
        wind_table_key = _get_wind_bracing_table(storey_type)
        wind_table = tables.get(wind_table_key, {})

        # The tables are keyed by H_floor_to_apex (integer string) then
        # h_roof_above_eaves (integer string)
        h_apex = floor_to_ceiling + h_eaves
        h_apex_key = table_lookup(wind_table, h_apex)

        wind_across = 0
        wind_along = 0
        if h_apex_key and h_apex_key in wind_table:
            h_eaves_rounded = round(h_eaves)
            h_eaves_key = table_lookup(wind_table[h_apex_key], h_eaves_rounded)
            if h_eaves_key and h_eaves_key in wind_table[h_apex_key]:
                entry = wind_table[h_apex_key][h_eaves_key]
                # BU/m for H zone — multiply by wind zone factor
                wind_bu_per_m_across = entry.get("across", 0) * wind_mult
                wind_bu_per_m_along = entry.get("along", 0) * wind_mult
                wind_across = wind_bu_per_m_across * plan_length
                wind_along = wind_bu_per_m_along * plan_width

        # EQ bracing lookup
        # Determine which EQ table based on floor type and storey count
        roof_weight = site.get("roof_weight", "light")
        cladding_weight = site.get("upper_cladding_weight", "light")

        if floor_type == "slab":
            eq_table = tables.get("eq_bracing_slab", {})
        elif num_storeys <= 1:
            eq_table = tables.get("eq_bracing_single_subfloor", {})
        else:
            eq_table = tables.get("eq_bracing_two_storey_subfloor", {})

        # Build the weight combination key
        # Tables use keys like "light_light_light_medium" for roof_wall_subfloor
        # This is simplified — the full lookup depends on roof/wall/floor cladding
        eq_bu_per_m2 = _lookup_eq_bracing(
            eq_table, roof_weight, cladding_weight, storey, roof_pitch
        )
        eq_bu_per_m2_actual = eq_bu_per_m2 * eq_factor

        # EQ demand is the same in both directions
        eq_demand = eq_bu_per_m2_actual * floor_area

        # Governing = max of wind and EQ per direction
        results.append({
            "level": storey.get("level_name", f"Level {i}"),
            "storey_type": storey_type,
            "wind_bracing": {
                "across_bu_per_m": round(wind_across / max(plan_length, 0.001), 1) if plan_length else 0,
                "along_bu_per_m": round(wind_along / max(plan_width, 0.001), 1) if plan_width else 0,
                "across_total_bu": round(wind_across, 0),
                "along_total_bu": round(wind_along, 0),
            },
            "eq_bracing": {
                "bu_per_m2": round(eq_bu_per_m2_actual, 1),
                "total_bu": round(eq_demand, 0),
            },
            "governing": {
                "across_bu": round(max(wind_across, eq_demand), 0),
                "along_bu": round(max(wind_along, eq_demand), 0),
                "controlled_by_across": "wind" if wind_across >= eq_demand else "EQ",
                "controlled_by_along": "wind" if wind_along >= eq_demand else "EQ",
            },
        })

    return {
        "wind_zone": wind_zone,
        "wind_multiplier": wind_mult,
        "eq_zone": eq_zone,
        "eq_factor": eq_factor,
        "soil_type": soil,
        "storeys": results,
    }


def _lookup_eq_bracing(
    eq_table: dict,
    roof_weight: str,
    cladding_weight: str,
    storey: dict,
    roof_pitch: float,
) -> float:
    """Look up EQ bracing demand from Tables 5.8-5.10.

    The tables use composite keys like "light_light_light_medium"
    representing roof_upper-cladding_lower-cladding combinations,
    and roof pitch ranges like "0-25", "25-45", "45-60".

    Returns BU/m² for zone 3, soil D/E (the base value before multiplier).
    """
    # Determine pitch range key
    if roof_pitch <= 25:
        pitch_key = "0-25"
    elif roof_pitch <= 45:
        pitch_key = "25-45"
    else:
        pitch_key = "45-60"

    # Try to find a matching weight combination key
    # The key format varies by table but generally:
    # "roof_upper_subfloor" or "roof_upper_lower"
    floor_type = storey.get("floor_type", "timber")
    subfloor_weight = "light" if floor_type == "timber" else "medium"

    # Build candidate keys (the tables use various combos)
    candidates = [
        f"{roof_weight}_{cladding_weight}_{subfloor_weight}",
        f"{roof_weight}_{cladding_weight}_{cladding_weight}_{subfloor_weight}",
        f"{roof_weight}_{cladding_weight}_{cladding_weight}",
        f"{roof_weight}_{cladding_weight}",
    ]

    for key in candidates:
        if key in eq_table:
            pitch_data = eq_table[key]
            if pitch_key in pitch_data:
                entry = pitch_data[pitch_key]
                # Return the appropriate storey value
                if isinstance(entry, dict):
                    # Tables have keys like "subfloor", "walls", "single", "lower", "upper"
                    for value_key in ("walls", "subfloor", "single", "lower"):
                        if value_key in entry and entry[value_key] is not None:
                            return entry[value_key]
                elif isinstance(entry, (int, float)):
                    return entry

    # Fallback: return a conservative default
    return 15.0  # typical single-storey light value


# ---------------------------------------------------------------------------
# 5. WALL SIZING — Chunk 4
# ---------------------------------------------------------------------------


def get_wall_position(storey: dict, wall: dict) -> str:
    """Determine wall position code for Table 8.2 lookup.

    Returns:
        "sot"  — single storey, or top storey of two
        "lot"  — lower of two storeys
        "sub"  — subfloor (piles)
        "internal" — internal non-loadbearing
    """
    wall_type = wall.get("wall_type", "external_loadbearing")

    if wall_type in ("internal_nonloadbearing", "nonloadbearing"):
        return "internal"

    is_top = storey.get("is_top_storey", True)
    num_storeys = storey.get("num_storeys", 1)

    if wall_type == "subfloor":
        return "sub"
    elif num_storeys <= 1 or is_top:
        return "sot"
    else:
        return "lot"


def lookup_stud(
    wind_zone: str,
    position: str,
    loaded_dim_m: float,
    height_m: float,
    spacing: int = 600,
) -> dict:
    """Look up stud size from Table 8.2 (loadbearing) or Table 8.4 (NLB).

    Table 8.2 structure: position → wind_zone → loaded_dim → height → spacing → size
    Table 8.4 structure: wind_zone → height → spacing → size

    Returns dict with size, spacing, height_m, table_ref.
    """
    tables = load_tables()

    if position == "internal":
        # Non-loadbearing studs — Table 8.4
        nlb = tables["studs_nonloadbearing"]
        # Map M and L to "ML" key used in Table 8.4
        wz_key = wind_zone if wind_zone in nlb else "ML"
        if wz_key not in nlb:
            wz_key = "ML"

        ht_key = table_lookup(nlb[wz_key], height_m)
        if ht_key is None:
            return {"size": "SED", "spacing": spacing, "height_m": height_m,
                    "table_ref": "Table 8.4", "note": "Height exceeds table range"}

        spacing_key = table_lookup(nlb[wz_key][ht_key], spacing)
        if spacing_key is None:
            spacing_key = str(spacing)

        size = nlb[wz_key][ht_key].get(spacing_key)
        if size is None:
            return {"size": "SED", "spacing": spacing, "height_m": height_m,
                    "table_ref": "Table 8.4", "note": "No valid size at this spacing"}

        return {"size": size, "spacing": int(spacing_key), "height_m": height_m,
                "table_ref": "Table 8.4"}

    # Loadbearing studs — Table 8.2
    lb = tables["studs_loadbearing"]
    if position not in lb:
        position = "sot"

    pos_data = lb[position]

    # Wind zone lookup — try exact, then fall back
    wz_key = wind_zone
    if wz_key not in pos_data:
        # Try internal for low wind
        wz_key = "internal" if "internal" in pos_data else "L"

    if wz_key not in pos_data:
        return {"size": "SED", "spacing": spacing, "height_m": height_m,
                "table_ref": "Table 8.2", "note": f"Wind zone {wind_zone} not in table"}

    wz_data = pos_data[wz_key]

    # Loaded dimension lookup (round up)
    ld_key = table_lookup(wz_data, loaded_dim_m)
    if ld_key is None:
        return {"size": "SED", "spacing": spacing, "height_m": height_m,
                "table_ref": "Table 8.2", "note": "Loaded dim exceeds table range"}

    # Height lookup (round up)
    ht_key = table_lookup(wz_data[ld_key], height_m)
    if ht_key is None:
        return {"size": "SED", "spacing": spacing, "height_m": height_m,
                "table_ref": "Table 8.2", "note": "Height exceeds table range"}

    # Spacing lookup (round up)
    spacing_data = wz_data[ld_key][ht_key]
    spacing_key = table_lookup(spacing_data, spacing)
    if spacing_key is None:
        spacing_key = str(spacing)

    size = spacing_data.get(spacing_key)
    if size is None:
        return {"size": "SED", "spacing": spacing, "height_m": height_m,
                "table_ref": "Table 8.2", "note": "No valid size"}

    return {"size": size, "spacing": int(spacing_key), "height_m": height_m,
            "table_ref": "Table 8.2"}


def get_stud_thickness_at_600(
    wind_zone: str, position: str, loaded_dim_m: float, height_m: float
) -> int:
    """Get the stud thickness that would apply at 600mm spacing.

    Used by Table 8.5 (trimming studs) which needs the stud thickness
    at 600mm centres regardless of actual stud spacing.
    """
    result = lookup_stud(wind_zone, position, loaded_dim_m, height_m, spacing=600)
    size = result.get("size", "90x45")
    if size == "SED":
        return 90  # conservative default
    try:
        # Parse thickness from "WIDTHxTHICKNESS" format
        return int(size.split("x")[1])
    except (ValueError, IndexError):
        return 45


def determine_lintel_load_case(wall: dict) -> str:
    """Determine lintel load case from Table 8.8 based on what the wall supports.

    Returns one of: "roof_only", "roof_wall", "roof_wall_floor",
    "wall_floor", "floor_only"
    """
    supports_roof = wall.get("supports_roof", True)
    supports_wall = wall.get("supports_upper_wall", False)
    supports_floor = wall.get("supports_floor", False)

    if supports_roof and supports_wall and supports_floor:
        return "roof_wall_floor"
    elif supports_roof and supports_wall:
        return "roof_wall"
    elif supports_roof:
        return "roof_only"
    elif supports_wall and supports_floor:
        return "wall_floor"
    elif supports_floor:
        return "floor_only"
    else:
        # Default — external wall in single storey supports roof
        return "roof_only"


def lookup_lintel(
    load_case: str,
    loaded_dim_m: float,
    span_m: float,
    roof_weight: str = "light",
    cladding_weight: str = "light",
) -> dict:
    """Look up lintel size from Tables 8.9-8.13.

    Each table is keyed: weight_combo → loaded_dim → {size: max_span}
    Uses size_lookup to find smallest member where max_span >= span_m.

    Returns dict with size, table_ref, max_span.
    """
    tables = load_tables()

    # Map load case to table key
    table_map = {
        "roof_only": "lintel_roof_only",
        "roof_wall": "lintel_roof_wall",
        "roof_wall_floor": "lintel_roof_wall_floor",
        "wall_floor": "lintel_wall_floor",
        "floor_only": "lintel_floor_only",
    }

    table_key = table_map.get(load_case, "lintel_roof_only")
    lintel_table = tables.get(table_key, {})
    table_ref = f"Table {tables.get(table_key, {}).get('_ref', table_key)}"

    # Build the weight combination key for the table
    if load_case == "roof_only":
        # Keyed by roof_weight: "light" or "heavy"
        weight_key = roof_weight
    elif load_case in ("roof_wall", "roof_wall_floor"):
        # Keyed by combo: "light_light", "light_medium", "heavy_light", "heavy_medium"
        weight_key = f"{roof_weight}_{cladding_weight}"
    elif load_case == "wall_floor":
        # Keyed by cladding: "light" or "medium"
        weight_key = cladding_weight
    elif load_case == "floor_only":
        # Keyed directly by loaded_dim — no weight key
        weight_key = None
    else:
        weight_key = roof_weight

    # Navigate to the loaded dimension entries
    if weight_key is not None:
        weight_data = lintel_table.get(weight_key, {})
    else:
        weight_data = lintel_table

    # Look up loaded dimension (round up)
    ld_key = table_lookup(weight_data, loaded_dim_m)
    if ld_key is None:
        return {"size": "SED", "table_ref": table_ref,
                "note": f"Loaded dim {loaded_dim_m}m exceeds table range"}

    size_entries = weight_data.get(ld_key, {})
    if isinstance(size_entries, str) and size_entries.startswith("_"):
        size_entries = {}

    # Find smallest member where max_span >= required span
    size = size_lookup(size_entries, span_m)
    if size is None:
        return {"size": "SED", "table_ref": table_ref,
                "note": f"Span {span_m}m exceeds all sizes at {ld_key}m loaded dim"}

    return {"size": size, "table_ref": table_ref, "max_span": size_entries[size]}


def lookup_trimming_stud(
    position: str, opening_span_m: float, stud_thickness_at_600: int
) -> dict:
    """Look up trimming stud thickness from Table 8.5.

    Table structure: position → opening_span → stud_thickness → trimmer_thickness

    The position maps to:
    - "sot_and_nlb" for single/top storey and non-loadbearing
    - "other" for lower storey, subfloor

    Returns dict with thickness_mm, count (number of studs to achieve thickness).
    """
    tables = load_tables()
    ts = tables["trimming_studs"]

    # Map wall position to table position key
    if position in ("sot", "internal"):
        pos_key = "sot_and_nlb"
    else:
        pos_key = "other"

    pos_data = ts.get(pos_key, {})

    # Round up opening span to next table row
    span_key = table_lookup(pos_data, opening_span_m)
    if span_key is None:
        return {"thickness_mm": None, "count": 0, "table_ref": "Table 8.5",
                "note": f"Opening span {opening_span_m}m exceeds table range — SED"}

    span_data = pos_data[span_key]

    # Look up by stud thickness (round up)
    thick_key = table_lookup(span_data, stud_thickness_at_600)
    if thick_key is None:
        return {"thickness_mm": None, "count": 0, "table_ref": "Table 8.5",
                "note": f"Stud thickness {stud_thickness_at_600}mm exceeds table range"}

    required_thickness = span_data[thick_key]

    # Calculate how many studs needed to achieve required thickness
    # Common stud thicknesses: 35, 45, 70, 90
    if required_thickness <= 45:
        count = 1
    elif required_thickness <= 90:
        count = 2
    elif required_thickness <= 135:
        count = 3
    else:
        count = max(1, math.ceil(required_thickness / 45))

    return {"thickness_mm": required_thickness, "count": count,
            "table_ref": "Table 8.5"}


def lookup_sill_head_trimmer(opening_width_m: float) -> dict:
    """Look up sill/head trimmer thickness from Table 8.15.

    Simple table: opening_width → min_thickness_mm
    """
    tables = load_tables()
    sht = tables["sill_head_trimmers"]

    width_key = table_lookup(sht, opening_width_m)
    if width_key is None:
        return {"thickness_mm": "SED", "table_ref": "Table 8.15",
                "note": f"Opening width {opening_width_m}m exceeds table range"}

    value = sht[width_key]
    if value == "SED":
        return {"thickness_mm": "SED", "table_ref": "Table 8.15",
                "note": "Specific engineering design required"}

    return {"thickness_mm": value, "table_ref": "Table 8.15"}


def lookup_lintel_fixing(
    load_case: str,
    wind_zone: str,
    loaded_dim_m: float,
    roof_weight: str = "light",
) -> dict:
    """Look up lintel fixing from Table 8.14.

    Table structure: roof_weight → wind_zone → loaded_dim → {no_uplift, uplift}
    Values are max spans (m) where fixing type F (no uplift) or G (uplift) applies.
    """
    tables = load_tables()
    lf = tables["lintel_fixing"]

    weight_data = lf.get(roof_weight, lf.get("light", {}))
    wz_data = weight_data.get(wind_zone, {})

    ld_key = table_lookup(wz_data, loaded_dim_m)
    if ld_key is None:
        return {"fixing_type": "G", "table_ref": "Table 8.14",
                "note": "Loaded dim exceeds range — assume uplift fixing"}

    entry = wz_data.get(ld_key, {})
    no_uplift_span = entry.get("no_uplift")
    uplift_span = entry.get("uplift")

    # The values are max spans where the fixing type applies
    # If no_uplift is null, always use uplift fixing
    if no_uplift_span is not None:
        fixing_type = "F (no uplift)"
    else:
        fixing_type = "G (uplift)"

    return {
        "fixing_type": fixing_type,
        "no_uplift_max_span": no_uplift_span,
        "uplift_max_span": uplift_span,
        "table_ref": "Table 8.14",
    }


def _parse_plate_width(size_str: str) -> int:
    """Parse the width (first number) from a plate size like '70x45' or '90x45+90x35'."""
    try:
        base = size_str.split("+")[0]
        return int(base.split("x")[0])
    except (ValueError, IndexError):
        return 0


def _parse_stud_width(size_str: str) -> int:
    """Parse the width (first number) from a stud size like '90x45'.

    In NZ timber notation, the first dimension is the depth/width of the
    member. For studs standing upright, this is the wall-depth direction.
    Plates must be at least this wide per NZS 3604 clauses 8.7.1.2,
    8.7.1.3, 8.7.2.1(b), and 8.7.2.2.
    """
    try:
        return int(size_str.split("x")[0])
    except (ValueError, IndexError):
        return 90  # conservative default


def lookup_top_plate(
    position: str,
    loaded_dim_m: float,
    roof_weight: str,
    stud_spacing: int,
    min_width: int = 0,
) -> dict:
    """Look up top plate size from Table 8.16.

    Table structure: position → plate_size → joint_loc → stud_spacing → roof_weight → loaded_dim → max_span

    Finds the smallest plate where max_span >= loaded_dim_m AND plate
    width >= min_width (per NZS 3604 S8.7.1: plate must be at least as
    wide as the studs).

    Prefers "anywhere" joint location.
    """
    tables = load_tables()
    tp = tables["top_plates"]

    pos_data = tp.get(position, tp.get("sot", {}))
    plate_sizes = [k for k in pos_data if not k.startswith("_")]

    # Sort plate sizes by cross-section area (smallest first)
    def plate_area(s):
        try:
            # Handle compound sizes like "90x45+90x35"
            base = s.split("+")[0]
            parts = base.split("x")
            return int(parts[0]) * int(parts[1])
        except (ValueError, IndexError):
            return 99999

    plate_sizes.sort(key=plate_area)

    # Try each plate size, prefer "anywhere" joint location
    for plate_size in plate_sizes:
        # Enforce plate width >= stud width (NZS 3604 S8.7.1.2/8.7.1.3)
        if _parse_plate_width(plate_size) < min_width:
            continue

        plate_data = pos_data[plate_size]

        for joint_loc in ("anywhere", "within_150"):
            if joint_loc not in plate_data:
                continue
            joint_data = plate_data[joint_loc]

            # Look up stud spacing (round up)
            sp_key = table_lookup(joint_data, stud_spacing)
            if sp_key is None:
                continue

            weight_data = joint_data[sp_key]
            if roof_weight not in weight_data:
                continue

            dim_data = weight_data[roof_weight]
            # Look up loaded dimension (round up)
            ld_key = table_lookup(dim_data, loaded_dim_m)
            if ld_key is None:
                continue

            max_span = dim_data[ld_key]
            if max_span is not None and max_span >= loaded_dim_m - 0.01:
                return {
                    "size": plate_size,
                    "joint_location": joint_loc,
                    "max_loaded_dim": max_span,
                    "table_ref": "Table 8.16",
                }

    # No table plate found — use stud-width plate as minimum (S8.7.1.2)
    if min_width > 0:
        return {"size": f"{min_width}x45", "table_ref": "Table 8.16 / S8.7.1.2",
                "note": f"Minimum {min_width}mm width to match studs"}
    return {"size": "SED", "table_ref": "Table 8.16",
            "note": "No standard plate adequate — SED required"}


def lookup_bottom_plate(
    position: str,
    loaded_dim_m: float,
    roof_weight: str,
    stud_spacing: int,
    joist_spacing: int = 450,
    min_width: int = 0,
) -> dict:
    """Look up bottom plate size from Table 8.17.

    Table structure: position → plate_size → joist_spacing → roof_weight → loaded_dim → max_span

    Finds the smallest plate where max_span >= loaded_dim_m AND plate
    width >= min_width (per NZS 3604 S8.7.2: plate must be at least as
    wide as the studs).
    """
    tables = load_tables()
    bp = tables["bottom_plates"]

    pos_data = bp.get(position, bp.get("sot", {}))
    plate_sizes = [k for k in pos_data if not k.startswith("_")]

    def plate_area(s):
        try:
            # Handle compound sizes like "2/90x45"
            base = s.replace("2/", "")
            parts = base.split("x")
            return int(parts[0]) * int(parts[1])
        except (ValueError, IndexError):
            return 99999

    plate_sizes.sort(key=plate_area)

    for plate_size in plate_sizes:
        # Enforce plate width >= stud width (NZS 3604 S8.7.2.1/8.7.2.2)
        if _parse_plate_width(plate_size) < min_width:
            continue

        plate_data = pos_data[plate_size]

        # Look up joist spacing (round up)
        js_key = table_lookup(plate_data, joist_spacing)
        if js_key is None:
            continue

        weight_data = plate_data[js_key]
        if roof_weight not in weight_data:
            continue

        dim_data = weight_data[roof_weight]
        ld_key = table_lookup(dim_data, loaded_dim_m)
        if ld_key is None:
            continue

        max_span = dim_data[ld_key]
        if max_span is not None and max_span >= loaded_dim_m - 0.01:
            return {
                "size": plate_size,
                "max_loaded_dim": max_span,
                "table_ref": "Table 8.17",
            }

    # No table plate found — use stud-width plate as minimum (S8.7.2)
    if min_width > 0:
        return {"size": f"{min_width}x45", "table_ref": "Table 8.17 / S8.7.2",
                "note": f"Minimum {min_width}mm width to match studs"}
    return {"size": "SED", "table_ref": "Table 8.17",
            "note": "No standard plate adequate — SED required"}


def get_dwang_positions(height_mm: int) -> list:
    """Calculate dwang (nogging) positions per S8.8.

    NZS 3604 S8.8: dwangs required at mid-height for walls up to 2700mm,
    at third-points for taller walls. Always at sheet joints (1200mm).
    """
    positions = []
    if height_mm <= 2700:
        # Single row at mid-height
        positions.append(height_mm // 2)
    else:
        # Two rows at third-points
        positions.append(height_mm // 3)
        positions.append(2 * height_mm // 3)

    # Also add dwangs at sheet joint heights (1200mm increments)
    for h in range(1200, height_mm, 1200):
        if h not in positions and abs(h - height_mm) > 100:
            positions.append(h)

    positions.sort()
    return positions


def size_opening(
    opening: dict,
    wall: dict,
    wind_zone: str,
    position: str,
    loaded_dim_m: float,
    stud: dict,
    site: dict,
) -> dict:
    """Size lintel + trimming studs for one opening.

    Args:
        opening: dict with width_mm, height_mm, type, sill_mm, etc.
        wall: parent wall dict
        wind_zone: e.g. "H"
        position: wall position ("sot", "lot", "sub", "internal")
        loaded_dim_m: loaded dimension for lintel
        stud: stud lookup result dict
        site: site params

    Returns: dict with all opening member sizes
    """
    span_m = opening.get("width_mm", 1000) / 1000
    wall_height_mm = wall.get("height_mm", 2400)
    roof_weight = site.get("roof_weight", "light")
    cladding_weight = site.get("upper_cladding_weight", "light")

    # Determine lintel load case from Table 8.8
    load_case = determine_lintel_load_case(wall)

    # Lintel sizing — Tables 8.9-8.13
    lintel = lookup_lintel(load_case, loaded_dim_m, span_m,
                           roof_weight, cladding_weight)

    # Trimming studs — Table 8.5
    stud_thick_600 = get_stud_thickness_at_600(
        wind_zone, position, loaded_dim_m, stud.get("height_m", 2.4)
    )
    trimmer = lookup_trimming_stud(position, span_m, stud_thick_600)

    # Sill/head trimmer — Table 8.15 (for windows)
    opening_type = opening.get("type", "window")
    sill_trimmer = None
    if opening_type == "window":
        sill_trimmer = lookup_sill_head_trimmer(span_m)

    # Lintel fixing — Table 8.14
    lintel_fixing = lookup_lintel_fixing(load_case, wind_zone,
                                          loaded_dim_m, roof_weight)

    # Jack studs (cripple studs below sill / above head)
    stud_spacing = stud.get("spacing", 600)
    sill_height_mm = opening.get("sill_mm", 0)
    head_height_mm = opening.get("head_height_mm",
                                  sill_height_mm + opening.get("height_mm", 2100))
    above_head_mm = wall_height_mm - head_height_mm

    jack_studs_below = max(0, int(sill_height_mm / stud_spacing) - 1) if sill_height_mm > 100 else 0
    jack_studs_above = max(0, int(above_head_mm / stud_spacing) - 1) if above_head_mm > 100 else 0

    return {
        "opening_ref": opening.get("ref", opening.get("name", "O1")),
        "opening_type": opening_type,
        "width_mm": opening.get("width_mm", 1000),
        "height_mm": opening.get("height_mm", 2100),
        "span_m": round(span_m, 2),
        "load_case": load_case,
        "lintel": lintel,
        "trimmer": trimmer,
        "sill_trimmer": sill_trimmer,
        "lintel_fixing": lintel_fixing,
        "jack_studs_below_sill": jack_studs_below,
        "jack_studs_above_head": jack_studs_above,
    }


def size_walls(storey: dict, wind_zone: str, site: dict) -> list:
    """Size all walls in a storey — studs, plates, openings, lintels, dwangs.

    For each wall:
    1. Determine wall position (sot/lot/sub/internal)
    2. Look up stud size from Table 8.2 or 8.4
    3. Look up top plate from Table 8.16
    4. Look up bottom plate from Table 8.17
    5. Calculate dwang positions per S8.8
    6. Size each opening (lintel, trimmers, fixings)
    """
    walls = storey.get("walls", [])
    roof_weight = site.get("roof_weight", "light")
    num_storeys = storey.get("num_storeys", 1)
    results = []

    for wall in walls:
        w = {}
        w["wall_name"] = wall.get("name", "unnamed")
        w["wall_type"] = wall.get("wall_type", "external_loadbearing")

        # 1. Wall position
        position = get_wall_position(storey, wall)
        w["position"] = position

        # 2. Loaded dimension
        loaded_dim_m = wall.get("loaded_dimension_roof_m",
                                storey.get("roof_span_m", 4.0) / 2)
        w["loaded_dim_m"] = loaded_dim_m

        # Wall height
        height_mm = wall.get("height_mm", storey.get("floor_to_ceiling_height_mm", 2400))
        height_m = round(height_mm / 1000, 1)

        # 3. Stud sizing
        stud = lookup_stud(wind_zone, position, loaded_dim_m, height_m, spacing=600)
        w["stud"] = stud

        # Parse stud width — plates must be at least this wide (S8.7.1/S8.7.2)
        stud_width = _parse_stud_width(stud["size"]) if stud["size"] != "SED" else 90

        # 4. Top plate — Table 8.16 (plate width >= stud width per S8.7.1)
        w["top_plate"] = lookup_top_plate(
            position, loaded_dim_m, roof_weight, stud["spacing"],
            min_width=stud_width,
        )

        # 5. Bottom plate — Table 8.17 (plate width >= stud width per S8.7.2)
        joist_spacing = storey.get("joist_spacing", 450)
        w["bottom_plate"] = lookup_bottom_plate(
            position, loaded_dim_m, roof_weight, stud["spacing"], joist_spacing,
            min_width=stud_width,
        )

        # 6. Dwangs
        w["dwang_positions_mm"] = get_dwang_positions(height_mm)
        w["dwang_size"] = stud["size"] if stud["size"] != "SED" else "90x45"

        # 7. Size each opening
        w["openings"] = []
        for opening in wall.get("openings", []):
            o = size_opening(
                opening, wall, wind_zone, position,
                loaded_dim_m, stud, site
            )
            w["openings"].append(o)

        # 8. Component count estimate
        wall_length_mm = wall.get("external_mm", wall.get("length_mm", 3000))
        stud_count = max(2, math.ceil(wall_length_mm / stud["spacing"]) + 1)
        # Add extra studs for corners, junctions, opening sides
        corner_studs = 2 if wall.get("wall_type", "").startswith("external") else 0
        opening_extra = len(wall.get("openings", [])) * 2  # trimmers each side
        total_studs = stud_count + corner_studs + opening_extra

        w["estimated_studs"] = total_studs
        w["wall_length_mm"] = wall_length_mm
        w["height_mm"] = height_mm

        results.append(w)

    return results


# ---------------------------------------------------------------------------
# 6. FLOOR SIZING (STUBS — Chunk 5)
# ---------------------------------------------------------------------------


def size_floor(storey: dict) -> dict:
    """Size floor framing for a storey. STUB — implemented in Chunk 5."""
    return {
        "floor_type": storey.get("floor_type", "timber"),
        "_stub": True,
        "_note": "Floor sizing not yet implemented (Chunk 5)",
    }


# ---------------------------------------------------------------------------
# 7. ROOF SIZING (STUBS — Chunk 6)
# ---------------------------------------------------------------------------


def size_roof(storey: dict, wind_zone: str, site: dict) -> dict:
    """Size roof framing for a storey. STUB — implemented in Chunk 6."""
    return {
        "roof_form": storey.get("roof_form", "gable"),
        "_stub": True,
        "_note": "Roof sizing not yet implemented (Chunk 6)",
    }


# ---------------------------------------------------------------------------
# 8. CONNECTIONS (STUBS — Chunk 7)
# ---------------------------------------------------------------------------


def generate_connections(level_designs: list, wind_zone: str) -> dict:
    """Compile fixing schedule from nailing tables. STUB — Chunk 7."""
    return {
        "_stub": True,
        "_note": "Connection schedule not yet implemented (Chunk 7)",
    }


def generate_compliance_notes(design: dict) -> list:
    """Generate per-element NZS 3604 clause references. STUB — Chunk 7."""
    return [{"_stub": True, "_note": "Compliance notes not yet implemented"}]


# ---------------------------------------------------------------------------
# 9. MAIN ENTRY POINT
# ---------------------------------------------------------------------------


def calculate_nzs3604(measurements: dict) -> dict:
    """Main entry point. Takes measurements.json, returns nzs3604_design.json.

    Steps:
    1. Load tables
    2. Determine wind zone and EQ zone from site params
    3. Calculate bracing demand per storey
    4. Size walls, floor, roof per storey
    5. Generate connections and compliance notes
    6. Assemble and return complete design

    Args:
        measurements: dict from measurements.json with keys:
            - site: site classification parameters
            - storeys: list of storey definitions

    Returns:
        Complete NZS 3604 design dict
    """
    load_tables()

    site = measurements.get("site", {})
    storeys = measurements.get("storeys", [])

    if not storeys:
        raise ValueError("No storeys defined in measurements")

    # Step 1: Site classification
    wind_zone = determine_wind_zone(site)
    eq_zone = determine_eq_zone(site.get("territorial_authority", "Auckland"))

    # Step 2: Bracing demand
    bracing = calculate_bracing_demand(wind_zone, eq_zone, site, storeys)

    # Step 3: Size each storey
    level_designs = []
    for i, storey in enumerate(storeys):
        is_top = storey.get("is_top_storey", i == 0)

        level = {
            "level_name": storey.get("level_name", f"Level {i}"),
            "is_top_storey": is_top,
            "walls": size_walls(storey, wind_zone, site),
            "floor": size_floor(storey),
        }

        # Only the top storey gets roof sizing
        if is_top:
            level["roof"] = size_roof(storey, wind_zone, site)

        level_designs.append(level)

    # Step 4: Connections
    connections = generate_connections(level_designs, wind_zone)

    # Step 5: Compliance notes
    compliance_notes = generate_compliance_notes({
        "levels": level_designs,
        "bracing": bracing,
    })

    # Assemble output
    design = {
        "_meta": {
            "standard": "NZS 3604:2011",
            "grade": "SG8",
            "engine_version": "0.1.0",
        },
        "site": {
            "wind_zone": wind_zone,
            "eq_zone": eq_zone,
            "soil_type": site.get("soil_type", "C"),
            "wind_region": site.get("wind_region", "A"),
            "territorial_authority": site.get("territorial_authority", ""),
        },
        "bracing_design": bracing,
        "levels": level_designs,
        "connections": connections,
        "compliance_notes": compliance_notes,
    }

    return design


# ---------------------------------------------------------------------------
# 10. CLI
# ---------------------------------------------------------------------------


def main():
    """CLI entry point: reads measurements.json, writes nzs3604_design.json."""
    if len(sys.argv) < 2:
        print("Usage: python nzs3604_calculator.py measurements.json [output.json]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "nzs3604_design.json"

    with open(input_path, "r") as f:
        measurements = json.load(f)

    design = calculate_nzs3604(measurements)

    with open(output_path, "w") as f:
        json.dump(design, f, indent=2)

    print(f"NZS 3604 design written to {output_path}")
    print(f"  Wind zone: {design['site']['wind_zone']}")
    print(f"  EQ zone: {design['site']['eq_zone']}")
    print(f"  Levels: {len(design['levels'])}")


if __name__ == "__main__":
    main()
