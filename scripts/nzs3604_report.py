#!/usr/bin/env python3
"""
NZS 3604 Stickframe vs DEVPRO SIP Comparison Report Generator

Takes the NZS 3604 engine output and a SIP design, then produces a
side-by-side comparison showing the advantages of DEVPRO SIP panels
over traditional NZS 3604 stickframe construction.

Usage:
    python nzs3604_report.py nzs3604_design.json [sip_design.json] [output.json]
"""

import json
import math
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# 1. STICKFRAME COMPONENT COUNTING
# ---------------------------------------------------------------------------


def count_wall_studs(wall: dict) -> int:
    """Count studs in a stickframe wall based on length, spacing, and openings.

    For a standard wall: studs = floor(length / spacing) + 1
    Each opening removes the infill studs but adds trimmers.
    """
    length_mm = wall.get("length_mm", wall.get("wall_length_mm", 0))
    stud = wall.get("stud", {})
    spacing = stud.get("spacing", 600)

    # Base studs
    base_studs = math.floor(length_mm / spacing) + 1

    # Each opening: remove infill studs, add 2 trimmers + 2 jack studs typical
    openings = wall.get("openings", [])
    opening_studs_removed = 0
    trimmer_studs_added = 0
    for opening in openings:
        w = opening.get("width_mm", 0)
        studs_in_opening = max(0, math.floor(w / spacing) - 1)
        opening_studs_removed += studs_in_opening
        # Each opening gets 2 trimmers + 2 king studs (already counted)
        trimmer_studs_added += 2  # 2 trimming studs per opening

    return base_studs - opening_studs_removed + trimmer_studs_added


def count_stickframe_components(wall: dict) -> dict:
    """Count all framing components in a stickframe wall.

    Returns a dict of component counts.
    """
    length_mm = wall.get("length_mm", wall.get("wall_length_mm", 0))
    height_mm = wall.get("height_mm", 2700)

    studs = count_wall_studs(wall)
    openings = wall.get("openings", [])
    lintels = len(openings)
    trimmers = lintels * 2  # 2 trimming studs per opening
    sill_trimmers = sum(1 for o in openings if o.get("type", o.get("opening_type")) == "window")

    # Dwangs: typically at sheet joins and mid-height
    # For a 2700mm wall: dwangs at 1200 and 1350 (sheet join + mid)
    dwang_rows = max(1, math.floor(height_mm / 1200))
    dwangs_per_row = max(1, math.floor(length_mm / 600))
    total_dwangs = dwang_rows * dwangs_per_row

    # Plates: 1 top + 1 bottom
    plates = 2

    return {
        "studs": studs,
        "plates": plates,
        "dwangs": total_dwangs,
        "lintels": lintels,
        "trimming_studs": trimmers,
        "sill_trimmers": sill_trimmers,
        "total_pieces": studs + plates + total_dwangs + lintels + trimmers + sill_trimmers,
    }


# ---------------------------------------------------------------------------
# 2. SIP DESIGN MATCHING
# ---------------------------------------------------------------------------


def find_sip_wall(sip_design: dict, wall_id: str) -> dict | None:
    """Find a matching SIP wall by wall_id or wall_name.

    Args:
        sip_design: SIP design dict with "walls" list.
        wall_id: Wall identifier to match.

    Returns:
        Matching SIP wall dict, or None if not found.
    """
    if not sip_design:
        return None

    for wall in sip_design.get("walls", []):
        if wall.get("wall_id") == wall_id or wall.get("wall_name") == wall_id:
            return wall

    return None


# ---------------------------------------------------------------------------
# 3. ELEMENT COMPARISONS
# ---------------------------------------------------------------------------


