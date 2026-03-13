# NZS 3604 Engine — Claude Code Implementation Plan
## Integrated into devpro-takeoff

> **Decisions locked:** SG8 only. Skip S14 (3 kPa) and S15 (snow). Integrated into devpro-takeoff, not standalone.

---

## 1. WHERE IT LIVES

Add to the existing devpro-takeoff scripts directory:

```
devpro-takeoff/scripts/
├── run_takeoff.py              # existing — add nzs3604 call
├── panel_calculator.py         # existing — SIP panels
├── layout_generator.py         # existing
├── excel_generator.py          # existing — add NZS 3604 sheets
├── pdf_generator.py            # existing — add NZS 3604 report
│
├── nzs3604_calculator.py       # NEW — main NZS 3604 engine (single file)
├── nzs3604_tables.json         # NEW — all SG8 table data
└── nzs3604_report.py           # NEW — comparison output generator
```

**Three new files.** The engine is a single Python module (`nzs3604_calculator.py`) that reads `measurements.json` + site params, looks up `nzs3604_tables.json`, and outputs `nzs3604_design.json`. The report generator creates the comparison output.

---

## 2. DATA FLOW

```
measurements.json (existing — walls, openings, floor zones, roof)
        +
site_params (new — added to measurements.json under "site" key)
        │
        ▼
nzs3604_calculator.py ──→ nzs3604_design.json
        │                      │
        │                      ├─ timber_schedule (every member)
        │                      ├─ fixing_schedule (every connection)
        │                      ├─ bracing_design (demand vs capacity)
        │                      └─ compliance_notes (clause references)
        │
        ▼
run_takeoff.py (updated) ──→ runs BOTH panel_calculator + nzs3604_calculator
        │
        ▼
excel_generator.py (updated) ──→ adds "NZS 3604" + "Comparison" sheets
pdf_generator.py (updated) ──→ adds stickframe spec + SIP comparison pages
```

### New fields in measurements.json

Add a `"site"` key at the top level:

```json
{
  "project": { "name": "Example House", ... },
  "site": {
    "wind_region": "A",
    "lee_zone": false,
    "ground_roughness": "open",
    "site_exposure": "exposed",
    "topographic_class": "T1",
    "territorial_authority": "Whangarei District",
    "soil_type": "C",
    "exposure_zone": "B",
    "roof_weight": "light",
    "upper_cladding_weight": "light",
    "lower_cladding_weight": "light",
    "timber_grade": "SG8"
  },
  "storeys": [ ... ]
}
```

Claude prompts for these during STEP 0 of the takeoff workflow, alongside the existing project setup questions.

---

## 3. nzs3604_tables.json — TABLE DATA STRUCTURE

Single JSON file containing all ~65 SG8 lookup tables. Organised by section:

