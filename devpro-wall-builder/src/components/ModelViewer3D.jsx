import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls, PerspectiveCamera, Grid, Text, Sphere, ContactShadows, Environment, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { computeFloorPlanFromConnections } from '../utils/floorPlan.js';
import { calculateWallLayout } from '../utils/calculator.js';
import { computeLayoutBounds, computeWallEndpoint, computeSnapPosition } from '../utils/wallSnap.js';
import { WALL_THICKNESS, COLORS } from '../utils/constants.js';

const MM_TO_M = 1 / 1000;
/** Camera preset positions relative to scene center and camDist. */
const CAMERA_PRESETS = {
  iso:   { label: 'Iso',   pos: [0.8, 0.6, 0.8] },
  front: { label: 'Front', pos: [0, 0.3, 1] },
  back:  { label: 'Back',  pos: [0, 0.3, -1] },
  left:  { label: 'Left',  pos: [-1, 0.3, 0] },
  right: { label: 'Right', pos: [1, 0.3, 0] },
  top:   { label: 'Top',   pos: [0, 1, 0.001] },
};

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
 * Build a THREE.Shape for a wall profile with opening cutouts.
 * Shape is in wall-local coords: X = along wall length, Y = up.
 * Origin at wall center (centered on length and height).
 */
function buildWallShape(wall, openings) {
  const s = MM_TO_M;
  const len = wall.length_mm;
  const hLeft = wall.height_mm;
  const halfLen = len / 2;
  const profile = wall.profile || 'standard';

  const shape = new THREE.Shape();

  if (profile === 'raked') {
    const hRight = wall.height_right_mm || hLeft;
    // Bottom-left → bottom-right → top-right → top-left
    shape.moveTo(-halfLen * s, (-hLeft / 2) * s);
    shape.lineTo(halfLen * s, (-hLeft / 2) * s);
    shape.lineTo(halfLen * s, (-hLeft / 2 + hRight) * s);
    shape.lineTo(-halfLen * s, (hLeft / 2) * s);
    shape.closePath();
  } else if (profile === 'gable') {
    const peakH = wall.peak_height_mm || hLeft;
    const peakX = (wall.peak_position_mm ?? len / 2);
    const peakLocalX = (peakX - halfLen) * s;
    const baseY = (-hLeft / 2) * s;
    // Bottom-left → bottom-right → top-right → peak → top-left
    shape.moveTo(-halfLen * s, baseY);
    shape.lineTo(halfLen * s, baseY);
    shape.lineTo(halfLen * s, (hLeft / 2) * s);
    shape.lineTo(peakLocalX, (-hLeft / 2 + peakH) * s);
    shape.lineTo(-halfLen * s, (hLeft / 2) * s);
    shape.closePath();
  } else {
    // Standard rectangular
    shape.moveTo(-halfLen * s, (-hLeft / 2) * s);
    shape.lineTo(halfLen * s, (-hLeft / 2) * s);
    shape.lineTo(halfLen * s, (hLeft / 2) * s);
    shape.lineTo(-halfLen * s, (hLeft / 2) * s);
    shape.closePath();
  }

  // Cut openings as holes
  if (openings) {
    for (const op of openings) {
      const ox = (op.x - halfLen) * s;
      const oy = (op.y - hLeft / 2) * s;
      const ow = op.drawWidth * s;
      const oh = op.drawHeight * s;
      const hole = new THREE.Path();
      hole.moveTo(ox, oy);
      hole.lineTo(ox + ow, oy);
      hole.lineTo(ox + ow, oy + oh);
      hole.lineTo(ox, oy + oh);
      hole.closePath();
      shape.holes.push(hole);
    }
  }

  return shape;
}

/**
 * Single wall mesh with profile geometry and opening cutouts.
 */
