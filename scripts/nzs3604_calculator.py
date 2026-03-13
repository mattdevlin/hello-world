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
# 5. WALL SIZING (STUBS — Chunk 4)
# ---------------------------------------------------------------------------


def size_walls(storey: dict, wind_zone: str, site: dict) -> list:
    """Size all walls in a storey. STUB — implemented in Chunk 4."""
    walls = storey.get("walls", [])
    results = []
    for wall in walls:
        results.append({
            "wall_name": wall.get("name", "unnamed"),
            "wall_type": wall.get("wall_type", "external"),
            "_stub": True,
            "_note": "Wall sizing not yet implemented (Chunk 4)",
        })
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