```json
{
  "_meta": {
    "standard": "NZS 3604:2011",
    "grade": "SG8",
    "version": "1.0",
    "note": "Values are maximum spans (m) or member sizes (mm×mm). Always round UP input values to next table row."
  },

  "wind_zones": { ... },           // Table 5.4
  "eq_zones": { ... },             // Fig 5.4 — TA → zone mapping
  "wind_bracing_demand": { ... },  // Tables 5.5–5.7
  "eq_bracing_demand": { ... },    // Tables 5.8–5.10
  "subfloor_bracing": { ... },     // Table 5.11

  "pile_footings": { ... },        // Table 6.1
  "driven_piles": { ... },         // Table 6.2
  "subfloor_jack_studs": { ... },  // Table 6.3
  "bearers": { ... },              // Table 6.4
  "stringers": { ... },            // Table 6.5
  "nailing_s6": { ... },           // Table 6.6

  "floor_joists": { ... },         // Table 7.1
  "cantilever_joists": { ... },    // Table 7.2
  "flooring": { ... },             // Table 7.3
  "plywood_flooring": { ... },     // Table 7.4
  "nailing_s7": { ... },           // Table 7.5

  "bracing_masonry": { ... },      // Table 8.1
  "studs_loadbearing": { ... },    // Table 8.2
  "studs_no2_framing": { ... },    // Table 8.3
  "studs_nonloadbearing": { ... }, // Table 8.4
  "trimming_studs": { ... },       // Table 8.5
  "stud_raking_adj": { ... },      // Table 8.6
  "steep_roof_multiplier": { ... },// Table 8.7
  "lintel_load_cases": { ... },    // Table 8.8
  "lintel_roof_only": { ... },     // Table 8.9
  "lintel_roof_wall": { ... },     // Table 8.10
  "lintel_roof_wall_floor": { ... }, // Table 8.11
  "lintel_wall_floor": { ... },    // Table 8.12
  "lintel_floor_only": { ... },    // Table 8.13
  "lintel_fixing": { ... },        // Table 8.14
  "sill_head_trimmers": { ... },   // Table 8.15
  "top_plates": { ... },           // Table 8.16
  "bottom_plates": { ... },        // Table 8.17
  "top_plate_fixing": { ... },     // Table 8.18
  "nailing_s8": { ... },           // Table 8.19

  "posts_uplift": { ... },         // Table 9.1
  "post_connections": { ... },     // Table 9.2

  "rafters": { ... },              // Table 10.1
  "ridge_beams": { ... },          // Table 10.2
  "ceiling_joists": { ... },       // Table 10.3
  "ceiling_runners": { ... },      // Table 10.4
  "underpurlins": { ... },         // Table 10.5
  "underpurlin_struts": { ... },   // Table 10.6
  "strutting_beams": { ... },      // Table 10.7
  "verandah_beams": { ... },       // Table 10.8
  "outriggers": { ... },           // Table 10.9
  "purlins_flat": { ... },         // Table 10.10
  "purlins_edge": { ... },         // Table 10.11
  "tile_battens": { ... },         // Table 10.12
  "truss_fixing": { ... },         // Table 10.14
  "fixing_types": { ... },         // Table 10.15
  "roof_bracing_systems": { ... }, // Table 10.16
  "roof_diagonal_braces": { ... }, // Table 10.17
  "nailing_s10": { ... },          // Table 10.18

  "ceiling_battens": { ... },      // Table 13.1
  "nailing_s13": { ... },          // Table 13.3

  "fixing_reference": { ... }      // Table 2.2
}
```

### Table encoding format — EXAMPLES

**Table 8.2 — Studs in loadbearing walls (the big one):**

```json
"studs_loadbearing": {
  "_ref": "Table 8.2",
  "_lookup": "wind_zone → position → loaded_dim → height → spacing → size",
  "_note": "Values are minimum stud size (WxT mm). Position: sot=single/top, lot=lower of two, sub=subfloor",
  "sot": {
    "EH": {
      "2.0": {"2.4": {"300": "90x45", "400": "90x70", "600": "90x90"},
              "2.7": {"300": "90x70", "400": "90x70", "600": "140x45"},
              "3.0": {"300": "90x70", "400": "90x70", "600": "140x45"}},
      "4.0": {"2.4": {"300": "90x45", "400": "90x70", "600": "90x70"},
              "2.7": {"300": "90x70", "400": "90x70", "600": "140x45"},
              "3.0": {"300": "90x70", "400": "90x70", "600": "140x45"}},
      "6.0": {"2.4": {"300": "90x70", "400": "90x70", "600": "90x90"},
              "2.7": {"300": "90x70", "400": "90x70", "600": "140x45"},
              "3.0": {"300": "90x70", "400": "90x70", "600": "140x45"}}
    },
    "VH": { ... },
    "H": { ... },
    "M": { ... },
    "L": { ... }
  },
  "lot": { ... },
  "sub": { ... }
}
```

**Table 8.9 — Lintel supporting roof only:**

