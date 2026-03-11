/**
 * DXF export for CNC Panel Plans.
 *
 * Generates individual panel cutting profiles laid out in a grid.
 * Each piece is drawn at 1:1 mm scale with dimension labels.
 */
import { WINDOW_OVERHANG, PANEL_GAP, OPENING_TYPES, BOTTOM_PLATE, TOP_PLATE } from './constants.js';
import { createDrawing, downloadDxf } from './dxfExporter.js';

const SPLINE_WIDTH = 146;
const HALF_SPLINE = SPLINE_WIDTH / 2;

// ── Profile computation (mirrors PanelPlans.jsx logic) ──

function panelHeightAtLocal(panel, localX) {
  const hL = panel.heightLeft || panel.height;
  const hR = panel.heightRight || panel.height;
  const W = panel.width;
  if (panel.peakHeight && panel.peakXLocal != null) {
    if (localX <= panel.peakXLocal) {
      return panel.peakXLocal > 0
        ? hL + (panel.peakHeight - hL) * (localX / panel.peakXLocal)
        : panel.peakHeight;
    }
    const remaining = W - panel.peakXLocal;
    return remaining > 0
      ? panel.peakHeight + (hR - panel.peakHeight) * ((localX - panel.peakXLocal) / remaining)
      : panel.peakHeight;
  }
  return W > 0 ? hL + (hR - hL) * (localX / W) : hL;
}

function topEdgeVertices(panel, x1, x2) {
  const verts = [{ x: x1, y: panelHeightAtLocal(panel, x1) }];
  if (panel.peakHeight && panel.peakXLocal != null && panel.peakXLocal > x1 && panel.peakXLocal < x2) {
    verts.push({ x: panel.peakXLocal, y: panel.peakHeight });
  }
  verts.push({ x: x2, y: panelHeightAtLocal(panel, x2) });
  return verts;
}

function computeLcutProfile(panel) {
  const hL = panel.heightLeft || panel.height;
  const hR = panel.heightRight || panel.height;
  const H = Math.max(hL, hR, panel.peakHeight || 0);
  const ovh = WINDOW_OVERHANG;
  const gap = PANEL_GAP;

  if (panel.side === 'pier') return computePierProfile(panel);

  const isLeft = panel.side === 'left';
  const isWindow = panel.openingType === OPENING_TYPES.WINDOW;
  const sill = panel.openBottom + gap;
  const lintelStep = panel.openTop - gap;

  if (isLeft) {
    const totalW = panel.width;
    const base = totalW - ovh;
    const topEdge = topEdgeVertices(panel, 0, base);
    if (isWindow && sill > 0) {
      return { vertices: [...topEdge, { x: base, y: lintelStep }, { x: totalW, y: lintelStep }, { x: totalW, y: sill }, { x: base, y: sill }, { x: base, y: 0 }, { x: 0, y: 0 }], profileWidth: totalW, profileHeight: H };
    }
    return { vertices: [...topEdge, { x: base, y: lintelStep }, { x: totalW, y: lintelStep }, { x: totalW, y: 0 }, { x: 0, y: 0 }], profileWidth: totalW, profileHeight: H };
  }

  const totalW = panel.width;
  const topEdge = topEdgeVertices(panel, ovh, totalW);
  if (isWindow && sill > 0) {
    return { vertices: [...topEdge, { x: totalW, y: 0 }, { x: ovh, y: 0 }, { x: ovh, y: sill }, { x: 0, y: sill }, { x: 0, y: lintelStep }, { x: ovh, y: lintelStep }], profileWidth: totalW, profileHeight: H };
  }
  return { vertices: [...topEdge, { x: totalW, y: 0 }, { x: 0, y: 0 }, { x: 0, y: lintelStep }, { x: ovh, y: lintelStep }], profileWidth: totalW, profileHeight: H };
}

