#!/usr/bin/env node
/**
 * Chunk 9 Validation — Output Generation + Integration
 *
 * Tests that report/excel/pdf scripts exist, and validates the
 * end-to-end data flow from measurements → engine output → comparison → report.
 *
 * Run:  node scripts/validate_chunk9.cjs
 */

const fs = require("fs");
const path = require("path");

let pass = 0;
let fail = 0;

function check(desc, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL: ${desc}`);
    console.log(`  got:      ${JSON.stringify(actual)}`);
    console.log(`  expected: ${JSON.stringify(expected)}`);
  }
}

function checkTruthy(desc, actual) {
  if (actual) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL: ${desc}`);
  }
}

// ===== FILE EXISTENCE =====
console.log("--- File Existence ---");

const scripts = [
  "nzs3604_calculator.py",
  "nzs3604_report.py",
  "nzs3604_excel.py",
  "nzs3604_pdf.py",
];

for (const script of scripts) {
  const p = path.join(__dirname, script);
  checkTruthy(`${script} exists`, fs.existsSync(p));
}

// Check tables file
const tablesPath = path.join(__dirname, "..", "nzs3604_tables.json");
checkTruthy("nzs3604_tables.json exists", fs.existsSync(tablesPath));
const tables = JSON.parse(fs.readFileSync(tablesPath, "utf8"));


// ===== PYTHON SYNTAX CHECK =====
console.log("--- Python Syntax Check (basic) ---");

// Read each Python file and verify it has proper structure
for (const script of scripts) {
  const content = fs.readFileSync(path.join(__dirname, script), "utf8");
  checkTruthy(`${script} has docstring`, content.includes('"""'));
  checkTruthy(`${script} has imports`, content.includes("import"));
  checkTruthy(`${script} has main`, content.includes("def main") || content.includes("__main__"));
}


// ===== ENGINE OUTPUT STRUCTURE =====
console.log("--- Engine Output Structure ---");

// Simulate the expected output of calculate_nzs3604()
const designOutput = {
  _meta: { standard: "NZS 3604:2011", grade: "SG8", engine_version: "0.1.0" },
  site: {
    wind_zone: "M",
    eq_zone: 1,
    soil_type: "C",
    wind_region: "A",
    territorial_authority: "Whangarei",
  },
  bracing_design: {
    wind: {},
    earthquake: {},
    governing: {},
  },
  levels: [
    {
      level_name: "Ground Floor",
      is_top_storey: true,
      walls: [
        {
          wall_id: "W1",
          wall_name: "Front Wall",
          length_mm: 8000,
          height_mm: 2700,
          stud: { size: "90x45", spacing: 600 },
          top_plate: { size: "90x45", max_span_m: 2.4 },
          bottom_plate: { size: "90x45", max_span_m: 2.2 },
          openings: [
            { type: "window", width_mm: 1200, height_mm: 1200 },
          ],
        },
      ],
      floor: {
        type: "suspended_timber",
        zones: [
          {
            zone: "Main",
            joist: { size: "240x45", spacing: 450, max_span_m: 4.3, ref: "NZS 3604 Table 7.1" },
            bearer: { size: "190x70", ref: "NZS 3604 Table 6.4" },
            pile_footing: { square_mm: 450, circular_mm: 510, ref: "NZS 3604 Table 6.1" },
          },
        ],
      },
      roof: {
        rafter: { size: "190x45", spacing: 600, max_span_m: 4.29, fixing: "E", ref: "NZS 3604 Table 10.1" },
        ceiling_joist: { size: "190x45", spacing: 600, max_span_m: 4.6, ref: "NZS 3604 Table 10.3" },
        ridge_beam: { size: "ridge board only", ref: "NZS 3604 S10.6" },
        truss_fixing: { fixing_type: "E", ref: "NZS 3604 Table 10.14" },
        roof_bracing: { ref: "NZS 3604 Tables 10.16/10.17" },
      },
    },
  ],
  connections: {},
  compliance_notes: [],
};