```json
"lintel_roof_only": {
  "_ref": "Table 8.9",
  "_lookup": "roof_weight → loaded_dim → size → max_span",
  "_note": "Values are max span in metres for each lintel size. Find smallest size where max_span >= required span.",
  "light": {
    "2.0": {"90x70": 1.2, "90x90": 1.4, "140x70": 2.0, "140x90": 2.1, "190x70": 2.7, "190x90": 2.9, "240x70": 3.4, "240x90": 3.6, "290x70": 4.0, "290x90": 4.2},
    "3.0": {"90x70": 1.1, "90x90": 1.2, "140x70": 1.7, "140x90": 1.9, "190x70": 2.4, "190x90": 2.6, "240x70": 3.0, "240x90": 3.3, "290x70": 3.7, "290x90": 3.9},
    "4.0": {"90x70": 1.0, "90x90": 1.1, "140x70": 1.5, "140x90": 1.8, "190x70": 2.1, "190x90": 2.4, "240x70": 2.7, "240x90": 3.1, "290x70": 3.2, "290x90": 3.7},
    "6.0": {"90x70": 0.8, "90x90": 1.0, "140x70": 1.3, "140x90": 1.6, "190x70": 1.8, "190x90": 2.1, "240x70": 2.2, "240x90": 2.7, "290x70": 2.7, "290x90": 3.3}
  },
  "heavy": { ... }
}
```

**Table 8.5 — Trimming studs:**

```json
"trimming_studs": {
  "_ref": "Table 8.5",
  "_lookup": "position → opening_span → stud_thickness_600 → trimmer_thickness",
  "_note": "stud_thickness_600 = stud thickness if studs were at 600mm crs (from Table 8.2)",
  "sot_and_nlb": {
    "1.8": {"35": 45, "45": 45, "70": 90, "90": 115},
    "3.0": {"35": 45, "45": 70, "70": 90, "90": 135},
    "3.6": {"35": 70, "45": 90, "70": 140, "90": 180},
    "4.2": {"35": 105, "45": 135, "70": 210, "90": 270}
  },
  "other": {
    "0.9": {"35": 45, "45": 70, "70": 90, "90": 135},
    "1.8": {"35": 70, "45": 70, "70": 115, "90": 135},
    "3.0": {"35": 70, "45": 90, "70": 140, "90": 180}
  }
}
```

**Table 7.1 — Floor joists (partial example):**

```json
"floor_joists": {
  "_ref": "Table 7.1",
  "_lookup": "span_type → load_type → spacing → size → max_span_m",
  "_note": "Find smallest size where max_span >= required span",
  "single_span": {
    "dry_interior": {
      "400": {"90x45": 1.4, "140x45": 2.2, "190x45": 3.0, "240x45": 3.8, "290x45": 4.5, "140x70": 2.5, "190x70": 3.4, "240x70": 4.4, "290x70": 5.2, "190x90": 3.6, "240x90": 4.7, "290x90": 5.6},
      "450": { ... },
      "600": { ... }
    },
    "wet_external": { ... }
  },
  "continuous": { ... }
}
```

**EQ zones (Fig 5.4):**

```json
"eq_zones": {
  "_ref": "Figure 5.4",
  "Far North District": 1,
  "Whangarei District": 1,
  "Kaipara District": 1,
  "Auckland": 2,
  "Thames-Coromandel District": 2,
  "Hauraki District": 2,
  "Waikato District": 2,
  "Matamata-Piako District": 2,
  "Hamilton City": 2,
  "Waipa District": 2,
  "Otorohanga District": 2,
  "South Waikato District": 2,
  "Waitomo District": 2,
  "Taupo District": 2,
  "Western Bay of Plenty District": 2,
  "Tauranga City": 2,
  "Rotorua District": 2,
  "Whakatane District": 2,
  "Kawerau District": 2,
  "Opotiki District": 2,
  "Gisborne District": 3,
  "Wairoa District": 3,
  "Hastings District": 3,
  "Napier City": 3,
  "Central Hawkes Bay District": 3,
  "New Plymouth District": 2,
  "Stratford District": 2,
  "South Taranaki District": 2,
  "Ruapehu District": 2,
  "Whanganui District": 2,
  "Rangitikei District": 3,
  "Manawatu District": 3,
  "Palmerston North City": 3,
  "Tararua District": 3,
  "Horowhenua District": 3,
  "Kapiti Coast District": 3,
  "Porirua City": 3,
  "Upper Hutt City": 3,
  "Lower Hutt City": 3,
  "Wellington City": 3,
  "Masterton District": 3,
  "Carterton District": 3,
  "South Wairarapa District": 3,
  "Tasman District": 2,
  "Nelson City": 2,
  "Marlborough District": 3,
  "Kaikoura District": 3,
  "Buller District": 3,
  "Grey District": 3,
  "Westland District": 3,
  "Hurunui District": 3,
  "Waimakariri District": 3,
  "Christchurch City": 3,
  "Selwyn District": 3,
  "Ashburton District": 3,
  "Timaru District": 3,
  "Mackenzie District": 3,
  "Waimate District": 3,
  "Chatham Islands Territory": 3,
  "Waitaki District": 2,
  "Central Otago District": 2,
  "Queenstown-Lakes District": 2,
  "Dunedin City": 2,
  "Clutha District": 2,
  "Southland District": 2,
  "Gore District": 2,
  "Invercargill City": 2
}
```

