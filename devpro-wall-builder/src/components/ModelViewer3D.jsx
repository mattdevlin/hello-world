import { useState, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Text, Sphere } from '@react-three/drei';
import { computeFloorPlanFromConnections } from '../utils/floorPlan.js';
import { calculateWallLayout } from '../utils/calculator.js';
import { computeLayoutBounds, computeWallEndpoint } from '../utils/wallSnap.js';
import { WALL_THICKNESS, COLORS } from '../utils/constants.js';

const MM_TO_M = 1 / 1000;

const WALL_COLORS = {
  front: COLORS.PANEL,
  right: '#5BA55B',
  back: '#D9904A',
  left: COLORS.END_CAP,
};
const SELECTED_EMISSIVE = '#335599';
const SNAP_POINT_COLOR = '#ff4444';
const SNAP_POINT_CONNECTED_COLOR = '#44cc44';

/**
 * Small sphere marker at a wall's snap endpoint.
 */
function SnapPointMarker({ entry, end, isConnected, onClick }) {
  const s = MM_TO_M;
  const endpoint = computeWallEndpoint(entry.wall, end);
  const angle = entry.rotation.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Position in world space
  const wx = entry.position.x + endpoint.localX_mm * cos;
  const wz = entry.position.z - endpoint.localX_mm * sin;
  const wy = 0.15; // slightly above ground

  const color = isConnected ? SNAP_POINT_CONNECTED_COLOR : SNAP_POINT_COLOR;

  return (
    <Sphere
      args={[0.12, 16, 16]}
      position={[wx * s, wy, wz * s]}
      onClick={(e) => { e.stopPropagation(); onClick(end); }}
    >
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </Sphere>
  );
}

/**
 * Single wall mesh — a box with openings cut out (approximated as separate meshes).
 */
