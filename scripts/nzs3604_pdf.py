#!/usr/bin/env python3
"""
NZS 3604 PDF Report Generator

Generates a PDF report with:
1. NZS 3604 Timber Framing Specification
2. Nailing & Fixing Schedule
3. Stickframe vs DEVPRO SIP Comparison

Dependencies: reportlab (or fpdf2 as fallback)

Usage:
    python nzs3604_pdf.py nzs3604_design.json [comparison.json] [output.pdf]
"""

import json
import sys

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak,
    )
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False


# ---------------------------------------------------------------------------
# PDF Generation
# ---------------------------------------------------------------------------


def _heading(text, style):
    """Create a heading paragraph."""
    return Paragraph(text, style)


def _build_timber_table(design, styles):
    """Build the timber schedule table data."""
    elements = []
    elements.append(_heading("NZS 3604:2011 Timber Framing Schedule — SG8", styles["Title"]))
    elements.append(Spacer(1, 6 * mm))

    # Site info
    site = design.get("site", {})
    site_text = (
        f"Wind Zone: {site.get('wind_zone', '')} | "
        f"EQ Zone: {site.get('eq_zone', '')} | "
        f"Soil Type: {site.get('soil_type', '')}"
    )
    elements.append(Paragraph(site_text, styles["Normal"]))
    elements.append(Spacer(1, 4 * mm))

    # Table data
    data = [["Level", "Element", "Size", "Spacing", "Max Span", "Reference"]]

    for level in design.get("levels", []):
        level_name = level.get("level_name", "")

        for wall in level.get("walls", []):
            wall_name = wall.get("wall_id", wall.get("wall_name", ""))
            stud = wall.get("stud", {})
            data.append([
                level_name, f"Wall {wall_name} — Studs",
                stud.get("size", ""), f"{stud.get('spacing', '')}mm",
                "", stud.get("ref", ""),
            ])
            tp = wall.get("top_plate", {})
            data.append([
                "", f"Wall {wall_name} — Top Plate",
                tp.get("size", ""), "",
                f"{tp.get('max_span_m', '')}m" if tp.get("max_span_m") else "",
                tp.get("ref", ""),
            ])

        floor = level.get("floor", {})
        if floor.get("type") == "suspended_timber":
            for zone in floor.get("zones", []):
                joist = zone.get("joist", {})
                data.append([
                    level_name, f"Floor — {zone.get('zone', '')} Joists",
                    joist.get("size", ""), f"{joist.get('spacing', '')}mm",
                    f"{joist.get('max_span_m', '')}m" if joist.get("max_span_m") else "",
                    joist.get("ref", ""),
                ])
                bearer = zone.get("bearer", {})
                data.append([
                    "", f"Floor — {zone.get('zone', '')} Bearers",
                    bearer.get("size", ""), "",
                    "", bearer.get("ref", ""),
                ])

        roof = level.get("roof")
        if roof:
            rafter = roof.get("rafter", {})
            data.append([
                level_name, "Roof — Rafters",
                rafter.get("size", ""), f"{rafter.get('spacing', '')}mm",
                f"{rafter.get('max_span_m', '')}m" if rafter.get("max_span_m") else "",
                rafter.get("ref", ""),
            ])
            cj = roof.get("ceiling_joist", {})
            data.append([
                "", "Roof — Ceiling Joists",
                cj.get("size", ""), f"{cj.get('spacing', '')}mm",
                f"{cj.get('max_span_m', '')}m" if cj.get("max_span_m") else "",
                cj.get("ref", ""),
            ])

    if len(data) > 1:
        t = Table(data, colWidths=[25 * mm, 55 * mm, 20 * mm, 20 * mm, 20 * mm, 35 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#003366")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        elements.append(t)

    return elements


def _build_comparison_table(comparison, styles):
    """Build the comparison section."""
    elements = []
    elements.append(PageBreak())
    elements.append(_heading("NZS 3604 Stickframe vs DEVPRO SIP Comparison", styles["Title"]))
    elements.append(Spacer(1, 6 * mm))

    data = [["Element", "NZS 3604 Stickframe", "DEVPRO SIP", "Winner"]]

    for wall_comp in comparison.get("walls", []):
        sf = wall_comp.get("stickframe", {})
        sip = wall_comp.get("devpro_sip", {})
        data.append([
            wall_comp.get("element", ""),
            f"{sf.get('component_count', '?')} pieces",
            f"{sip.get('panel_count', '?')} panels" if sip.get("panel_count") else "N/A",
            wall_comp.get("winner", ""),
        ])

    floor = comparison.get("floor", {})
    if floor:
        data.append([
            floor.get("element", "Floor"),
            floor.get("stickframe", {}).get("type", ""),
            floor.get("devpro_sip", {}).get("type", ""),
            floor.get("winner", ""),
        ])

    roof = comparison.get("roof", {})
    if roof:
        data.append([
            roof.get("element", "Roof"),
            roof.get("stickframe", {}).get("type", ""),
            roof.get("devpro_sip", {}).get("type", ""),
            roof.get("winner", ""),
        ])

    if len(data) > 1:
        t = Table(data, colWidths=[35 * mm, 55 * mm, 55 * mm, 30 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#003366")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        elements.append(t)

    # Summary
    elements.append(Spacer(1, 8 * mm))
    summary = comparison.get("summary", {})
    for adv in summary.get("key_advantages", []):
        elements.append(Paragraph(f"• {adv}", styles["Normal"]))

    return elements


def generate_pdf(design, comparison=None, output_path="nzs3604_report.pdf"):
    """Generate the PDF report.

    Args:
        design: NZS 3604 engine output dict.
        comparison: Comparison report dict (optional).
        output_path: Output file path.
    """
    if not HAS_REPORTLAB:
        print("ERROR: reportlab not installed. Run: pip install reportlab")
        sys.exit(1)

    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
    )
    styles = getSampleStyleSheet()
    elements = []

    # Timber schedule
    elements.extend(_build_timber_table(design, styles))

    # Comparison (if available)
    if comparison:
        elements.extend(_build_comparison_table(comparison, styles))

    doc.build(elements)
    print(f"PDF report saved to {output_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    if len(sys.argv) < 2:
        print("Usage: python nzs3604_pdf.py nzs3604_design.json [comparison.json] [output.pdf]")
        sys.exit(1)

    design_path = sys.argv[1]
    comparison_path = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2].endswith(".json") else None
    output_path = sys.argv[-1] if sys.argv[-1].endswith(".pdf") else "nzs3604_report.pdf"

    with open(design_path, "r") as f:
        design = json.load(f)

    comparison = None
    if comparison_path:
        with open(comparison_path, "r") as f:
            comparison = json.load(f)

    generate_pdf(design, comparison, output_path)


if __name__ == "__main__":
    main()
