import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls, PerspectiveCamera, Text, Environment } from '@react-three/drei';
import { EPS_BLOCK } from '../utils/epsOptimizer.js';

const MM_TO_M = 1 / 1000;
const SLAB_W = EPS_BLOCK.length;  // 4900
const SLAB_H = EPS_BLOCK.width;   // 1220
const BLOCK_GAP = 500; // mm gap between blocks

// ── Piece box ──
function EpsPiece({ x, y, w, h, depth, color, label }) {
  const sx = w * MM_TO_M;
  const sy = depth * MM_TO_M;
  const sz = h * MM_TO_M;
  const px = (x + w / 2) * MM_TO_M;
  const py = sy / 2;
  const pz = (y + h / 2) * MM_TO_M;

  return (
    <mesh position={[px, py, pz]}>
      <boxGeometry args={[sx, sy, sz]} />
      <meshStandardMaterial color={color} transparent opacity={0.85} />
      {label && w > 300 && h > 150 && (
        <Text
          position={[0, sy / 2 + 0.001, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={Math.min(w, h) * MM_TO_M * 0.15}
          color="#fff"
          anchorX="center"
          anchorY="middle"
          maxWidth={sx * 0.9}
        >
          {label}
        </Text>
      )}
    </mesh>
  );
}

// ── Waste region ──
function WasteRegion({ x, y, w, h, depth }) {
  if (w < 1 || h < 1) return null;
  const sx = w * MM_TO_M;
  const sy = depth * MM_TO_M;
  const sz = h * MM_TO_M;
  return (
    <mesh position={[(x + w / 2) * MM_TO_M, sy / 2, (y + h / 2) * MM_TO_M]}>
      <boxGeometry args={[sx, sy, sz]} />
      <meshStandardMaterial color="#e74c3c" transparent opacity={0.15} />
    </mesh>
  );
}

// ── Single slab with its pieces and waste ──
function EpsSlab({ slab, depth, color, yOffset }) {
  const { pieces, wasteRegions } = useMemo(() => {
    const pcs = [];
    const waste = [];
    let shelfY = 0;

    for (const shelf of slab.shelves) {
      let cursorX = 0;
      for (const piece of shelf.pieces) {
        pcs.push({
          x: cursorX,
          y: shelfY,
          w: piece.placedW,
          h: piece.placedH,
          label: piece.label || '',
        });
        cursorX += piece.placedW;
      }
      // Shelf right-side waste
      if (SLAB_W - cursorX > 1) {
        waste.push({ x: cursorX, y: shelfY, w: SLAB_W - cursorX, h: shelf.h });
      }
      shelfY += shelf.h;
    }
    // Bottom waste (remaining slab height)
    if (SLAB_H - shelfY > 1) {
      waste.push({ x: 0, y: shelfY, w: SLAB_W, h: SLAB_H - shelfY });
    }
    return { pieces: pcs, wasteRegions: waste };
  }, [slab]);

  return (
    <group position={[0, yOffset * MM_TO_M, 0]}>
      {/* Slab base plane */}
      <mesh position={[SLAB_W / 2 * MM_TO_M, -0.001, SLAB_H / 2 * MM_TO_M]}>
        <boxGeometry args={[SLAB_W * MM_TO_M, 0.002, SLAB_H * MM_TO_M]} />
        <meshStandardMaterial color="#ddd" transparent opacity={0.3} />
      </mesh>
      {pieces.map((p, i) => (
        <EpsPiece key={i} {...p} depth={depth} color={color} />
      ))}
      {wasteRegions.map((w, i) => (
        <WasteRegion key={`w${i}`} {...w} depth={depth} />
      ))}
    </group>
  );
}

// ── Block = wireframe bounding box + stacked slabs ──
function EpsBlock({ slabs, slabDepth, color, label, position }) {
  const blockSlabs = slabs || [];
  const totalHeight = blockSlabs.length * slabDepth;

  return (
    <group position={position}>
      {/* Block wireframe outline */}
      <mesh position={[SLAB_W / 2 * MM_TO_M, totalHeight / 2 * MM_TO_M, SLAB_H / 2 * MM_TO_M]}>
        <boxGeometry args={[SLAB_W * MM_TO_M, totalHeight * MM_TO_M, SLAB_H * MM_TO_M]} />
        <meshBasicMaterial color="#333" transparent opacity={0.3} wireframe />
      </mesh>

      {/* Stacked slabs */}
      {blockSlabs.map((slab, i) => (
        <EpsSlab key={i} slab={slab} depth={slabDepth} color={color} yOffset={i * slabDepth} />
      ))}

      {/* Label above block */}
      <Text
        position={[SLAB_W / 2 * MM_TO_M, (totalHeight + 80) * MM_TO_M, SLAB_H / 2 * MM_TO_M]}
        fontSize={0.12}
        color="#333"
        anchorX="center"
        anchorY="bottom"
      >
        {label}
      </Text>
    </group>
  );
}

// ── Group slabs into blocks ──
function slabsToBlocks(slabs, slabsPerBlock) {
  const blocks = [];
  for (let i = 0; i < slabs.length; i += slabsPerBlock) {
    blocks.push(slabs.slice(i, i + slabsPerBlock));
  }
  return blocks;
}

// ── Main viewer ──
export default function EpsBlockViewer3D({
  panelSlabs = [],
  splineSlabs = [],
  floorPanelSlabs = [],
  floorSplineSlabs = [],
  roofPanelSlabs = [],
  roofSplineSlabs = [],
}) {
  const { allBlocks, sceneBounds } = useMemo(() => {
    const PANEL_DEPTH = 142;
    const SPLINE_DEPTH = 120;
    const PANEL_PER_BLOCK = 4;
    const SPLINE_PER_BLOCK = 5;

    const categories = [
      { slabs: panelSlabs, depth: PANEL_DEPTH, perBlock: PANEL_PER_BLOCK, color: '#4A90D9', prefix: 'Wall Panel' },
      { slabs: splineSlabs, depth: SPLINE_DEPTH, perBlock: SPLINE_PER_BLOCK, color: '#6AACE6', prefix: 'Wall Spline' },
      { slabs: floorPanelSlabs, depth: PANEL_DEPTH, perBlock: PANEL_PER_BLOCK, color: '#3A7BC8', prefix: 'Floor Panel' },
      { slabs: floorSplineSlabs, depth: SPLINE_DEPTH, perBlock: SPLINE_PER_BLOCK, color: '#5A9CD6', prefix: 'Floor Spline' },
      { slabs: roofPanelSlabs, depth: PANEL_DEPTH, perBlock: PANEL_PER_BLOCK, color: '#2B6CB0', prefix: 'Roof Panel' },
      { slabs: roofSplineSlabs, depth: SPLINE_DEPTH, perBlock: SPLINE_PER_BLOCK, color: '#4A8CC8', prefix: 'Roof Spline' },
    ];

    const blocks = [];
    let cursorX = 0;
    let maxZ = 0;
    let maxY = 0;
    let rowIndex = 0;

    for (const cat of categories) {
      if (!cat.slabs || cat.slabs.length === 0) continue;
      const catBlocks = slabsToBlocks(cat.slabs, cat.perBlock);

      for (let bi = 0; bi < catBlocks.length; bi++) {
        const blockHeight = catBlocks[bi].length * cat.depth;
        blocks.push({
          slabs: catBlocks[bi],
          depth: cat.depth,
          perBlock: cat.perBlock,
          color: cat.color,
          label: `${cat.prefix} ${bi + 1}`,
          position: [cursorX * MM_TO_M, 0, rowIndex * (SLAB_H + BLOCK_GAP) * MM_TO_M],
        });
        maxY = Math.max(maxY, blockHeight);
        maxZ = Math.max(maxZ, (rowIndex + 1) * (SLAB_H + BLOCK_GAP));
        cursorX += SLAB_W + BLOCK_GAP;
      }
      // Next category on same row, or wrap if needed
    }

    const totalW = cursorX > 0 ? cursorX - BLOCK_GAP : SLAB_W;
    return {
      allBlocks: blocks,
      sceneBounds: {
        w: totalW * MM_TO_M,
        h: maxY * MM_TO_M,
        d: Math.max(maxZ, SLAB_H) * MM_TO_M,
      },
    };
  }, [panelSlabs, splineSlabs, floorPanelSlabs, floorSplineSlabs, roofPanelSlabs, roofSplineSlabs]);

  const camDist = Math.max(sceneBounds.w, sceneBounds.d, 3) * 1.5;

  if (allBlocks.length === 0) {
    return (
      <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        No EPS slab data available
      </div>
    );
  }

  return (
    <div style={{ height: 500, border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
      <Canvas>
        <PerspectiveCamera
          makeDefault
          position={[camDist * 0.8, camDist * 0.6, camDist * 0.8]}
          fov={50}
        />
        <CameraControls
          minDistance={camDist * 0.3}
          maxDistance={camDist * 3}
          maxPolarAngle={Math.PI * 0.47}
          smoothTime={0.25}
          draggingSmoothTime={0.1}
        />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 15, 10]} intensity={0.8} />
        <directionalLight position={[-5, 10, -5]} intensity={0.3} />
        <Environment preset="city" background={false} />

        {/* Center the scene */}
        <group position={[-sceneBounds.w / 2, 0, -sceneBounds.d / 2]}>
          {allBlocks.map((block, i) => (
            <EpsBlock
              key={i}
              slabs={block.slabs}
              slabDepth={block.depth}

              color={block.color}
              label={block.label}
              position={block.position}
            />
          ))}
        </group>
      </Canvas>
    </div>
  );
}