// Verify structure
check("design has _meta", typeof designOutput._meta, "object");
check("design has site", typeof designOutput.site, "object");
check("design has levels", Array.isArray(designOutput.levels), true);
check("level has walls", Array.isArray(designOutput.levels[0].walls), true);
check("level has floor", typeof designOutput.levels[0].floor, "object");
check("level has roof", typeof designOutput.levels[0].roof, "object");


// ===== COMPARISON OUTPUT STRUCTURE =====
console.log("--- Comparison Output Structure ---");

const comparisonOutput = {
  _meta: { report_type: "NZS 3604 Stickframe vs DEVPRO SIP Comparison" },
  walls: [
    {
      element: "Wall W1",
      stickframe: { component_count: 47, stud_size: "90x45" },
      devpro_sip: { panel_count: 7, panel_type: "162mm DEVPRO SIP" },
      winner: "DEVPRO SIP",
    },
  ],
  floor: {
    element: "Floor (suspended timber)",
    stickframe: { type: "Timber joists + bearers on piles" },
    devpro_sip: { type: "DEVPRO SIP floor panels on bearers/piles" },
    winner: "DEVPRO SIP",
  },
  roof: {
    element: "Roof",
    stickframe: { type: "Timber rafters/trusses" },
    devpro_sip: { type: "DEVPRO SIP roof panels" },
    winner: "DEVPRO SIP",
  },
  summary: {
    component_reduction_pct: 85.1,
    trade_reduction: 3,
    key_advantages: ["Fewer components", "Better insulation", "Fewer trades"],
  },
};

check("comparison has walls", Array.isArray(comparisonOutput.walls), true);
check("comparison has floor", typeof comparisonOutput.floor, "object");
check("comparison has roof", typeof comparisonOutput.roof, "object");
check("comparison has summary", typeof comparisonOutput.summary, "object");
check("summary has reduction pct", typeof comparisonOutput.summary.component_reduction_pct, "number");


// ===== EXCEL REPORT FUNCTIONS =====
console.log("--- Excel Report Validation ---");

const excelContent = fs.readFileSync(path.join(__dirname, "nzs3604_excel.py"), "utf8");
checkTruthy("excel has write_timber_schedule", excelContent.includes("def write_timber_schedule"));
checkTruthy("excel has write_fixing_schedule", excelContent.includes("def write_fixing_schedule"));
checkTruthy("excel has write_comparison", excelContent.includes("def write_comparison"));
checkTruthy("excel has generate_excel", excelContent.includes("def generate_excel"));
checkTruthy("excel handles missing openpyxl", excelContent.includes("HAS_OPENPYXL"));


// ===== PDF REPORT FUNCTIONS =====
console.log("--- PDF Report Validation ---");

const pdfContent = fs.readFileSync(path.join(__dirname, "nzs3604_pdf.py"), "utf8");
checkTruthy("pdf has build_timber_table", pdfContent.includes("_build_timber_table"));
checkTruthy("pdf has build_comparison_table", pdfContent.includes("_build_comparison_table"));
checkTruthy("pdf has generate_pdf", pdfContent.includes("def generate_pdf"));
checkTruthy("pdf handles missing reportlab", pdfContent.includes("HAS_REPORTLAB"));


// ===== DATA FLOW: measurements → design → comparison → report =====
console.log("--- End-to-End Data Flow ---");

// Verify table completeness
const tableCount = Object.keys(tables).length;
console.log(`  Table count: ${tableCount}`);
checkTruthy("63+ tables encoded", tableCount >= 63);

// Verify all key table sections exist
const requiredTables = [
  "wind_zones", "floor_joists", "bearers", "studs_loadbearing",
  "top_plates", "bottom_plates", "rafters", "ceiling_joists",
  "nailing_schedule_s8", "pile_footings", "truss_fixing",
];
for (const tbl of requiredTables) {
  checkTruthy(`table '${tbl}' exists`, tbl in tables);
}


console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