---

## 4. nzs3604_calculator.py — ENGINE LOGIC

Single file, ~800–1200 lines. Functions organised by building element:

### 4.1 Entry point

```python
def calculate_nzs3604(measurements: dict) -> dict:
    """Main entry point. Takes measurements.json, returns nzs3604_design.json."""
    site = measurements["site"]
    storeys = measurements["storeys"]
    
    # Step 1: Site classification
    wind_zone = determine_wind_zone(site)
    eq_zone = determine_eq_zone(site["territorial_authority"])
    
    # Step 2: Bracing demand
    bracing = calculate_bracing_demand(wind_zone, eq_zone, storeys, site)
    
    # Step 3: Per-storey member sizing
    level_designs = []
    for storey in storeys:
        walls = size_walls(storey, wind_zone, site)
        floor = size_floor(storey)
        roof = size_roof(storey, wind_zone, site) if storey.get("is_top_storey") else None
        level_designs.append({"walls": walls, "floor": floor, "roof": roof})
    
    # Step 4: Connections + nailing
    connections = generate_connections(level_designs, wind_zone)
    
    # Step 5: Assemble output
    return {
        "wind_zone": wind_zone,
        "eq_zone": eq_zone,
        "bracing_design": bracing,
        "levels": level_designs,
        "connections": connections,
        "compliance_notes": generate_compliance_notes(...)
    }
```

### 4.2 Core lookup function

```python
def table_lookup(table_data: dict, value: float, entries: dict) -> str:
    """Generic NZS 3604 table lookup.
    
    NZS 3604 rule: if input falls between table rows, use NEXT ROW UP (conservative).
    For size lookups: find smallest member where max_span >= required_span.
    """
    # Round input up to next table key
    table_keys = sorted([float(k) for k in entries.keys()])
    for tk in table_keys:
        if value <= tk:
            return entries[str(tk)]
    return entries[str(table_keys[-1])]  # use largest if exceeded (may trigger SED flag)
```

### 4.3 Wall sizing functions

