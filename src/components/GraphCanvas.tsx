import { useMemo, useRef, useState } from 'react';
import { clampViewportZoom } from '../lib/layout';
import type { EdgeAnchor, GraphEdge, GraphNode, PersistedViewerState, ViewMode, ViewportState } from '../types/ontology';

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  hiddenEdgeCount: number;
  visualState: PersistedViewerState;
  activeViewMode: ViewMode;
  hiddenClasses: Array<{ id: string; label: string }>;
  selectedClassId: string | null;
  onSelectClass: (classId: string) => void;
  onMoveNode: (classId: string, position: { x: number; y: number }) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  onLayoutChange: (patch: Partial<PersistedViewerState['layoutSettings']>) => void;
  onUpdateNodeState: (classId: string, patch: Partial<PersistedViewerState['nodeStates'][string]>) => void;
  onUpdateEdgeState: (edgeId: string, patch: Partial<PersistedViewerState['edgeStates'][string]>) => void;
  onHideClass: (classId: string) => void;
  onHideBranch: (classId: string) => void;
  onRestoreClass: (classId: string) => void;
  onRestoreAllHidden: () => void;
  onViewportChange: (viewport: ViewportState) => void;
}

const NODE_WIDTH = 176;
const NODE_BASE_HEIGHT = 78;
const PROPERTY_LINE_HEIGHT = 16;
const PROPERTY_SECTION_PADDING = 32;
const MAX_VISIBLE_PROPERTIES = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getExpandedLineCount(node: GraphNode): number {
  if (!node.expanded) {
    return 0;
  }

  const visibleCount = Math.min(node.dataProperties.length, MAX_VISIBLE_PROPERTIES);
  const overflowCount = node.dataProperties.length > MAX_VISIBLE_PROPERTIES ? 1 : 0;
  return Math.max(1, visibleCount + overflowCount);
}

function getNodeHeight(node: GraphNode): number {
  return NODE_BASE_HEIGHT + (node.expanded ? PROPERTY_SECTION_PADDING + getExpandedLineCount(node) * PROPERTY_LINE_HEIGHT : 0);
}

function resolveAnchorPoint(node: GraphNode, anchor: EdgeAnchor): { x: number; y: number } {
  return {
    x: node.x + NODE_WIDTH * anchor.xRatio,
    y: node.y + getNodeHeight(node) * anchor.yRatio,
  };
}

function edgePath(start: { x: number; y: number }, end: { x: number; y: number }): string {
  const direction = end.x >= start.x ? 1 : -1;
  const delta = Math.max(56, Math.abs(end.x - start.x) * 0.45);
  return `M ${start.x} ${start.y} C ${start.x + delta * direction} ${start.y}, ${end.x - delta * direction} ${end.y}, ${end.x} ${end.y}`;
}

function toBoundaryAnchor(localX: number, localY: number, width: number, height: number): EdgeAnchor {
  const clampedX = clamp(localX, 0, width);
  const clampedY = clamp(localY, 0, height);
  const distances = [clampedY, width - clampedX, height - clampedY, clampedX];
  const nearest = distances.indexOf(Math.min(...distances));

  if (nearest === 0) {
    return { xRatio: clampedX / width, yRatio: 0 };
  }
  if (nearest === 1) {
    return { xRatio: 1, yRatio: clampedY / height };
  }
  if (nearest === 2) {
    return { xRatio: clampedX / width, yRatio: 1 };
  }
  return { xRatio: 0, yRatio: clampedY / height };
}

function getGraphPoint(svg: SVGSVGElement, clientX: number, clientY: number, viewport: ViewportState): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    return null;
  }

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const local = point.matrixTransform(ctm.inverse());

  return {
    x: (local.x - viewport.x) / viewport.zoom,
    y: (local.y - viewport.y) / viewport.zoom,
  };
}