function WallMesh({ entry, layout, isSelected, onSelect, showWireframe }) {
  const { position, rotation, dimensions } = entry;
  const wall = entry.wall;
  const s = MM_TO_M;
  const thick = dimensions.thickness * s;

  const wallColor = WALL_COLORS[entry.side] || COLORS.PANEL;

  const geometry = useMemo(() => {
    const shape = buildWallShape(wall, layout?.openings);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thick,
      bevelEnabled: false,
    });
    // Center on Z axis (extrude goes 0 → depth, we want -depth/2 → depth/2)
    geo.translate(0, 0, -thick / 2);
    return geo;
  }, [wall, layout?.openings, thick]);

  // Compute max height for label positioning
  const maxH = wall.profile === 'gable'
    ? (wall.peak_height_mm || wall.height_mm) * s
    : wall.profile === 'raked'
    ? Math.max(wall.height_mm, wall.height_right_mm || wall.height_mm) * s
    : wall.height_mm * s;

  return (
    <group
      position={[position.x * s, position.y * s, position.z * s]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      onClick={(e) => { e.stopPropagation(); onSelect(entry.wall.id); }}
    >
      {/* Main wall body */}
      <mesh castShadow geometry={geometry}>
        <meshStandardMaterial
          color={wallColor}
          transparent
          opacity={isSelected ? 0.85 : 0.7}
          emissive={isSelected ? SELECTED_EMISSIVE : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wall wireframe outline */}
      {showWireframe && (
        <mesh geometry={geometry}>
          <meshBasicMaterial color="#333" wireframe />
        </mesh>
      )}

      {/* Wall label — billboard so it always faces camera */}
      <Billboard position={[0, maxH / 2 + 0.15, 0]}>
        <Text
          fontSize={0.15}
          color="#333"
          anchorX="center"
          anchorY="bottom"
        >
          {wall.name || entry.side}
        </Text>
        <Text
          fontSize={0.09}
          color="#888"
          anchorX="center"
          anchorY="top"
          position={[0, -0.02, 0]}
        >
          {(wall.length_mm / 1000).toFixed(1)}m
        </Text>
      </Billboard>
    </group>
  );
}

const GRID_SNAP_M = 0.1; // 100mm grid snap
const SNAP_THRESHOLD_M = 0.4; // 400mm — magnetic snap distance
const snapToGrid = (v) => Math.round(v / GRID_SNAP_M) * GRID_SNAP_M;

/**
 * Compute world-space XZ position of a wall endpoint.
 */
function getEndpointWorld(wall, end, posX, posZ, angleRad) {
  const ep = computeWallEndpoint(wall, end);
  return {
    x: posX + ep.localX_mm * MM_TO_M * Math.cos(angleRad),
    z: posZ - ep.localX_mm * MM_TO_M * Math.sin(angleRad),
  };
}

/**
 * Round angle (radians) to nearest 90° and return degrees (0, 90, 180, 270).
 */
function roundToNearest90(rad) {
  const deg = ((rad * 180 / Math.PI) % 360 + 360) % 360;
  return Math.round(deg / 90) * 90 % 360;
}

/**
 * Semi-transparent ghost wall that follows the cursor during placement mode.
 */
function GhostWall({ wall, position, rotationY }) {
  const h = wall.height_mm * MM_TO_M;
  const thick = WALL_THICKNESS * MM_TO_M;

  const geometry = useMemo(() => {
    const shape = buildWallShape(wall, null);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thick,
      bevelEnabled: false,
    });
    geo.translate(0, 0, -thick / 2);
    return geo;
  }, [wall, thick]);

  return (
    <group
      position={[position[0], h / 2, position[2]]}
      rotation={[0, rotationY, 0]}
    >
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#4a90d9"
          transparent
          opacity={0.4}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#2C5F8A" wireframe />
      </mesh>
      <Billboard position={[0, h / 2 + 0.15, 0]}>
        <Text
          fontSize={0.15}
          color="#2C5F8A"
          anchorX="center"
          anchorY="bottom"
        >
          {wall.name}
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * Green sphere + ring indicating an active snap point during placement.
 */
function SnapIndicator({ position }) {
  return (
    <group position={[position.x, 0.05, position.z]}>
      <Sphere args={[0.1, 16, 16]}>
        <meshStandardMaterial color="#22cc44" emissive="#22cc44" emissiveIntensity={0.6} />
      </Sphere>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.2, 32]} />
        <meshBasicMaterial color="#22cc44" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/**
 * Invisible ground plane for raycasting mouse position during placement.
 */
function PlacementGroundPlane({ onPointerMove, onClick }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      onPointerMove={onPointerMove}
      onClick={onClick}
      visible={false}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial />
    </mesh>
  );
}

const PROFILE_LABELS = { standard: 'Std', raked: 'Raked', gable: 'Gable' };