```python
def size_walls(storey: dict, wind_zone: str, site: dict) -> list:
    """Size all walls in a storey."""
    results = []
    for wall in storey["walls"]:
        w = {}
        w["wall_id"] = wall["name"]
        
        # Determine wall position
        position = get_wall_position(storey, wall)  # "sot", "lot", "sub"
        
        # Loaded dimension
        loaded_dim_roof = wall.get("loaded_dimension_roof", storey.get("roof_span_m", 4.0) / 2)
        
        # Stud sizing — Table 8.2
        height_m = round(wall.get("height_mm", 2400) / 1000, 1)
        stud = lookup_stud(wind_zone, position, loaded_dim_roof, height_m, preferred_spacing=600)
        w["stud_size"] = stud["size"]
        w["stud_spacing"] = stud["spacing"]
        
        # Top plate — Table 8.16
        w["top_plate"] = lookup_top_plate(loaded_dim_roof, site["roof_weight"], stud["spacing"], stud["size"])
        
        # Bottom plate — Table 8.17
        w["bottom_plate"] = lookup_bottom_plate(loaded_dim_roof, site["roof_weight"], stud["spacing"], storey.get("floor_type"))
        
        # Dwangs — S8.8
        w["dwang_positions"] = get_dwang_positions(wall.get("height_mm", 2400))
        
        # Openings — lintels, trimmers
        w["openings"] = []
        for opening in wall.get("openings", []):
            o = size_opening(opening, wall, wind_zone, position, loaded_dim_roof, stud, site)
            w["openings"].append(o)
        
        results.append(w)
    return results


def size_opening(opening, wall, wind_zone, position, loaded_dim_roof, stud, site):
    """Size lintel + trimming studs for one opening."""
    span_m = opening["width_mm"] / 1000
    
    # Determine lintel load case — Table 8.8
    load_case = determine_lintel_load_case(wall)
    
    # Get loaded dimension for lintel
    loaded_dim_lintel = get_lintel_loaded_dim(wall, loaded_dim_roof)
    
    # Lintel sizing — Tables 8.9–8.13
    lintel = lookup_lintel(load_case, loaded_dim_lintel, span_m, site["roof_weight"])
    
    # Trimming studs — Table 8.5
    # Get the stud thickness that would apply at 600mm spacing
    stud_thickness_at_600 = get_stud_thickness_at_600(wind_zone, position, loaded_dim_roof, stud["height_m"])
    trimmer = lookup_trimming_stud(position, span_m, stud_thickness_at_600)
    
    # Sill/head trimmer — Table 8.15
    sill_trimmer = lookup_sill_head_trimmer(opening, wind_zone) if opening["type"] == "window" else None
    
    # Lintel fixing — Table 8.14
    lintel_fixing = lookup_lintel_fixing(load_case, wind_zone, span_m)
    
    # Jack studs (cripple studs below sill / above head)
    jack_stud_spacing = stud["spacing"]
    jack_studs_below = max(0, int(opening.get("sill_mm", 0) / jack_stud_spacing))
    jack_studs_above = max(0, int((wall.get("height_mm", 2400) - opening.get("head_height_mm", opening["height_mm"])) / jack_stud_spacing))
    
    return {
        "opening_id": opening["ref"],
        "opening_type": opening["type"],
        "span_m": span_m,
        "load_case": load_case,
        "lintel_size": lintel["size"],
        "lintel_table_ref": lintel["table_ref"],
        "trimmer_thickness_mm": trimmer["thickness"],
        "trimmer_stud_count": trimmer["count"],
        "sill_trimmer": sill_trimmer,
        "lintel_fixing": lintel_fixing,
        "jack_studs_below_sill": jack_studs_below,
        "jack_studs_above_head": jack_studs_above
    }
```

### 4.4 Floor sizing functions

```python
def size_floor(storey: dict) -> dict:
    """Size floor joists + bearers for a storey."""
    if storey.get("floor_type") == "slab":
        return size_slab(storey)
    
    result = {"type": "suspended_timber", "zones": []}
    for zone in storey.get("floor_zones", []):
        joist_span_m = zone["width_mm"] / 1000  # or length, depending on bearer direction
        bearer_span_m = zone.get("bearer_span_mm", 1800) / 1000  # pile spacing
        
        # Joist — Table 7.1
        joist = lookup_joist(joist_span_m, spacing=450, load_type="dry_interior")
        
        # Bearer — Table 6.4
        load_width_m = joist_span_m / 2  # each bearer carries half the joist span
        bearer = lookup_bearer(bearer_span_m, load_width_m, continuous=True)
        
        # Flooring — Tables 7.3/7.4
        flooring = lookup_flooring(joist["spacing"])
        
        result["zones"].append({
            "zone": zone.get("name", "Floor"),
            "joist_size": joist["size"],
            "joist_spacing": joist["spacing"],
            "joist_span_m": joist_span_m,
            "bearer_size": bearer["size"],
            "bearer_span_m": bearer_span_m,
            "flooring": flooring,
        })
    return result


def size_slab(storey: dict) -> dict:
    """Slab-on-ground specification per S7.5."""
    return {
        "type": "slab_on_ground",
        "thickness_mm": 100,
        "dpm": "0.25mm polyethylene",
        "base_course": "75mm compacted gravel (AP40)",
        "reinforcing": "665 mesh or equivalent fibre",
        "edge_thickening": "per Figs 7.13/7.14",
        "anchor_bolts": "M12 at 1200 crs, 150mm from plate ends",
        "shrinkage_joints": "max 6.0m spacing per Fig 7.19",
        "internal_lb_wall": "thickened slab 300mm wide × 200mm deep per S7.5.11",
        "ref": "NZS 3604 S7.5"
    }
```

