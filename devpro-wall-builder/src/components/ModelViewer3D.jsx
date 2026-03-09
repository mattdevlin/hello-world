import { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Text } from '@react-three/drei';
import { computeFloorPlan } from '../utils/floorPlan.js';
import { calculateWallLayout } from '../utils/calculator.js';
import { WALL_THICKNESS, COLORS } from '../utils/constants.js';

const MM_TO_M = 1 / 1000; // Convert mm to meters for Three.js scene

/**
 * Single wall mesh — a box with openings cut out (approximated as separate meshes).
 */
function WallMesh({ entry, layout }) {
  const { position, rotation, dimensions } = entry;
  const s = MM_TO_M;
  const len = dimensions.length * s;
  const h = dimensions.height * s;
  const thick = dimensions.thickness * s;

  // Wall color by side
  const colorMap = {
    front: '#4A90D9',
    right: '#5BA55B',
    back: '#D9904A',
    left: '#9B59B6',
  };
  const wallColor = colorMap[entry.side] || '#4A90D9';

  return (
    <group
      position={[position.x * s, position.y * s, position.z * s]}
      rotation={[rotation.x, rotation.y, rotation.z]}
    >
      {/* Main wall body */}
      <mesh>
        <boxGeometry args={[len, h, thick]} />
        <meshStandardMaterial color={wallColor} transparent opacity={0.7} />
      </mesh>

      {/* Wall wireframe outline */}
      <mesh>
        <boxGeometry args={[len, h, thick]} />
        <meshBasicMaterial color="#333" wireframe />
      </mesh>

      {/* Openings rendered as darker inset boxes */}
      {layout?.openings?.map((op, i) => {
        const opX = (op.x + op.drawWidth / 2 - dimensions.length / 2) * s;
        const opY = (op.y + op.drawHeight / 2 - dimensions.height / 2) * s;
        return (
          <mesh key={`opening-${i}`} position={[opX, opY, 0]}>
            <boxGeometry args={[op.drawWidth * s, op.drawHeight * s, thick * 1.1]} />
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.3} />
          </mesh>
        );
      })}

      {/* Wall label */}
      <Text
        position={[0, h / 2 + 0.15, thick / 2 + 0.01]}
        fontSize={0.15}
        color="#333"
        anchorX="center"
        anchorY="bottom"
      >
        {entry.wall.name || entry.side}
      </Text>
    </group>
  );
}

/**
 * Floor plane showing the rectangular footprint.
 */
function FloorPlane({ width, depth }) {
  const s = MM_TO_M;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[width * s + 1, depth * s + 1]} />
      <meshStandardMaterial color="#e8e8e0" transparent opacity={0.5} />
    </mesh>
  );
}

/**
 * 3D Model Viewer for a project's walls arranged in a rectangular floor plan.
 *
 * @param {{ walls: Array }} props - Array of wall input objects from the project
 */
export default function ModelViewer3D({ walls }) {
  const [showWireframe, setShowWireframe] = useState(false);

  const floorPlan = useMemo(() => computeFloorPlan(walls), [walls]);

  const layouts = useMemo(() => {
    const map = {};
    for (const entry of floorPlan) {
      map[entry.side] = calculateWallLayout(entry.wall);
    }
    return map;
  }, [floorPlan]);

  // Compute scene bounds for camera
  const sceneBounds = useMemo(() => {
    if (!walls || walls.length === 0) return { width: 5000, depth: 5000, maxH: 3000 };
    const width = walls[0]?.length_mm || 5000;
    const depth = walls[1]?.length_mm || width;
    const maxH = Math.max(...walls.map(w => w.height_mm || 2700));
    return { width, depth, maxH };
  }, [walls]);

  if (!walls || walls.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No walls to display in 3D view.</p>
      </div>
    );
  }

  const camDist = Math.max(sceneBounds.width, sceneBounds.depth, sceneBounds.maxH) * MM_TO_M * 1.5;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>3D Model Viewer</h3>
        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={showWireframe}
            onChange={e => setShowWireframe(e.target.checked)}
          />
          Wireframe
        </label>
      </div>
      <div style={styles.canvasWrap}>
        <Canvas shadows>
          <PerspectiveCamera
            makeDefault
            position={[camDist * 0.8, camDist * 0.6, camDist * 0.8]}
            fov={50}
          />
          <OrbitControls enableDamping dampingFactor={0.1} />

          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
          <directionalLight position={[-5, 10, -5]} intensity={0.3} />

          {/* Floor */}
          <FloorPlane width={sceneBounds.width} depth={sceneBounds.depth} />
          <Grid
            args={[50, 50]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#ccc"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#999"
            fadeDistance={30}
            position={[0, -0.01, 0]}
          />

          {/* Walls */}
          {floorPlan.map((entry, i) => (
            <WallMesh
              key={`wall-${i}`}
              entry={entry}
              layout={layouts[entry.side]}
            />
          ))}

          {/* Axes helper */}
          <axesHelper args={[2]} />
        </Canvas>
      </div>
      <div style={styles.legend}>
        <span style={{ ...styles.legendItem, borderLeft: '4px solid #4A90D9' }}>Front</span>
        <span style={{ ...styles.legendItem, borderLeft: '4px solid #5BA55B' }}>Right</span>
        <span style={{ ...styles.legendItem, borderLeft: '4px solid #D9904A' }}>Back</span>
        <span style={{ ...styles.legendItem, borderLeft: '4px solid #9B59B6' }}>Left</span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e0e0e0',
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid #eee',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  toggle: {
    fontSize: 13,
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  canvasWrap: {
    width: '100%',
    height: 500,
    background: '#f5f5f0',
  },
  legend: {
    display: 'flex',
    gap: 16,
    padding: '10px 20px',
    borderTop: '1px solid #eee',
  },
  legendItem: {
    fontSize: 12,
    color: '#555',
    paddingLeft: 8,
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
};