def generate_wall_comparison(wall_3604: dict, sip_wall: dict | None) -> dict:
    """Generate side-by-side comparison for a single wall.

    Args:
        wall_3604: NZS 3604 wall design from the engine.
        sip_wall: Matching DEVPRO SIP wall design, or None.

    Returns:
        Comparison dict for this wall.
    """
    wall_id = wall_3604.get("wall_id", wall_3604.get("wall_name", "Wall"))
    stud = wall_3604.get("stud", {})
    top_plate = wall_3604.get("top_plate", {})
    bottom_plate = wall_3604.get("bottom_plate", {})

    components = count_stickframe_components(wall_3604)

    stickframe = {
        "component_count": components["total_pieces"],
        "components": components,
        "stud_size": stud.get("size", "90x45"),
        "stud_spacing_mm": stud.get("spacing", 600),
        "top_plate": top_plate.get("size", "90x45"),
        "bottom_plate": bottom_plate.get("size", "90x45"),
        "insulation": "R2.0 polyester/glasswool batts (~18% thermal bridging at studs)",
        "building_wrap": "Required (building paper or flexible underlay)",
        "interior_lining": "10mm GIB plasterboard",
        "exterior_cladding_substrate": "Cavity battens + building wrap",
        "trades_required": [
            "Framer (studs, plates, dwangs, lintels)",
            "Insulator (batt installation)",
            "Wrapper (building paper/wrap)",
            "Plasterer (GIB fixing, stopping, finishing)",
            "Painter",
        ],
    }

    if sip_wall:
        panel_count = sip_wall.get("panel_count", 0)
        devpro = {
            "component_count": panel_count,
            "panel_count": panel_count,
            "panel_type": sip_wall.get("panel_type", "162mm DEVPRO SIP"),
            "insulation": "R2.5+ continuous EPS (zero thermal bridging)",
            "building_wrap": "Not required (panel is the weather barrier)",
            "interior_lining": "MgSO4 inner skin (no GIB needed)",
            "exterior_cladding_substrate": "Direct fix to panel face",
            "trades_required": [
                "SIP installer (panels, splines, adhesive)",
                "Painter",
            ],
        }
    else:
        devpro = {
            "component_count": None,
            "_note": "No matching SIP wall found — comparison not available",
        }

    advantages = []
    if sip_wall:
        advantages.append(
            f"{components['total_pieces'] - sip_wall.get('panel_count', 0)} fewer components"
        )
        advantages.append("Zero thermal bridging (vs ~18% with studs)")
        advantages.append("No building wrap required")
        advantages.append("No GIB stopping/finishing")
        advantages.append(
            f"{len(stickframe['trades_required']) - len(devpro['trades_required'])} fewer trades"
        )

    return {
        "element": f"Wall {wall_id}",
        "stickframe": stickframe,
        "devpro_sip": devpro,
        "advantages": advantages,
        "winner": "DEVPRO SIP",
    }


def generate_floor_comparison(floor_3604: dict) -> dict:
    """Generate floor comparison: timber vs SIP.

    For SIP floors, DEVPRO panels replace joists + bearers + underfloor
    insulation with structural insulated panels on piles.
    """
    floor_type = floor_3604.get("type", "suspended_timber")

    if floor_type == "slab_on_ground":
        return {
            "element": "Floor (slab)",
            "stickframe": {
                "type": "Slab on ground",
                "spec": "100mm slab, 665 mesh, DPM, AP40 base",
            },
            "devpro_sip": {
                "type": "DEVPRO SIP floor panels on piles",
                "advantages": [
                    "Faster installation (crane-lifted panels vs pour + cure)",
                    "Immediate weather tightness",
                    "Built-in insulation",
                ],
            },
            "winner": "Context-dependent",
        }

    # Suspended timber floor
    zones = floor_3604.get("zones", [])
    joist_sizes = [z.get("joist", {}).get("size", "?") for z in zones]
    bearer_sizes = [z.get("bearer", {}).get("size", "?") for z in zones]

    return {
        "element": "Floor (suspended timber)",
        "stickframe": {
            "type": "Timber joists + bearers on piles",
            "joists": list(set(joist_sizes)),
            "bearers": list(set(bearer_sizes)),
            "insulation": "Underfloor batts (R1.3 minimum) — often poorly installed",
            "trades": ["Piling contractor", "Framer", "Plumber (under-slab)", "Insulator"],
        },
        "devpro_sip": {
            "type": "DEVPRO SIP floor panels on bearers/piles",
            "insulation": "R2.5+ continuous EPS (factory installed)",
            "advantages": [
                "Pre-insulated (no underfloor batts needed)",
                "Faster installation (fewer pieces)",
                "Airtight floor platform",
                "Consistent insulation performance",
            ],
            "trades": ["Piling contractor", "SIP installer"],
        },
        "winner": "DEVPRO SIP",
    }


def generate_roof_comparison(roof_3604: dict) -> dict:
    """Generate roof comparison: stickframe vs SIP.

    For SIP roofs, DEVPRO panels replace rafters + purlins + insulation
    with structural insulated roof panels.
    """
    rafter = roof_3604.get("rafter", {})
    ceiling_joist = roof_3604.get("ceiling_joist", {})

    return {
        "element": "Roof",
        "stickframe": {
            "type": "Timber rafters/trusses",
            "rafter_size": rafter.get("size", "?"),
            "rafter_spacing_mm": rafter.get("spacing", 600),
            "ceiling_joist": ceiling_joist.get("size", "?"),
            "insulation": "R3.3 ceiling batts (draped between trusses/joists)",
            "components": "Rafters, purlins, ceiling joists, bracing, battens",
            "trades": ["Framer", "Roofer", "Insulator", "Plasterer (ceiling GIB)"],
        },
        "devpro_sip": {
            "type": "DEVPRO SIP roof panels",
            "insulation": "R3.0+ continuous EPS (factory installed)",
            "advantages": [
                "Cathedral ceiling achievable without additional structure",
                "No ceiling batts to install",
                "Fewer components — panels replace rafters + purlins + insulation",
                "Immediate weather tightness once panels placed",
                "Better thermal performance (no sagging insulation)",
            ],
            "trades": ["SIP installer", "Roofer"],
        },
        "winner": "DEVPRO SIP",
    }


# ---------------------------------------------------------------------------
# 4. SUMMARY STATISTICS
# ---------------------------------------------------------------------------