function computePierProfile(panel) {
  const hL = panel.heightLeft || panel.height;
  const hR = panel.heightRight || panel.height;
  const H = Math.max(hL, hR, panel.peakHeight || 0);
  const ovh = WINDOW_OVERHANG;
  const gap = PANEL_GAP;
  const totalW = panel.width;
  const base = totalW - 2 * ovh;

  const lIsWindow = panel.openingType === OPENING_TYPES.WINDOW;
  const lSill = panel.openBottom + gap;
  const lLintel = panel.openTop - gap;
  const rIsWindow = panel.rightOpeningType === OPENING_TYPES.WINDOW;
  const rSill = panel.rightOpenBottom + gap;
  const rLintel = panel.rightOpenTop - gap;

  const verts = [];
  topEdgeVertices(panel, ovh, ovh + base).forEach(v => verts.push(v));
  verts.push({ x: ovh + base, y: rLintel });

  if (rIsWindow && rSill > 0) {
    verts.push({ x: totalW, y: rLintel }, { x: totalW, y: rSill }, { x: ovh + base, y: rSill }, { x: ovh + base, y: 0 });
  } else {
    verts.push({ x: totalW, y: rLintel }, { x: totalW, y: 0 });
  }

  verts.push({ x: ovh, y: 0 });

  if (lIsWindow && lSill > 0) {
    verts.push({ x: ovh, y: lSill }, { x: 0, y: lSill }, { x: 0, y: lLintel }, { x: ovh, y: lLintel });
  } else {
    verts.push({ x: ovh, y: lLintel }, { x: 0, y: lLintel }, { x: ovh, y: lLintel });
  }

  return { vertices: verts, profileWidth: totalW, profileHeight: H };
}

// ── Collect all pieces from layout ──