/**
 * Sidebar catalog listing all walls with placed/unplaced status.
 */
function WallCatalogSidebar({ walls, placedWallIds, onPlace, onRemove, selectedWallId, onSelectWall }) {
  const placedSet = useMemo(() => new Set(placedWallIds), [placedWallIds]);

  return (
    <div style={styles.sidebar}>
      <div style={styles.sidebarHeader}>
        <span style={styles.sidebarTitle}>Walls</span>
        <span style={styles.sidebarCount}>
          {placedWallIds.length}/{walls.length} placed
        </span>
      </div>
      <div style={styles.sidebarList}>
        {walls.map(wall => {
          const isPlaced = placedSet.has(wall.id);
          const isSelected = wall.id === selectedWallId;
          return (
            <div
              key={wall.id}
              style={{
                ...styles.catalogItem,
                ...(isPlaced ? styles.catalogItemPlaced : {}),
                ...(isSelected ? styles.catalogItemSelected : {}),
              }}
              onClick={() => onSelectWall(wall.id)}
            >
              <div style={styles.catalogItemTop}>
                <span style={{
                  ...styles.catalogName,
                  ...(isPlaced ? styles.catalogNamePlaced : {}),
                }}>
                  {isPlaced ? '\u2713 ' : ''}{wall.name}
                </span>
                <span style={styles.catalogProfile}>
                  {PROFILE_LABELS[wall.profile] || 'Std'}
                </span>
              </div>
              <div style={styles.catalogDims}>
                {(wall.length_mm / 1000).toFixed(1)}m x {(wall.height_mm / 1000).toFixed(1)}m
                {wall.openings?.length > 0 && (
                  <span style={styles.catalogOpenings}>
                    {wall.openings.length} opening{wall.openings.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={styles.catalogActions}>
                {isPlaced ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(wall.id); }}
                    style={styles.catalogRemoveBtn}
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPlace(wall.id); }}
                    style={styles.catalogPlaceBtn}
                  >
                    Place
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
export default function ModelViewer3D({
  walls, connections = [], onConnectionsChange,
  placedWallIds = [], onPlacementsChange,
  wallPositions = {}, onWallPositionsChange,
}) {
  const [showWireframe, setShowWireframe] = useState(false);
  const [selectedWallId, setSelectedWallId] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);
  const [placingWallId, setPlacingWallId] = useState(null);
  const [movingWallId, setMovingWallId] = useState(null);
  const [ghostPos, setGhostPos] = useState([0, 0, 0]);
  const [ghostRotation, setGhostRotation] = useState(0);
  const [snapInfo, setSnapInfo] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const cameraControlsRef = useRef(null);
  const activeWallId = placingWallId || movingWallId;
  const activeWall = activeWallId ? walls.find(w => w.id === activeWallId) : null;

  const placedWalls = useMemo(
    () => {
      const placedSet = new Set(placedWallIds);
      return walls.filter(w => placedSet.has(w.id));
    },
    [walls, placedWallIds]
  );

  const floorPlan = useMemo(() => {
    if (placedWalls.length === 0) return [];
    // Filter out the wall currently being moved — it shows as ghost instead
    const wallsToRender = movingWallId
      ? placedWalls.filter(w => w.id !== movingWallId)
      : placedWalls;
    const plan = computeFloorPlanFromConnections(wallsToRender, connections);
    // Apply manual positions for standalone walls (no connections)
    for (const entry of plan) {
      const pos = wallPositions[entry.wall.id];
      if (pos) {
        const isConnected = connections.some(
          c => c.wallId === entry.wall.id || c.attachedWallId === entry.wall.id
        );
        if (!isConnected) {
          entry.position = { x: pos.x, y: entry.wall.height_mm / 2, z: pos.z };
          entry.rotation = { x: 0, y: pos.rotationY || 0, z: 0 };
        }
      }
    }
    return plan;
  }, [placedWalls, connections, wallPositions, movingWallId]);

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

  const handleCameraPreset = useCallback((presetKey) => {
    const ctrl = cameraControlsRef.current;
    if (!ctrl) return;
    const preset = CAMERA_PRESETS[presetKey];
    if (!preset) return;
    const d = Math.max(sceneBounds.width, sceneBounds.depth, sceneBounds.maxHeight) * MM_TO_M * 1.5;
    const [px, py, pz] = preset.pos;
    ctrl.setLookAt(px * d, py * d, pz * d, 0, 0, 0, true);
  }, [sceneBounds]);

  // Undo/redo: snapshot current state before mutations
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), {
      placedWallIds: [...placedWallIds],
      connections: [...connections],
      wallPositions: { ...wallPositions },
    }]);
    setRedoStack([]);
  }, [placedWallIds, connections, wallPositions]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, {
      placedWallIds: [...placedWallIds],
      connections: [...connections],
      wallPositions: { ...wallPositions },
    }]);
    setUndoStack(s => s.slice(0, -1));
    if (onPlacementsChange) onPlacementsChange(prev.placedWallIds);
    if (onConnectionsChange) onConnectionsChange(prev.connections);
    if (onWallPositionsChange) onWallPositionsChange(prev.wallPositions);
  }, [undoStack, placedWallIds, connections, wallPositions, onPlacementsChange, onConnectionsChange, onWallPositionsChange]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(s => [...s, {
      placedWallIds: [...placedWallIds],
      connections: [...connections],
      wallPositions: { ...wallPositions },
    }]);
    setRedoStack(r => r.slice(0, -1));
    if (onPlacementsChange) onPlacementsChange(next.placedWallIds);
    if (onConnectionsChange) onConnectionsChange(next.connections);
    if (onWallPositionsChange) onWallPositionsChange(next.wallPositions);
  }, [redoStack, placedWallIds, connections, wallPositions, onPlacementsChange, onConnectionsChange, onWallPositionsChange]);

  const handlePlaceWall = useCallback((wallId) => {
    pushUndo();
    setPlacingWallId(wallId);
    setMovingWallId(null);
    setGhostPos([0, 0, 0]);
    setGhostRotation(0);
    setSelectedWallId(null);
    setSelectedEnd(null);
    if (cameraControlsRef.current) {
      cameraControlsRef.current.enabled = false;
    }
  }, [pushUndo]);

  const handleGhostMove = useCallback((e) => {
    if (!activeWallId) return;
    e.stopPropagation();
    const point = e.point;
    const wall = walls.find(w => w.id === activeWallId);
    if (!wall) return;

    const mouseX = point.x;
    const mouseZ = point.z;

    // Check snap against all placed wall endpoints
    let bestSnap = null;
    let bestDist = SNAP_THRESHOLD_M;

    for (const entry of floorPlan) {
      for (const anchorEnd of ['left', 'right']) {
        // Skip already-connected endpoints
        const alreadyConnected = connections.some(
          c => (c.wallId === entry.wall.id && c.anchorEnd === anchorEnd) ||
               (c.attachedWallId === entry.wall.id && c.attachedEnd === anchorEnd)
        );
        if (alreadyConnected) continue;

        const anchorPt = getEndpointWorld(
          entry.wall, anchorEnd,
          entry.position.x * MM_TO_M, entry.position.z * MM_TO_M,
          entry.rotation.y
        );

        for (const ghostEnd of ['left', 'right']) {
          // Compute where ghost endpoint would be at mouse position
          const ghostPt = getEndpointWorld(wall, ghostEnd, mouseX, mouseZ, ghostRotation);
          const dx = ghostPt.x - anchorPt.x;
          const dz = ghostPt.z - anchorPt.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist < bestDist) {
            bestDist = dist;
            bestSnap = {
              anchorEntry: entry,
              anchorEnd,
              ghostEnd,
              snapPoint: anchorPt,
            };
          }
        }
      }
    }

    if (bestSnap) {
      // Use computeSnapPosition for exact placement with thickness offset
      const { anchorEntry, anchorEnd, ghostEnd } = bestSnap;
      const relativeAngle = ghostRotation - anchorEntry.rotation.y;
      const angleDeg = roundToNearest90(relativeAngle);

      const snap = computeSnapPosition(
        anchorEntry.wall, anchorEnd,
        anchorEntry.position, anchorEntry.rotation.y,
        wall, ghostEnd,
        angleDeg
      );

      setGhostPos([snap.position.x * MM_TO_M, 0, snap.position.z * MM_TO_M]);
      setSnapInfo({
        anchorWallId: anchorEntry.wall.id,
        anchorEnd,
        ghostEnd,
        angleDeg,
        snapPoint: bestSnap.snapPoint,
      });
    } else {
      setGhostPos([snapToGrid(mouseX), 0, snapToGrid(mouseZ)]);
      setSnapInfo(null);
    }
  }, [activeWallId, walls, floorPlan, connections, ghostRotation]);

  const handleCommitPlacement = useCallback((e) => {
    if (!activeWallId) return;
    e.stopPropagation();

    // Add to placements if new
    if (placingWallId && onPlacementsChange && !placedWallIds.includes(placingWallId)) {
      onPlacementsChange([...placedWallIds, placingWallId]);
    }

    // Auto-create connection if snapped
    if (snapInfo && onConnectionsChange) {
      const newConnection = {
        id: crypto.randomUUID(),
        wallId: snapInfo.anchorWallId,
        anchorEnd: snapInfo.anchorEnd,
        attachedWallId: activeWallId,
        attachedEnd: snapInfo.ghostEnd,
        angleDeg: snapInfo.angleDeg,
      };
      onConnectionsChange([...connections, newConnection]);
    }

    // Save manual position if no snap (standalone wall)
    if (!snapInfo && onWallPositionsChange) {
      const newPositions = { ...wallPositions };
      newPositions[activeWallId] = {
        x: ghostPos[0] / MM_TO_M,
        z: ghostPos[2] / MM_TO_M,
        rotationY: ghostRotation,
      };
      onWallPositionsChange(newPositions);
    }

    setPlacingWallId(null);
    setMovingWallId(null);
    setSnapInfo(null);
    if (cameraControlsRef.current) {
      cameraControlsRef.current.enabled = true;
    }
  }, [activeWallId, placingWallId, placedWallIds, onPlacementsChange, snapInfo, connections, onConnectionsChange, wallPositions, onWallPositionsChange, ghostPos, ghostRotation]);

  const handleCancelPlacement = useCallback(() => {
    setPlacingWallId(null);
    setMovingWallId(null);
    setSnapInfo(null);
    // Revert undo since action was cancelled
    if (undoStack.length > 0) {
      const prev = undoStack[undoStack.length - 1];
      setUndoStack(s => s.slice(0, -1));
      if (onPlacementsChange) onPlacementsChange(prev.placedWallIds);
      if (onConnectionsChange) onConnectionsChange(prev.connections);
      if (onWallPositionsChange) onWallPositionsChange(prev.wallPositions);
    }
    if (cameraControlsRef.current) {
      cameraControlsRef.current.enabled = true;
    }
  }, [undoStack, onPlacementsChange, onConnectionsChange, onWallPositionsChange]);

  const handleRemoveWall = useCallback((wallId) => {
    if (onPlacementsChange) {
      onPlacementsChange(placedWallIds.filter(id => id !== wallId));
    }
    // Also remove connections involving this wall
    if (onConnectionsChange) {
      const filtered = connections.filter(
        c => c.wallId !== wallId && c.attachedWallId !== wallId
      );
      if (filtered.length !== connections.length) {
        onConnectionsChange(filtered);
      }
    }
    if (selectedWallId === wallId) {
      setSelectedWallId(null);
      setSelectedEnd(null);
    }
  }, [placedWallIds, onPlacementsChange, connections, onConnectionsChange, selectedWallId]);

  const handleMoveWall = useCallback((wallId) => {
    pushUndo();
    const entry = floorPlan.find(e => e.wall.id === wallId);
    // Disconnect the wall before moving
    if (onConnectionsChange) {
      const filtered = connections.filter(
        c => c.wallId !== wallId && c.attachedWallId !== wallId
      );
      if (filtered.length !== connections.length) {
        onConnectionsChange(filtered);
      }
    }
    setMovingWallId(wallId);
    setPlacingWallId(null);
    setGhostRotation(entry ? entry.rotation.y : 0);
    setGhostPos(entry
      ? [entry.position.x * MM_TO_M, 0, entry.position.z * MM_TO_M]
      : [0, 0, 0]
    );
    setSelectedWallId(null);
    setSelectedEnd(null);
    if (cameraControlsRef.current) {
      cameraControlsRef.current.enabled = false;
    }
  }, [pushUndo, floorPlan, connections, onConnectionsChange]);

  const handleRotateSelected = useCallback(() => {
    if (!selectedWallId) return;
    const isConnected = connections.some(
      c => c.wallId === selectedWallId || c.attachedWallId === selectedWallId
    );
    if (isConnected) return; // Can't rotate connected walls directly
    pushUndo();
    const pos = wallPositions[selectedWallId];
    const currentRot = pos?.rotationY || 0;
    const newPositions = { ...wallPositions };
    newPositions[selectedWallId] = {
      x: pos?.x || 0,
      z: pos?.z || 0,
      rotationY: (currentRot + Math.PI / 2) % (Math.PI * 2),
    };
    if (onWallPositionsChange) onWallPositionsChange(newPositions);
  }, [selectedWallId, connections, wallPositions, onWallPositionsChange, pushUndo]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedWallId) return;
    pushUndo();
    handleRemoveWall(selectedWallId);
  }, [selectedWallId, pushUndo, handleRemoveWall]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!activeWallId && !selectedWallId) return;
    const handleKeyDown = (e) => {
      if (activeWallId) {
        // Placement/move mode
        if (e.key === 'r' || e.key === 'R') {
          setGhostRotation(prev => (prev + Math.PI / 2) % (Math.PI * 2));
        } else if (e.key === 'Escape') {
          handleCancelPlacement();
        }
      } else if (selectedWallId) {
        // Selection mode
        if (e.key === 'r' || e.key === 'R') {
          handleRotateSelected();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          handleDeleteSelected();
        } else if (e.key === 'm' || e.key === 'M') {
          handleMoveWall(selectedWallId);
        } else if (e.key === 'Escape') {
          setSelectedWallId(null);
          setSelectedEnd(null);
        } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if (
          (e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
          (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)
        ) {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWallId, selectedWallId, handleCancelPlacement, handleRotateSelected, handleDeleteSelected, handleMoveWall, handleUndo, handleRedo]);

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
      <div style={styles.viewerBody}>
        <WallCatalogSidebar
          walls={walls}
          placedWallIds={placedWallIds}
          onPlace={handlePlaceWall}
          onRemove={handleRemoveWall}
          selectedWallId={selectedWallId}
          onSelectWall={handleSelectWall}
        />
      <div style={styles.canvasWrap}>
        <Canvas shadows onClick={() => { setSelectedWallId(null); setSelectedEnd(null); }}>
          <PerspectiveCamera
            makeDefault
            position={[camDist * 0.8, camDist * 0.6, camDist * 0.8]}
            fov={50}
          />
          <CameraControls
            ref={cameraControlsRef}
            minDistance={camDist * 0.3}
            maxDistance={camDist * 3}
            maxPolarAngle={Math.PI * 0.47}
            smoothTime={0.25}
            draggingSmoothTime={0.1}
          />

          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
          <directionalLight position={[-5, 10, -5]} intensity={0.3} />
          <Environment preset="city" background={false} />

          {/* Floor — contact shadows + grid */}
          <ContactShadows
            position={[0, -0.01, 0]}
            opacity={0.35}
            scale={Math.max(sceneBounds.width, sceneBounds.depth) * MM_TO_M + 4}
            blur={2}
            far={sceneBounds.maxHeight * MM_TO_M + 1}
          />
          <Grid
            args={[50, 50]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#d0d0d0"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#aaa"
            fadeDistance={camDist * 2}
            fadeStrength={1.5}
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

          {/* Placement/move mode: ground plane for raycasting + ghost preview */}
          {activeWall && (
            <>
              <PlacementGroundPlane
                onPointerMove={handleGhostMove}
                onClick={handleCommitPlacement}
              />
              <GhostWall
                wall={activeWall}
                position={ghostPos}
                rotationY={ghostRotation}
              />
              {snapInfo && (
                <SnapIndicator position={snapInfo.snapPoint} />
              )}
            </>
          )}

          {/* Axes helper */}
          <axesHelper args={[2]} />
        </Canvas>

        {/* Camera preset toolbar */}
        <div style={styles.cameraToolbar}>
          {Object.entries(CAMERA_PRESETS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => handleCameraPreset(key)}
              style={styles.cameraBtn}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Placement/move mode indicator */}
        {activeWall && (
          <div style={styles.placementBanner}>
            <span>
              {movingWallId ? 'Moving' : 'Placing'}: <strong>{activeWall.name}</strong>
              {' \u2022 '}
              {Math.round(ghostRotation * 180 / Math.PI)}°
              {snapInfo && (
                <span style={styles.snapBadge}>SNAP</span>
              )}
            </span>
            <span style={styles.placementHints}>
              Click to place &bull; R to rotate &bull; Esc to cancel
            </span>
            <button onClick={handleCancelPlacement} style={styles.placementCancelBtn}>
              Cancel
            </button>
          </div>
        )}

        {/* Selected wall actions */}
        {selectedWall && !activeWallId && (
          <div style={styles.selectionToolbar}>
            <span style={styles.selectionLabel}>{selectedWall.name}</span>
            <button onClick={() => handleMoveWall(selectedWallId)} style={styles.actionToolbarBtn}>
              Move (M)
            </button>
            <button onClick={handleRotateSelected} style={styles.actionToolbarBtn}>
              Rotate (R)
            </button>
            <button onClick={handleDeleteSelected} style={styles.actionToolbarBtnDanger}>
              Delete
            </button>
            {undoStack.length > 0 && (
              <button onClick={handleUndo} style={styles.actionToolbarBtn}>Undo</button>
            )}
          </div>
        )}

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
      </div>
      <div style={styles.legend}>
        <span style={styles.legendHint}>Click &quot;Place&quot; in the sidebar to position a wall. Click a placed wall to select it.</span>
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
  viewerBody: {
    display: 'flex',
    height: 500,
  },
  canvasWrap: {
    flex: 1,
    height: '100%',
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
  cameraToolbar: {
    position: 'absolute',
    bottom: 10,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 4,
    background: 'rgba(255,255,255,0.9)',
    borderRadius: 6,
    padding: '4px 6px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
    zIndex: 10,
  },
  cameraBtn: {
    padding: '5px 10px',
    background: 'none',
    border: '1px solid #ddd',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    color: '#555',
  },
  placementBanner: {
    position: 'absolute',
    top: 10,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: 'rgba(44,95,138,0.95)',
    color: '#fff',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    zIndex: 10,
    whiteSpace: 'nowrap',
  },
  placementHints: {
    fontSize: 11,
    opacity: 0.8,
  },
  snapBadge: {
    marginLeft: 8,
    padding: '2px 6px',
    background: '#22cc44',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  placementCancelBtn: {
    padding: '4px 10px',
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  },

  selectionToolbar: {
    position: 'absolute',
    top: 10,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.95)',
    borderRadius: 6,
    padding: '6px 12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    zIndex: 10,
    whiteSpace: 'nowrap',
  },
  selectionLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1a1a1a',
    marginRight: 4,
  },
  actionToolbarBtn: {
    padding: '4px 10px',
    background: '#f0f2f5',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  },
  actionToolbarBtnDanger: {
    padding: '4px 10px',
    background: '#fff5f5',
    color: '#e74c3c',
    border: '1px solid #fdd',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
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

  // Sidebar
  sidebar: {
    width: 220,
    borderRight: '1px solid #eee',
    background: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderBottom: '1px solid #eee',
  },
  sidebarTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#333',
  },
  sidebarCount: {
    fontSize: 11,
    color: '#888',
  },
  sidebarList: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px',
  },
  catalogItem: {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid transparent',
    cursor: 'pointer',
    marginBottom: 4,
    background: '#fff',
    transition: 'border-color 0.15s',
  },
  catalogItemPlaced: {
    background: '#f0f5f0',
    opacity: 0.75,
  },
  catalogItemSelected: {
    borderColor: '#2C5F8A',
    background: '#eef3fa',
    opacity: 1,
  },
  catalogItemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catalogName: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  catalogNamePlaced: {
    color: '#666',
  },
  catalogProfile: {
    fontSize: 10,
    padding: '1px 5px',
    background: '#f0f2f5',
    borderRadius: 3,
    color: '#666',
  },
  catalogDims: {
    fontSize: 11,
    color: '#888',
    marginTop: 3,
  },
  catalogOpenings: {
    marginLeft: 6,
    color: '#999',
  },
  catalogActions: {
    marginTop: 5,
  },
  catalogPlaceBtn: {
    padding: '3px 10px',
    background: '#2C5F8A',
    color: '#fff',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 600,
  },
  catalogRemoveBtn: {
    padding: '3px 10px',
    background: '#fff',
    color: '#999',
    border: '1px solid #ddd',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 500,
  },
};