function WallMesh({ entry, layout, isSelected, onSelect, showWireframe }) {
  const { position, rotation, dimensions } = entry;
  const s = MM_TO_M;
  const len = dimensions.length * s;
  const h = dimensions.height * s;
  const thick = dimensions.thickness * s;

  const wallColor = WALL_COLORS[entry.side] || COLORS.PANEL;

  return (
    <group
      position={[position.x * s, position.y * s, position.z * s]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      onClick={(e) => { e.stopPropagation(); onSelect(entry.wall.id); }}
    >
      {/* Main wall body */}
      <mesh castShadow>
        <boxGeometry args={[len, h, thick]} />
        <meshStandardMaterial
          color={wallColor}
          transparent
          opacity={isSelected ? 0.85 : 0.7}
          emissive={isSelected ? SELECTED_EMISSIVE : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>

      {/* Wall wireframe outline */}
      {showWireframe && (
        <mesh>
          <boxGeometry args={[len, h, thick]} />
          <meshBasicMaterial color="#333" wireframe />
        </mesh>
      )}

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
 * Floor plane showing the footprint.
 */
function FloorPlane({ width, depth }) {
  const s = MM_TO_M;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[width * s + 1, depth * s + 1]} />
      <meshStandardMaterial color="#e8e8e0" transparent opacity={0.5} />
    </mesh>
  );
}

/**
 * Snap controls panel (HTML overlay).
 */
function SnapControlsPanel({
  selectedWall, selectedEnd, walls, connections, onAttach, onDetach, onClose,
}) {
  const [attachWallId, setAttachWallId] = useState('');
  const [attachEnd, setAttachEnd] = useState('left');
  const [angleDeg, setAngleDeg] = useState(90);

  // Find existing connection for this endpoint
  const existingConn = connections.find(
    c => (c.wallId === selectedWall.id && c.anchorEnd === selectedEnd) ||
         (c.attachedWallId === selectedWall.id && c.attachedEnd === selectedEnd)
  );

  // Available walls (exclude self and already-connected-at-this-endpoint walls)
  const availableWalls = walls.filter(w => w.id !== selectedWall.id);

  const handleAttach = () => {
    if (!attachWallId) return;
    onAttach({
      id: crypto.randomUUID(),
      wallId: selectedWall.id,
      anchorEnd: selectedEnd,
      attachedWallId: attachWallId,
      attachedEnd: attachEnd,
      angleDeg,
    });
  };

  return (
    <div style={styles.snapPanel}>
      <div style={styles.snapHeader}>
        <strong>{selectedWall.name} — {selectedEnd} end</strong>
        <button onClick={onClose} style={styles.snapCloseBtn}>X</button>
      </div>

      {existingConn ? (
        <div style={styles.snapBody}>
          <p style={styles.snapText}>
            Connected to: {walls.find(w =>
              w.id === (existingConn.wallId === selectedWall.id
                ? existingConn.attachedWallId
                : existingConn.wallId)
            )?.name || 'Unknown'}
          </p>
          <button
            onClick={() => onDetach(existingConn.id)}
            style={styles.snapDetachBtn}
          >
            Detach
          </button>
        </div>
      ) : (
        <div style={styles.snapBody}>
          <label style={styles.snapLabel}>
            Attach wall:
            <select
              value={attachWallId}
              onChange={e => setAttachWallId(e.target.value)}
              style={styles.snapSelect}
            >
              <option value="">Select wall...</option>
              {availableWalls.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>

          <label style={styles.snapLabel}>
            Connect using its:
            <select
              value={attachEnd}
              onChange={e => setAttachEnd(e.target.value)}
              style={styles.snapSelect}
            >
              <option value="left">Left end</option>
              <option value="right">Right end</option>
            </select>
          </label>

          <div style={styles.snapLabel}>
            Orientation:
            <div style={styles.angleGroup}>
              {[0, 90, 180, 270].map(a => (
                <button
                  key={a}
                  onClick={() => setAngleDeg(a)}
                  style={{
                    ...styles.angleBtn,
                    ...(angleDeg === a ? styles.angleBtnActive : {}),
                  }}
                >
                  {a}°
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleAttach}
            disabled={!attachWallId}
            style={{
              ...styles.snapAttachBtn,
              opacity: attachWallId ? 1 : 0.5,
            }}
          >
            Attach
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 3D Model Viewer for a project's walls arranged via snap connections.
 */
export default function ModelViewer3D({ walls, connections = [], onConnectionsChange }) {
  const [showWireframe, setShowWireframe] = useState(false);
  const [selectedWallId, setSelectedWallId] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);

  const floorPlan = useMemo(
    () => computeFloorPlanFromConnections(walls, connections),
    [walls, connections]
  );

  const layouts = useMemo(() => {
    const map = {};
    for (const entry of floorPlan) {
      const key = entry.wall.id || entry.side;
      map[key] = calculateWallLayout(entry.wall);
    }
    return map;
  }, [floorPlan]);

  const sceneBounds = useMemo(() => {
    if (!floorPlan || floorPlan.length === 0) return { width: 5000, depth: 5000, maxHeight: 3000 };
    const bounds = computeLayoutBounds(floorPlan);
    return {
      width: Math.max(bounds.width, 2000),
      depth: Math.max(bounds.depth, 2000),
      maxHeight: Math.max(bounds.maxHeight, 2000),
    };
  }, [floorPlan]);

  const selectedWall = walls.find(w => w.id === selectedWallId);
  const selectedEntry = floorPlan.find(e => e.wall.id === selectedWallId);

  const handleSelectWall = useCallback((wallId) => {
    setSelectedWallId(prev => prev === wallId ? null : wallId);
    setSelectedEnd(null);
  }, []);

  const handleSelectEnd = useCallback((end) => {
    setSelectedEnd(prev => prev === end ? null : end);
  }, []);

  const isEndpointConnected = useCallback((wallId, end) => {
    return connections.some(
      c => (c.wallId === wallId && c.anchorEnd === end) ||
           (c.attachedWallId === wallId && c.attachedEnd === end)
    );
  }, [connections]);

  const handleAttach = useCallback((connection) => {
    if (onConnectionsChange) {
      onConnectionsChange([...connections, connection]);
    }
    setSelectedEnd(null);
  }, [connections, onConnectionsChange]);

  const handleDetach = useCallback((connectionId) => {
    if (onConnectionsChange) {
      onConnectionsChange(connections.filter(c => c.id !== connectionId));
    }
    setSelectedEnd(null);
  }, [connections, onConnectionsChange]);

  if (!walls || walls.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No walls to display in 3D view.</p>
      </div>
    );
  }

  const camDist = Math.max(sceneBounds.width, sceneBounds.depth, sceneBounds.maxHeight) * MM_TO_M * 1.5;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>3D Model Viewer</h3>
        <div style={styles.headerControls}>
          {selectedWall && (
            <span style={styles.selectedLabel}>
              Selected: {selectedWall.name}
            </span>
          )}
          <label style={styles.toggle}>
            <input
              type="checkbox"
              checked={showWireframe}
              onChange={e => setShowWireframe(e.target.checked)}
            />
            Wireframe
          </label>
        </div>
      </div>
      <div style={styles.canvasWrap}>
        <Canvas shadows onClick={() => { setSelectedWallId(null); setSelectedEnd(null); }}>
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
          {floorPlan.map((entry) => (
            <WallMesh
              key={`wall-${entry.wall.id}`}
              entry={entry}
              layout={layouts[entry.wall.id] || layouts[entry.side]}
              isSelected={entry.wall.id === selectedWallId}
              onSelect={handleSelectWall}
              showWireframe={showWireframe}
            />
          ))}

          {/* Snap point markers for selected wall */}
          {selectedEntry && (
            <>
              <SnapPointMarker
                entry={selectedEntry}
                end="left"
                isConnected={isEndpointConnected(selectedWallId, 'left')}
                onClick={handleSelectEnd}
              />
              <SnapPointMarker
                entry={selectedEntry}
                end="right"
                isConnected={isEndpointConnected(selectedWallId, 'right')}
                onClick={handleSelectEnd}
              />
            </>
          )}

          {/* Axes helper */}
          <axesHelper args={[2]} />
        </Canvas>

        {/* Snap controls overlay */}
        {selectedWall && selectedEnd && onConnectionsChange && (
          <SnapControlsPanel
            selectedWall={selectedWall}
            selectedEnd={selectedEnd}
            walls={walls}
            connections={connections}
            onAttach={handleAttach}
            onDetach={handleDetach}
            onClose={() => setSelectedEnd(null)}
          />
        )}
      </div>
      <div style={styles.legend}>
        <span style={styles.legendHint}>Click a wall to select it. Click the red markers to snap another wall.</span>
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
  headerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  selectedLabel: {
    fontSize: 13,
    color: '#2C5F8A',
    fontWeight: 600,
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
    position: 'relative',
  },
  legend: {
    display: 'flex',
    gap: 16,
    padding: '10px 20px',
    borderTop: '1px solid #eee',
  },
  legendHint: {
    fontSize: 12,
    color: '#888',
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },

  // Snap controls panel
  snapPanel: {
    position: 'absolute',
    top: 10,
    right: 10,
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    width: 260,
    zIndex: 10,
  },
  snapHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '1px solid #eee',
    fontSize: 13,
  },
  snapCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: '#999',
    padding: '2px 6px',
  },
  snapBody: {
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  snapText: {
    margin: 0,
    fontSize: 13,
    color: '#555',
  },
  snapLabel: {
    fontSize: 12,
    color: '#555',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  snapSelect: {
    padding: '6px 8px',
    borderRadius: 4,
    border: '1px solid #ddd',
    fontSize: 13,
  },
  angleGroup: {
    display: 'flex',
    gap: 4,
    marginTop: 4,
  },
  angleBtn: {
    flex: 1,
    padding: '6px 0',
    border: '1px solid #ddd',
    borderRadius: 4,
    background: '#f8f9fa',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    color: '#555',
  },
  angleBtnActive: {
    background: '#2C5F8A',
    color: '#fff',
    borderColor: '#2C5F8A',
  },
  snapAttachBtn: {
    padding: '8px 0',
    background: '#2C5F8A',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  snapDetachBtn: {
    padding: '8px 0',
    background: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
};