### 4.5 Roof sizing functions

```python
def size_roof(storey: dict, wind_zone: str, site: dict) -> dict:
    """Size roof members."""
    pitch = storey.get("roof_pitch", 22.5)
    rafter_span_m = storey.get("rafter_span_m", 4.0)
    
    # Rafters — Table 10.1
    rafter = lookup_rafter(wind_zone, rafter_span_m, spacing=600, pitch=pitch, roof_weight=site["roof_weight"])
    
    # Ridge beam — Table 10.2 (if applicable)
    ridge_span_m = storey.get("ridge_span_m")
    ridge = None
    if ridge_span_m:
        ridge = lookup_ridge_beam(wind_zone, ridge_span_m, loaded_width_m=rafter_span_m, roof_weight=site["roof_weight"])
    
    # Ceiling joists — Table 10.3
    ceiling_span_m = storey.get("ceiling_span_m", storey.get("plan_width_mm", 8000) / 1000)
    ceiling_joist = lookup_ceiling_joist(ceiling_span_m, spacing=600)
    
    # Purlins — Tables 10.10/10.11
    purlins = lookup_purlins(rafter["spacing"], wind_zone)
    
    # Truss/rafter fixing — Tables 10.14/10.15
    fixing = lookup_truss_fixing(wind_zone, rafter["spacing"], rafter_span_m)
    
    # Roof bracing — Tables 10.16/10.17
    roof_bracing = lookup_roof_bracing(storey.get("plan_width_mm", 8000))
    
    return {
        "pitch": pitch,
        "rafter_size": rafter["size"],
        "rafter_spacing": rafter["spacing"],
        "rafter_span_m": rafter_span_m,
        "ridge_beam": ridge["size"] if ridge else "ridge board only",
        "ceiling_joist_size": ceiling_joist["size"],
        "ceiling_joist_spacing": ceiling_joist["spacing"],
        "purlins": purlins,
        "truss_fixing": fixing,
        "roof_bracing": roof_bracing,
    }
```

### 4.6 Bracing demand

```python
def calculate_bracing_demand(wind_zone, eq_zone, storeys, site):
    """Calculate wind + EQ bracing demand per S5.2–5.3."""
    results = {"wind": {}, "earthquake": {}, "governing": {}}
    
    for storey in storeys:
        level = storey.get("level_name", "ground")
        plan_length_m = storey.get("plan_length_mm", 0) / 1000
        plan_width_m = storey.get("plan_width_mm", 0) / 1000
        
        # Wind BU/m — Tables 5.5–5.7
        wind_along, wind_across = lookup_wind_bracing(wind_zone, storey, plan_length_m, plan_width_m)
        wind_total_along = wind_along * plan_width_m
        wind_total_across = wind_across * plan_length_m
        
        # Earthquake BU/m² — Tables 5.8–5.10
        eq_bu_m2 = lookup_eq_bracing(eq_zone, site, storey)
        floor_area = plan_length_m * plan_width_m
        eq_total = eq_bu_m2 * floor_area
        
        # Governing = max of wind and earthquake in each direction
        results["wind"][level] = {"along_bu_m": wind_along, "across_bu_m": wind_across,
                                   "along_total": wind_total_along, "across_total": wind_total_across}
        results["earthquake"][level] = {"bu_m2": eq_bu_m2, "total": eq_total}
        results["governing"][level] = {
            "along": max(wind_total_along, eq_total),
            "across": max(wind_total_across, eq_total)
        }
    
    return results
```

---

## 5. nzs3604_report.py — COMPARISON OUTPUT

Generates the side-by-side: NZS 3604 stickframe vs DEVPRO SIP.