export function GraphCanvas({
  nodes,
  edges,
  hiddenEdgeCount,
  visualState,
  activeViewMode,
  hiddenClasses,
  selectedClassId,
  onSelectClass,
  onMoveNode,
  onViewModeChange,
  onLayoutChange,
  onUpdateNodeState,
  onUpdateEdgeState,
  onHideClass,
  onHideBranch,
  onRestoreClass,
  onRestoreAllHidden,
  onViewportChange,
}: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [interactionMode, setInteractionMode] = useState<'navigate' | 'edge-edit'>('navigate');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [graphHeight, setGraphHeight] = useState(720);
  const [showObjectProperties, setShowObjectProperties] = useState(true);
  const [showDataProperties, setShowDataProperties] = useState(true);
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const viewport = visualState.viewport;
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const viewportTransform = `translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`;
  const renderedEdges = useMemo(
    () => edges
      .filter((edge) => showObjectProperties || edge.type !== 'object-property')
      .map((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) {
          return null;
        }

        const start = resolveAnchorPoint(source, edge.sourceAnchor);
        const end = resolveAnchorPoint(target, edge.targetAnchor);
        return {
          ...edge,
          sourceNode: source,
          targetNode: target,
          start,
          end,
          path: edgePath(start, end),
          labelX: (start.x + end.x) / 2,
          labelY: (start.y + end.y) / 2,
        };
      })
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null),
    [edges, nodeMap, showObjectProperties],
  );
  const selectedNode = selectedClassId ? nodeMap.get(selectedClassId) || null : null;
  const selectedEdge = selectedEdgeId ? renderedEdges.find((edge) => edge.id === selectedEdgeId) || null : null;

  return (
    <section className="graph-panel panel">
      <div className="graph-controls-shell">
        <div className="graph-controls-head">
          <div>
            <h2>Visualization</h2>
          </div>
          <div className="graph-tablist" role="tablist" aria-label="Visualization modes">
            <button className={activeViewMode === 'graph' ? 'is-active' : ''} onClick={() => onViewModeChange('graph')}>
              Interactive Graph
            </button>
            <button className={activeViewMode === 'hierarchy' ? 'is-active' : ''} onClick={() => onViewModeChange('hierarchy')}>
              Class Hierarchy
            </button>
            <button className={activeViewMode === 'grouped' ? 'is-active' : ''} onClick={() => onViewModeChange('grouped')}>
              Grouped View
            </button>
          </div>
        </div>

        <div className="graph-controls-grid">
          <label className="graph-check">
            <input type="checkbox" checked readOnly />
            <span>Classes</span>
          </label>
          <label className="graph-slider">
            <span>Graph Height</span>
            <input type="range" min="560" max="980" value={graphHeight} onChange={(event) => setGraphHeight(Number(event.target.value))} />
            <strong>{graphHeight}</strong>
          </label>
          <label className="graph-check">
            <input type="checkbox" checked={showObjectProperties} onChange={(event) => setShowObjectProperties(event.target.checked)} />
            <span>Obj Props</span>
          </label>
          <label className="graph-slider">
            <span>Node Spacing</span>
            <input
              type="range"
              min="90"
              max="220"
              value={visualState.layoutSettings.nodeGap}
              onChange={(event) => onLayoutChange({ nodeGap: Number(event.target.value) })}
            />
            <strong>{visualState.layoutSettings.nodeGap}</strong>
          </label>
          <label className="graph-check">
            <input type="checkbox" checked={showDataProperties} onChange={(event) => setShowDataProperties(event.target.checked)} />
            <span>Data Props</span>
          </label>
          <label className="graph-check graph-check--muted">
            <input type="checkbox" checked={interactionMode === 'edge-edit'} onChange={(event) => setInteractionMode(event.target.checked ? 'edge-edit' : 'navigate')} />
            <span>Arrow Edit Mode</span>
          </label>
          <label className="graph-check graph-check--muted">
            <input type="checkbox" checked={isMaximized} onChange={(event) => setIsMaximized(event.target.checked)} />
            <span>Maximize</span>
          </label>
          <div className="graph-controls-actions">
            {hiddenClasses.length > 0 ? (
              <button className="button button--quiet" onClick={onRestoreAllHidden}>
                Restore Hidden ({hiddenClasses.length})
              </button>
            ) : null}
            <button className="button button--primary graph-render-button" onClick={() => onViewportChange({ x: 0, y: 0, zoom: 1 })}>
              Render Graph
            </button>
          </div>
        </div>

        <button className="graph-filter-toggle" onClick={() => setShowHiddenPanel((current) => !current)}>
          <span>{showHiddenPanel ? 'Hide Filters' : 'Filter Classes'}</span>
          <strong>{hiddenClasses.length} hidden classes{hiddenEdgeCount > 0 ? ` · ${hiddenEdgeCount} dense edges hidden` : ''}</strong>
        </button>
      </div>
      {showHiddenPanel && hiddenClasses.length > 0 ? (
        <div className="graph-hidden-strip">
          {hiddenClasses.map((entry) => (
            <button key={entry.id} className="button button--quiet graph-hidden-chip" onClick={() => onRestoreClass(entry.id)}>
              Show {entry.label}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className={[
          'graph-stage',
          interactionMode === 'edge-edit' ? 'is-edge-editing' : '',
          isMaximized ? 'is-maximized' : '',
        ].filter(Boolean).join(' ')}
        style={{ minHeight: `${graphHeight}px` }}
        onWheel={(event) => {
          event.preventDefault();
          const nextZoom = clampViewportZoom(viewport.zoom * (event.deltaY > 0 ? 0.92 : 1.08));
          onViewportChange({ ...viewport, zoom: nextZoom });
        }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 1600 1100"
          className="graph-svg"
          style={{ height: `${graphHeight}px` }}
          onPointerDown={(event) => {
            if (interactionMode === 'edge-edit') {
              if (event.target === event.currentTarget) {
                setSelectedEdgeId(null);
              }
              return;
            }

            if (event.target !== event.currentTarget) {
              return;
            }

            const startX = event.clientX;
            const startY = event.clientY;
            const origin = { ...viewport };
            const pointerId = event.pointerId;
            const target = event.currentTarget;

            target.setPointerCapture(pointerId);

            const handleMove = (moveEvent: PointerEvent) => {
              onViewportChange({
                ...origin,
                x: origin.x + moveEvent.clientX - startX,
                y: origin.y + moveEvent.clientY - startY,
              });
            };

            const handleUp = () => {
              target.releasePointerCapture(pointerId);
              target.removeEventListener('pointermove', handleMove);
              target.removeEventListener('pointerup', handleUp);
            };

            target.addEventListener('pointermove', handleMove);
            target.addEventListener('pointerup', handleUp);
          }}
        >
          <defs>
            <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
              <path d="M 0 0 L 12 6 L 0 12 z" fill="#7d8f96" />
            </marker>
          </defs>

          <g transform={viewportTransform}>
            {renderedEdges.map((edge) => {
              const isSelected = edge.id === selectedEdgeId;
              return (
                <g
                  key={edge.id}
                  className={isSelected ? `graph-edge graph-edge--${edge.type} is-selected` : `graph-edge graph-edge--${edge.type}`}
                  onClick={(event) => {
                    if (interactionMode !== 'edge-edit') {
                      return;
                    }
                    event.stopPropagation();
                    setSelectedEdgeId(edge.id);
                  }}
                >
                  <path d={edge.path} markerEnd="url(#arrow)" />
                  {edge.label ? (
                    <text x={edge.labelX + 10} y={edge.labelY - 8}>
                      {edge.label}
                    </text>
                  ) : null}
                  {interactionMode === 'edge-edit' && isSelected ? (
                    <>
                      <circle
                        className="graph-edge-handle"
                        cx={edge.start.x}
                        cy={edge.start.y}
                        r="8"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          const target = event.currentTarget;
                          const pointerId = event.pointerId;
                          target.setPointerCapture(pointerId);

                          const handleMove = (moveEvent: PointerEvent) => {
                            if (!svgRef.current) {
                              return;
                            }
                            const point = getGraphPoint(svgRef.current, moveEvent.clientX, moveEvent.clientY, viewport);
                            if (!point) {
                              return;
                            }
                            const anchor = toBoundaryAnchor(
                              point.x - edge.sourceNode.x,
                              point.y - edge.sourceNode.y,
                              NODE_WIDTH,
                              getNodeHeight(edge.sourceNode),
                            );
                            onUpdateEdgeState(edge.id, { sourceAnchor: anchor });
                          };

                          const handleUp = () => {
                            target.releasePointerCapture(pointerId);
                            target.removeEventListener('pointermove', handleMove);
                            target.removeEventListener('pointerup', handleUp);
                          };

                          target.addEventListener('pointermove', handleMove);
                          target.addEventListener('pointerup', handleUp);
                        }}
                      />
                      <circle
                        className="graph-edge-handle"
                        cx={edge.end.x}
                        cy={edge.end.y}
                        r="8"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          const target = event.currentTarget;
                          const pointerId = event.pointerId;
                          target.setPointerCapture(pointerId);

                          const handleMove = (moveEvent: PointerEvent) => {
                            if (!svgRef.current) {
                              return;
                            }
                            const point = getGraphPoint(svgRef.current, moveEvent.clientX, moveEvent.clientY, viewport);
                            if (!point) {
                              return;
                            }
                            const anchor = toBoundaryAnchor(
                              point.x - edge.targetNode.x,
                              point.y - edge.targetNode.y,
                              NODE_WIDTH,
                              getNodeHeight(edge.targetNode),
                            );
                            onUpdateEdgeState(edge.id, { targetAnchor: anchor });
                          };

                          const handleUp = () => {
                            target.releasePointerCapture(pointerId);
                            target.removeEventListener('pointermove', handleMove);
                            target.removeEventListener('pointerup', handleUp);
                          };

                          target.addEventListener('pointermove', handleMove);
                          target.addEventListener('pointerup', handleUp);
                        }}
                      />
                    </>
                  ) : null}
                </g>
              );
            })}

            {nodes.map((node) => {
              const isSelected = node.id === selectedClassId;
              const nodeHeight = getNodeHeight(node);
              const visibleProperties = node.expanded && showDataProperties ? node.dataProperties.slice(0, MAX_VISIBLE_PROPERTIES) : [];
              const overflowPropertyCount = Math.max(0, node.dataProperties.length - visibleProperties.length);

              return (
                <g
                  key={node.id}
                  className={isSelected ? 'graph-node is-selected' : 'graph-node'}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => onSelectClass(node.id)}
                  onPointerDown={(event) => {
                    if (interactionMode === 'edge-edit') {
                      event.stopPropagation();
                      onSelectClass(node.id);
                      return;
                    }

                    event.stopPropagation();
                    const startX = event.clientX;
                    const startY = event.clientY;
                    const originX = node.x;
                    const originY = node.y;
                    const pointerId = event.pointerId;
                    const target = event.currentTarget;

                    target.setPointerCapture(pointerId);

                    const handleMove = (moveEvent: PointerEvent) => {
                      onMoveNode(node.id, {
                        x: Math.max(40, originX + (moveEvent.clientX - startX) / viewport.zoom),
                        y: Math.max(40, originY + (moveEvent.clientY - startY) / viewport.zoom),
                      });
                    };

                    const handleUp = () => {
                      target.releasePointerCapture(pointerId);
                      target.removeEventListener('pointermove', handleMove);
                      target.removeEventListener('pointerup', handleUp);
                    };

                    target.addEventListener('pointermove', handleMove);
                    target.addEventListener('pointerup', handleUp);
                  }}
                >
                  <rect width={NODE_WIDTH} height={nodeHeight} rx="24" fill={node.color} opacity={isSelected ? 1 : 0.9} />
                  <text x="20" y="30" className="graph-node__label">
                    {node.label}
                  </text>
                  <text x="20" y="52" className="graph-node__meta">
                    {node.detailMode === 'detail'
                      ? `${node.dataPropertyCount} data · ${node.objectPropertyCount} links · ${node.restrictionCount} rules`
                      : `${node.childIds.length} children`}
                  </text>
                  {node.expanded && showDataProperties ? (
                    <>
                      <line className="graph-node__divider" x1="18" x2={NODE_WIDTH - 18} y1="72" y2="72" />
                      <text x="20" y="92" className="graph-node__meta graph-node__meta--detail">
                        Data properties
                      </text>
                      {visibleProperties.length > 0 ? (
                        visibleProperties.map((property, index) => (
                          <text key={property} x="20" y={110 + index * PROPERTY_LINE_HEIGHT} className="graph-node__property">
                            {property}
                          </text>
                        ))
                      ) : (
                        <text x="20" y="110" className="graph-node__property graph-node__property--muted">
                          No data properties
                        </text>
                      )}
                      {overflowPropertyCount > 0 ? (
                        <text
                          x="20"
                          y={110 + Math.min(node.dataProperties.length, MAX_VISIBLE_PROPERTIES) * PROPERTY_LINE_HEIGHT}
                          className="graph-node__property graph-node__property--muted"
                        >
                          +{overflowPropertyCount} more
                        </text>
                      ) : null}
                    </>
                  ) : null}
                  <text x="20" y={nodeHeight - 14} className="graph-node__meta graph-node__meta--detail">
                    {showDataProperties
                      ? node.expanded
                        ? 'Compact to collapse property list'
                        : 'Expand to inspect data properties'
                      : 'Enable Data Props to inspect property lists'}
                  </text>
                </g>
              );
            })}

            {selectedNode ? (
              <g transform={`translate(${selectedNode.x}, ${Math.max(22, selectedNode.y - 48)})`} className="graph-node-actions">
                {[
                  { label: 'Hide', width: 52, onClick: () => onHideClass(selectedNode.id) },
                  { label: 'Hide Tree', width: 82, onClick: () => onHideBranch(selectedNode.id) },
                  {
                    label: selectedNode.expanded ? 'Compact Props' : 'Expand Props',
                    width: 110,
                    onClick: () => {
                      if (!showDataProperties) {
                        setShowDataProperties(true);
                      }
                      onUpdateNodeState(selectedNode.id, { expanded: !selectedNode.expanded, detailMode: 'detail' });
                    },
                  },
                ].map((action, index) => {
                  const x = index === 0 ? 0 : index === 1 ? 60 : 150;
                  return (
                    <g
                      key={action.label}
                      transform={`translate(${x}, 0)`}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        action.onClick();
                      }}
                    >
                      <rect className="graph-node-actions__button" width={action.width} height="28" rx="14" />
                      <text x={action.width / 2} y="18" textAnchor="middle" className="graph-node-actions__label">
                        {action.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            ) : null}
          </g>
        </svg>

        <div className="graph-legend">
          <span>Zoom {Math.round(visualState.viewport.zoom * 100)}%</span>
          <span>{interactionMode === 'edge-edit' ? 'Click an arrow, then drag its handles' : 'Drag background to pan'}</span>
          <span>{interactionMode === 'edge-edit' ? 'Arrow endpoints snap to node borders' : 'Drag nodes to tune layout'}</span>
        </div>

        {selectedEdge && interactionMode === 'edge-edit' ? (
          <div className="graph-edge-note">
            Editing {selectedEdge.label || selectedEdge.type} between {selectedEdge.sourceNode.label} and {selectedEdge.targetNode.label}
          </div>
        ) : null}
      </div>
    </section>
  );
}