function collectPieces(layout) {
  const panels = layout.panels || [];
  const isRaked = layout.isRaked;
  const isMultiCourse = layout.isMultiCourse;
  const courses = layout.courses || [];
  const lintelPanels = layout.lintelPanels || [];
  const footerPanels = layout.footerPanels || [];
  const openings = layout.openings || [];
  const dedLeft = layout.deductionLeft || 0;
  const dedRight = layout.deductionRight || 0;
  const wallH = layout.height;

  const pieces = [];

  // Deductions
  if (dedLeft > 0) {
    pieces.push({ type: 'deduction', label: 'End Wall (left)', vertices: rectVerts(dedLeft, wallH), w: dedLeft, h: wallH, qty: 2 });
  }

  // Raked full panels
  if (isRaked) {
    panels.filter(p => p.type === 'full' && (p.heightLeft !== p.heightRight || p.peakHeight)).forEach(panel => {
      const hL = panel.heightLeft || panel.height;
      const hR = panel.heightRight || panel.height;
      const peakH = panel.peakHeight || 0;
      const maxH = Math.max(hL, hR, peakH);
      const verts = panel.peakHeight
        ? [{ x: 0, y: hL }, { x: panel.peakXLocal, y: panel.peakHeight }, { x: panel.width, y: hR }, { x: panel.width, y: 0 }, { x: 0, y: 0 }]
        : [{ x: 0, y: hL }, { x: panel.width, y: hR }, { x: panel.width, y: 0 }, { x: 0, y: 0 }];
      pieces.push({ type: 'full', label: `P${panel.index + 1} — Full${panel.peakHeight ? ' (gable)' : ' (raked)'}`, vertices: verts, w: panel.width, h: maxH, qty: 2 });
    });
  }

  // L-cut panels
  panels.filter(p => p.type === 'lcut').forEach(panel => {
    const profile = computeLcutProfile(panel);
    const isPier = panel.side === 'pier';
    const sideLabel = isPier ? 'pier' : panel.side;
    pieces.push({ type: 'lcut', label: `P${panel.index + 1} — ${isPier ? 'Pier' : 'L-Cut'} (${sideLabel})`, vertices: profile.vertices, w: profile.profileWidth, h: profile.profileHeight, qty: 2 });
  });

  // End panels
  panels.filter(p => p.type === 'end').forEach(panel => {
    const hL = panel.heightLeft || panel.height;
    const hR = panel.heightRight || panel.height;
    const peakH = panel.peakHeight || 0;
    const maxH = Math.max(hL, hR, peakH);
    const verts = panel.peakHeight
      ? [{ x: 0, y: hL }, { x: panel.peakXLocal, y: panel.peakHeight }, { x: panel.width, y: hR }, { x: panel.width, y: 0 }, { x: 0, y: 0 }]
      : [{ x: 0, y: hL }, { x: panel.width, y: hR }, { x: panel.width, y: 0 }, { x: 0, y: 0 }];
    pieces.push({ type: 'end', label: `P${panel.index + 1} — End`, vertices: verts, w: panel.width, h: maxH, qty: 2 });
  });

  if (dedRight > 0) {
    pieces.push({ type: 'deduction', label: 'End Wall (right)', vertices: rectVerts(dedRight, wallH), w: dedRight, h: wallH, qty: 2 });
  }

  // Lintel panels
  lintelPanels.forEach(l => {
    const hL = l.heightLeft != null ? l.heightLeft : l.height;
    const hR = l.heightRight != null ? l.heightRight : l.height;
    const peakH = l.peakHeight || 0;
    const H = Math.max(hL, hR, peakH);
    const verts = l.peakHeight
      ? [{ x: 0, y: hL }, { x: l.peakXLocal, y: l.peakHeight }, { x: l.width, y: hR }, { x: l.width, y: 0 }, { x: 0, y: 0 }]
      : [{ x: 0, y: hL }, { x: l.width, y: hR }, { x: l.width, y: 0 }, { x: 0, y: 0 }];
    pieces.push({ type: 'lintelPanel', label: `${l.ref} — Lintel Panel`, vertices: verts, w: l.width, h: H, qty: 2 });
  });

  // Footer panels
  footerPanels.forEach(f => {
    pieces.push({ type: 'footerPanel', label: `${f.ref} — Footer Panel`, vertices: rectVerts(f.width, f.height), w: f.width, h: f.height, qty: 2 });
  });

  // Splines
  const splineH = wallH - BOTTOM_PLATE - TOP_PLATE * 2 - 10;
  const splinePieces = [];
  for (let i = 0; i < panels.length - 1; i++) {
    const panel = panels[i];
    const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
    const insideLintelPanel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooterPanel = footerPanels.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (!insideLintelPanel && !insideFooterPanel) splinePieces.push(1);
  }
  for (const op of openings) {
    if (op.y > 0) { splinePieces.push(1); splinePieces.push(1); }
  }
  if (splinePieces.length > 0) {
    pieces.push({ type: 'spline', label: 'Splines', vertices: rectVerts(SPLINE_WIDTH, splineH), w: SPLINE_WIDTH, h: splineH, qty: splinePieces.length * 2 });
  }

  // Horizontal splines (multi-course)
  if (isMultiCourse && courses.length > 1) {
    const HSPLINE_CLEARANCE = 10;
    const jointHasSpline = [];
    for (let i = 0; i < panels.length - 1; i++) {
      const gapCentre = panels[i].x + panels[i].width + PANEL_GAP / 2;
      const insideLintelPanel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
      const insideFooterPanel = footerPanels.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
      jointHasSpline.push(!insideLintelPanel && !insideFooterPanel);
    }
    for (let ci = 0; ci < courses.length - 1; ci++) {
      for (let pi = 0; pi < panels.length; pi++) {
        const panel = panels[pi];
        let leftEdge = panel.x;
        if (pi > 0 && jointHasSpline[pi - 1]) {
          leftEdge = panels[pi - 1].x + panels[pi - 1].width + PANEL_GAP / 2 + HALF_SPLINE;
        }
        let rightEdge = panel.x + panel.width;
        if (pi < panels.length - 1 && jointHasSpline[pi]) {
          rightEdge = panel.x + panel.width + PANEL_GAP / 2 - HALF_SPLINE;
        }
        const w = Math.round(rightEdge - leftEdge - 2 * HSPLINE_CLEARANCE);
        if (w > 0) {
          pieces.push({ type: 'hspline', label: `H-Spline P${panel.index + 1} C${ci + 1}/${ci + 2}`, vertices: rectVerts(w, SPLINE_WIDTH), w, h: SPLINE_WIDTH, qty: 2 });
        }
      }
    }
  }

  // Top course panels (multi-course)
  if (isMultiCourse && courses.length > 1) {
    const topCoursePanels = panels.filter(p => p.isMultiCourse);
    courses.slice(1).forEach((course, ci) => {
      topCoursePanels.forEach(panel => {
        pieces.push({ type: 'top-course', label: `P${panel.index + 1} — Top Course`, vertices: rectVerts(panel.width, course.height), w: panel.width, h: course.height, qty: 2, subtitle: `from ${course.sheetHeight}mm sheet` });
      });
    });
  }

  return pieces;
}