```python
def generate_comparison(measurements, nzs3604_design, sip_design):
    """Generate comparison data for each building element."""
    comparison = []
    
    for level in nzs3604_design["levels"]:
        for wall_3604 in level["walls"]:
            wall_id = wall_3604["wall_id"]
            # Find matching SIP wall
            sip_wall = find_sip_wall(sip_design, wall_id)
            
            comparison.append({
                "element": f"Wall {wall_id}",
                "stickframe": {
                    "components": count_stickframe_components(wall_3604),
                    "studs": f"{wall_3604['stud_size']} @ {wall_3604['stud_spacing']} crs",
                    "top_plate": wall_3604["top_plate"],
                    "bottom_plate": wall_3604["bottom_plate"],
                    "insulation": "R2.0 batts (with ~18% thermal bridging)",
                    "building_wrap": "Required",
                    "interior_lining": "10mm GIB plasterboard",
                    "trades_required": "framer, insulator, wrapper, plasterer, painter",
                },
                "devpro_sip": {
                    "components": f"{sip_wall['panel_count']} × DEVPRO panels",
                    "panel_type": sip_wall.get("panel_type", "162mm wall"),
                    "insulation": "R2.5+ continuous (zero bridging)",
                    "building_wrap": "Not required",
                    "interior_lining": "MgSO4 inner skin (no GIB)",
                    "trades_required": "SIP installer, painter",
                },
                "advantage": "DEVPRO"
            })
    
    return comparison
```

---

## 6. INTEGRATION INTO run_takeoff.py

Add after the panel calculator call:

```python
# ── NZS 3604 stickframe comparison ──
if M.get("site"):
    nzs3604_script = os.path.join(SCRIPT_DIR, "nzs3604_calculator.py")
    run(["python3", nzs3604_script, meas_path, os.path.join(WORK_DIR, "nzs3604_design.json")],
        "NZS 3604 stickframe calculation")
    
    # Generate comparison report
    nzs3604_report_script = os.path.join(SCRIPT_DIR, "nzs3604_report.py")
    run(["python3", nzs3604_report_script,
         os.path.join(WORK_DIR, "nzs3604_design.json"),
         os.path.join(WORK_DIR, "calculation_results.json"),  # SIP results
         os.path.join(WORK_DIR, "nzs3604_comparison.json")],
        "NZS 3604 vs DEVPRO comparison")
```

---

## 7. BUILD ORDER FOR CLAUDE CODE

Do it in this exact order. Each step is testable independently.

### Step 1: Data entry — nzs3604_tables.json
**Effort: 3–5 days** (this is the grind)

Encode all ~65 SG8 tables from the PDF into JSON. Work through by section:
1. S5 tables (wind zones, bracing demand) — 7 tables
2. S6 tables (piles, bearers, jack studs) — 5 tables  
3. S7 tables (joists, flooring) — 4 tables
4. S8 tables (studs, lintels, trimmers, plates) — 15 tables
5. S10 tables (rafters, ridge, ceiling, purlins, fixings) — 14 tables
6. Nailing schedules (5 tables across sections)
7. Everything else (durability, posts, etc.) — ~15 tables

**Validation:** After each section, write a quick test script that looks up 3–5 known values and asserts they match the PDF.

### Step 2: Core engine — nzs3604_calculator.py
**Effort: 3–5 days**

Build in order:
1. `determine_wind_zone()` + `determine_eq_zone()` — test with Whangarei/Auckland/Wellington
2. `calculate_bracing_demand()` — test against a known bracing calc
3. `lookup_stud()` — test against Table 8.2 spot checks
4. `lookup_lintel()` + `determine_lintel_load_case()` — test all 5 load cases
5. `lookup_trimming_stud()` — test against Table 8.5
6. `lookup_top_plate()` + `lookup_bottom_plate()` — test against Tables 8.16/8.17
7. `lookup_joist()` + `lookup_bearer()` — test against Tables 7.1/6.4
8. `lookup_rafter()` + `lookup_ridge_beam()` — test against Tables 10.1/10.2
9. `lookup_truss_fixing()` — test against Tables 10.14/10.15
10. Bracing capacity check + distribution rules
11. Main `calculate_nzs3604()` orchestrator

