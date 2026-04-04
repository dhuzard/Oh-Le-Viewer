import { useMemo, useRef } from 'react';
import { exportSvgElement, exportSvgElementAsPng } from '../lib/export';
import { clampViewportZoom } from '../lib/layout';
import type { GraphEdge, GraphNode, PersistedViewerState, ViewportState } from '../types/ontology';

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  hiddenEdgeCount: number;
  visualState: PersistedViewerState;
  selectedClassId: string | null;
  onSelectClass: (classId: string) => void;
  onMoveNode: (classId: string, position: { x: number; y: number }) => void;
  onViewportChange: (viewport: ViewportState) => void;
}

const NODE_WIDTH = 176;
const NODE_HEIGHT = 78;

function edgePath(from: GraphNode, to: GraphNode): string {
  const startX = from.x + NODE_WIDTH;
  const startY = from.y + NODE_HEIGHT / 2;
  const endX = to.x;
  const endY = to.y + NODE_HEIGHT / 2;
  const delta = Math.max(60, Math.abs(endX - startX) / 2);
  return `M ${startX} ${startY} C ${startX + delta} ${startY}, ${endX - delta} ${endY}, ${endX} ${endY}`;
}

export function GraphCanvas({ nodes, edges, hiddenEdgeCount, visualState, selectedClassId, onSelectClass, onMoveNode, onViewportChange }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewport = visualState.viewport;
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const viewportTransform = `translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`;

  return (
    <section className="graph-panel panel">
      <div className="panel__header">
        <h2>Graph View</h2>
        <div className="inline-actions">
          <span>{nodes.length} nodes</span>
          {hiddenEdgeCount > 0 ? <span>{hiddenEdgeCount} dense edges hidden</span> : null}
          <button className="button button--quiet" onClick={() => onViewportChange({ x: 0, y: 0, zoom: 1 })}>
            Reset View
          </button>
          <button
            className="button button--quiet"
            onClick={() => {
              if (svgRef.current) {
                void exportSvgElementAsPng(svgRef.current, 'ontology-graph.png');
              }
            }}
          >
            Export PNG
          </button>
          <button className="button button--quiet" onClick={() => svgRef.current && exportSvgElement(svgRef.current, 'ontology-graph.svg')}>
            Export SVG
          </button>
        </div>
      </div>
      <div
        className="graph-stage"
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
          onPointerDown={(event) => {
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
            {edges.map((edge) => {
              const source = nodeMap.get(edge.source);
              const target = nodeMap.get(edge.target);
              if (!source || !target) {
                return null;
              }

              return (
                <g key={edge.id} className={`graph-edge graph-edge--${edge.type}`}>
                  <path d={edgePath(source, target)} markerEnd="url(#arrow)" />
                  {edge.label ? (
                    <text x={(source.x + target.x) / 2 + 90} y={(source.y + target.y) / 2 + 18}>
                      {edge.label}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {nodes.map((node) => {
              const isSelected = node.id === selectedClassId;
              return (
                <g
                  key={node.id}
                  className={isSelected ? 'graph-node is-selected' : 'graph-node'}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => onSelectClass(node.id)}
                  onPointerDown={(event) => {
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
                  <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="24" fill={node.color} opacity={isSelected ? 1 : 0.88} />
                  <text x="20" y="30" className="graph-node__label">
                    {node.label}
                  </text>
                  <text x="20" y="52" className="graph-node__meta">
                    {node.detailMode === 'detail'
                      ? `${node.dataPropertyCount} data · ${node.objectPropertyCount} links · ${node.restrictionCount} rules`
                      : `${node.childIds.length} children`}
                  </text>
                  {node.expanded ? (
                    <text x="20" y="68" className="graph-node__meta graph-node__meta--detail">
                      Expanded properties
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>

        <div className="graph-legend">
          <span>Zoom {Math.round(visualState.viewport.zoom * 100)}%</span>
          <span>Drag background to pan</span>
          <span>Drag nodes to tune layout</span>
        </div>
      </div>
    </section>
  );
}