function rectVerts(w, h) {
  return [{ x: 0, y: h }, { x: w, y: h }, { x: w, y: 0 }, { x: 0, y: 0 }];
}

// ── DXF drawing ──

function drawPiece(d, ox, oy, piece) {
  const { vertices, w, h, label, qty, subtitle } = piece;
  const dimOffset = 80;

  // Profile outline
  d.setActiveLayer('OUTLINE');
  const pts = vertices.map(v => [ox + v.x, oy + v.y]);
  d.drawPolyline(pts, true);

  // Dimension labels along edges
  d.setActiveLayer('DIMENSIONS');
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.round(Math.sqrt(dx * dx + dy * dy));
    if (len === 0) continue;

    const mx = ox + (a.x + b.x) / 2;
    const my = oy + (a.y + b.y) / 2;

    if (Math.abs(dy) < 0.1) {
      // Horizontal edge
      const isTop = a.y >= h - 0.1;
      const yOff = isTop ? 30 : -50;
      d.drawText(mx - 30, my + yOff, 30, 0, `${len}`);
    } else if (Math.abs(dx) < 0.1) {
      // Vertical edge
      const minX = Math.min(...vertices.map(v => v.x));
      const isLeft = a.x <= minX + 0.1;
      const xOff = isLeft ? -60 : 30;
      d.drawText(mx + xOff, my, 30, 90, `${len}`);
    }
  }

  // Label
  d.setActiveLayer('LABELS');
  const textSize = Math.min(40, w / 6);
  d.drawText(ox + w / 2 - textSize * label.length / 4, oy + h / 2 + textSize / 2, textSize, 0, label);
  if (subtitle) {
    d.drawText(ox + w / 2 - textSize * 3, oy + h / 2 - textSize, textSize * 0.7, 0, subtitle);
  }

  // Quantity badge
  if (qty > 1) {
    d.drawText(ox + w - 80, oy + h - 30, 35, 0, `x${qty}`);
  }
}

/**
 * Build the DXF drawing for CNC panel plans.
 */
export function buildPanelPlansDxf(layout, wallName) {
  const d = createDrawing();
  const pieces = collectPieces(layout);
  if (pieces.length === 0) return d;

  const spacing = 300;
  const maxRowWidth = 10000;

  // Title
  d.setActiveLayer('LABELS');
  d.drawText(0, -200, 60, 0, `${wallName || 'Wall'} — CNC Panel Plans`);

  let cursorX = 0;
  let cursorY = -400;
  let rowMaxH = 0;

  for (const piece of pieces) {
    if (cursorX > 0 && cursorX + piece.w > maxRowWidth) {
      cursorX = 0;
      cursorY -= rowMaxH + spacing;
      rowMaxH = 0;
    }
    drawPiece(d, cursorX, cursorY - piece.h, piece);
    rowMaxH = Math.max(rowMaxH, piece.h);
    cursorX += piece.w + spacing;
  }

  return d;
}

/**
 * Export CNC panel plans as a DXF file download.
 */
export function exportPanelPlansDxf(layout, wallName, projectName) {
  const d = buildPanelPlansDxf(layout, wallName);
  const parts = [projectName, wallName, 'Panel Plans'].filter(Boolean);
  const filename = parts.join(' ').replace(/\s+/g, ' ').trim() + '.dxf';
  downloadDxf(d, filename);
}