### Step 3: Report + comparison — nzs3604_report.py
**Effort: 1–2 days**

### Step 4: Integration into run_takeoff.py + excel/pdf generators
**Effort: 2–3 days**

Add to excel:
- "NZS 3604 Timber Schedule" sheet
- "NZS 3604 Fixing Schedule" sheet
- "Stickframe vs SIP Comparison" sheet

Add to PDF:
- Stickframe specification pages
- Side-by-side comparison table

### Step 5: Testing + validation
**Effort: 2–3 days**

- Unit tests for every lookup function
- Integration test with a real measurements.json (use Haruru or a recent takeoff)
- Validate outputs against a manually-checked NZS 3604 design

---

## 8. MEASUREMENTS.JSON ADDITIONS

### New site fields to prompt for

When running a takeoff, add these questions to Step 0:

```
NZS 3604 Site Parameters:
1. Wind region: A (most of NZ) or W (Wellington/Cook Strait)?
2. Lee zone: Is the site in a wind lee zone? (usually no)
3. Ground roughness: Urban (houses/trees within 500m) or Open?
4. Site exposure: Sheltered (normal suburban) or Exposed (hilltop/coastal)?
5. Topographic class: T1 (flat), T2 (mild slope), T3 (steep), T4 (escarpment)?
6. Territorial authority: (for EQ zone lookup)
7. Roof weight: Light (steel/membrane) or Heavy (concrete tile)?
8. Cladding weight: Light (weatherboard/panel), Medium (brick veneer single), Heavy (double masonry)?
```

Most of these have obvious defaults for Northland residential:
- Wind region: A
- Lee zone: No
- Ground roughness: Open (unless urban subdivision)
- Site exposure: Sheltered (unless hilltop/coastal)
- Topographic class: T1 (flat sites)
- Territorial authority: from address
- Roof weight: Light
- Cladding weight: Light

### New roof/floor fields per storey

```json
{
  "level_name": "ground",
  "is_top_storey": true,
  "floor_to_ceiling_height_mm": 2400,
  "plan_length_mm": 12000,
  "plan_width_mm": 8000,
  "floor_type": "slab",
  "roof_pitch": 22.5,
  "roof_form": "gable",
  "rafter_span_m": 4.0,
  "ridge_span_m": 3.6,
  "ceiling_span_m": 8.0,
  "walls": [ ... ],
  "floor_zones": [ ... ]
}
```

### New wall fields

Add to each wall in measurements.json:

```json
{
  "name": "N-W1",
  "wall_type": "external_loadbearing",
  "is_bracing_wall": true,
  "supports_roof": true,
  "supports_upper_wall": false,
  "supports_floor": false,
  "loaded_dimension_roof_m": 4.0,
  "loaded_dimension_floor_m": null,
  "external_mm": 9000,
  "height_mm": 2400,
  "openings": [ ... ]
}
```

---

## 9. WHAT SUCCESS LOOKS LIKE

When Matt runs a takeoff, the output now includes:

1. **DEVPRO SIP schedule** (existing) — panel counts, CNC cuts, layouts
2. **NZS 3604 stickframe schedule** (new) — every timber member, every nail
3. **Side-by-side comparison** (new) — showing the SIP replaces X studs, Y plates, Z dwangs, plus insulation, wrap, and GIB

This gives Matt and his team a powerful sales tool: "Here's what you'd need to build this house with stickframe. Here's what you need with DEVPRO. Look at the difference."

And for BCAs/engineers: the NZS 3604 output demonstrates that DEVPRO understands the prescriptive requirements and can show exactly what the SIP panels are replacing.

---

## 10. TOTAL EFFORT ESTIMATE

| Step | Task | Days |
|------|------|------|
| 1 | Table encoding (65 tables → JSON) | 3–5 |
| 2 | Core engine (calculator.py) | 3–5 |
| 3 | Comparison report | 1–2 |
| 4 | Integration (run_takeoff, excel, pdf) | 2–3 |
| 5 | Testing + validation | 2–3 |
| **Total** | | **11–18 days** |

The table encoding (Step 1) is the single biggest piece and can start immediately — it's pure data entry from the PDF with no dependencies.