def generate_summary(comparison: dict) -> dict:
    """Generate overall summary statistics across all comparisons.

    Args:
        comparison: Full comparison dict with walls, floor, roof.

    Returns:
        Summary dict with totals and key metrics.
    """
    total_stickframe_components = 0
    total_sip_panels = 0
    stickframe_trades = set()
    sip_trades = set()

    for wall_comp in comparison.get("walls", []):
        sf = wall_comp.get("stickframe", {})
        sip = wall_comp.get("devpro_sip", {})
        total_stickframe_components += sf.get("component_count", 0)
        total_sip_panels += sip.get("panel_count", 0) or 0
        for t in sf.get("trades_required", []):
            stickframe_trades.add(t.split(" (")[0])
        for t in sip.get("trades_required", []):
            sip_trades.add(t.split(" (")[0])

    floor = comparison.get("floor", {})
    for t in floor.get("stickframe", {}).get("trades", []):
        stickframe_trades.add(t)
    for t in floor.get("devpro_sip", {}).get("trades", []):
        sip_trades.add(t)

    roof = comparison.get("roof", {})
    for t in roof.get("stickframe", {}).get("trades", []):
        stickframe_trades.add(t)
    for t in roof.get("devpro_sip", {}).get("trades", []):
        sip_trades.add(t)

    return {
        "stickframe": {
            "total_wall_components": total_stickframe_components,
            "trades_required": sorted(stickframe_trades),
            "trade_count": len(stickframe_trades),
        },
        "devpro_sip": {
            "total_wall_panels": total_sip_panels,
            "trades_required": sorted(sip_trades),
            "trade_count": len(sip_trades),
        },
        "component_reduction": (
            total_stickframe_components - total_sip_panels
            if total_sip_panels > 0
            else None
        ),
        "component_reduction_pct": (
            round((1 - total_sip_panels / total_stickframe_components) * 100, 1)
            if total_stickframe_components > 0 and total_sip_panels > 0
            else None
        ),
        "trade_reduction": len(stickframe_trades) - len(sip_trades),
        "key_advantages": [
            "Fewer components = faster build time",
            "Continuous insulation = better thermal performance",
            "No building wrap = material + labour saving",
            "Fewer trades = simpler project management",
            "Factory precision = consistent quality",
            "Immediate weather tightness = reduced weather delays",
        ],
    }


# ---------------------------------------------------------------------------
# 5. MAIN COMPARISON GENERATOR
# ---------------------------------------------------------------------------


def generate_comparison(
    nzs3604_design: dict,
    sip_design: dict | None = None,
) -> dict:
    """Generate the full NZS 3604 stickframe vs DEVPRO SIP comparison.

    Args:
        nzs3604_design: Complete NZS 3604 engine output.
        sip_design: DEVPRO SIP design (optional — comparison still works
            without it, just won't have SIP-specific panel counts).

    Returns:
        Complete comparison report dict.
    """
    comparison = {
        "_meta": {
            "report_type": "NZS 3604 Stickframe vs DEVPRO SIP Comparison",
            "standard": "NZS 3604:2011",
            "grade": "SG8",
        },
        "site": nzs3604_design.get("site", {}),
    }

    # Wall comparisons
    wall_comparisons = []
    for level in nzs3604_design.get("levels", []):
        for wall in level.get("walls", []):
            wall_id = wall.get("wall_id", wall.get("wall_name", ""))
            sip_wall = find_sip_wall(sip_design, wall_id) if sip_design else None
            wall_comparisons.append(generate_wall_comparison(wall, sip_wall))
    comparison["walls"] = wall_comparisons

    # Floor comparison (use first level's floor)
    levels = nzs3604_design.get("levels", [])
    if levels:
        floor_3604 = levels[0].get("floor", {})
        comparison["floor"] = generate_floor_comparison(floor_3604)

    # Roof comparison (use top storey's roof)
    for level in levels:
        if level.get("roof"):
            comparison["roof"] = generate_roof_comparison(level["roof"])
            break

    # Summary
    comparison["summary"] = generate_summary(comparison)

    return comparison


# ---------------------------------------------------------------------------
# 6. CLI
# ---------------------------------------------------------------------------


def main():
    """CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: python nzs3604_report.py nzs3604_design.json [sip_design.json] [output.json]")
        sys.exit(1)

    nzs3604_path = sys.argv[1]
    sip_path = sys.argv[2] if len(sys.argv) > 2 else None
    output_path = sys.argv[3] if len(sys.argv) > 3 else "nzs3604_comparison.json"

    with open(nzs3604_path, "r") as f:
        nzs3604_design = json.load(f)

    sip_design = None
    if sip_path:
        with open(sip_path, "r") as f:
            sip_design = json.load(f)

    comparison = generate_comparison(nzs3604_design, sip_design)

    with open(output_path, "w") as f:
        json.dump(comparison, f, indent=2)

    print(f"Comparison report written to {output_path}")


if __name__ == "__main__":
    main()
