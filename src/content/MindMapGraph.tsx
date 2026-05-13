import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export interface MindMapNode {
  id: string;
  label: string;
  group?: number;
}

export interface MindMapLink {
  source: string;
  target: string;
  label?: string;
}

export interface MindMapData {
  nodes: MindMapNode[];
  links: MindMapLink[];
}

interface MindMapProps {
  data: MindMapData | null;
}

export const MindMapGraph: React.FC<MindMapProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number, y: number }>>({});

  useEffect(() => {
    if (!data || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    // Initialize random positions near center
    const currentPositions: Record<string, { x: number, y: number }> = {};
    const centerX = width / 2;
    const centerY = height / 2;
    
    data.nodes.forEach((node, i) => {
      if (i === 0) {
        currentPositions[node.id] = { x: centerX, y: centerY };
      } else {
        currentPositions[node.id] = {
          x: centerX + (Math.random() - 0.5) * 100,
          y: centerY + (Math.random() - 0.5) * 100
        };
      }
    });

    // Custom lightweight Force-Directed Algorithm
    const iterations = 100;
    const repulsion = 8000;
    const springLength = 120;
    const springForce = 0.05;
    
    for (let iter = 0; iter < iterations; iter++) {
      const forces: Record<string, { x: number, y: number }> = {};
      data.nodes.forEach(n => forces[n.id] = { x: 0, y: 0 });

      // Repulsion between all nodes
      for (let i = 0; i < data.nodes.length; i++) {
        for (let j = i + 1; j < data.nodes.length; j++) {
          const n1 = data.nodes[i];
          const n2 = data.nodes[j];
          const dx = currentPositions[n1.id].x - currentPositions[n2.id].x;
          const dy = currentPositions[n1.id].y - currentPositions[n2.id].y;
          const distSq = dx * dx + dy * dy || 1;
          const force = repulsion / distSq;
          const dist = Math.sqrt(distSq);
          
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          forces[n1.id].x += fx;
          forces[n1.id].y += fy;
          forces[n2.id].x -= fx;
          forces[n2.id].y -= fy;
        }
      }

      // Spring attraction along links
      data.links.forEach(link => {
        if (!currentPositions[link.source] || !currentPositions[link.target]) return;
        const dx = currentPositions[link.target].x - currentPositions[link.source].x;
        const dy = currentPositions[link.target].y - currentPositions[link.source].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - springLength) * springForce;
        
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        
        forces[link.source].x += fx;
        forces[link.source].y += fy;
        forces[link.target].x -= fx;
        forces[link.target].y -= fy;
      });

      // Apply forces and pull slightly to center to avoid drifting off screen
      data.nodes.forEach((node, i) => {
        if (i === 0) return; // Keep root locked in center
        
        // Gravity towards center
        const dx = centerX - currentPositions[node.id].x;
        const dy = centerY - currentPositions[node.id].y;
        forces[node.id].x += dx * 0.01;
        forces[node.id].y += dy * 0.01;

        currentPositions[node.id].x += forces[node.id].x;
        currentPositions[node.id].y += forces[node.id].y;
      });
    }

    setPositions(currentPositions);
  }, [data]);

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 h-full">
        <div className="w-16 h-16 border-4 border-neutral-800 border-t-red-500 rounded-full animate-spin mb-4"></div>
        <p>Waiting for Brain Scan...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-neutral-950 overflow-hidden rounded-xl border border-neutral-800">
      {/* Draw Links (SVG) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        {data.links.map((link, i) => {
          const source = positions[link.source];
          const target = positions[link.target];
          if (!source || !target) return null;
          return (
            <motion.line
              key={i}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="rgba(239, 68, 68, 0.2)"
              strokeWidth="2"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1, delay: i * 0.1 }}
            />
          );
        })}
      </svg>

      {/* Draw Nodes */}
      {data.nodes.map((node, i) => {
        const pos = positions[node.id];
        if (!pos) return null;
        
        const isRoot = i === 0;

        return (
          <motion.div
            key={node.id}
            className={`absolute flex items-center justify-center p-3 rounded-xl shadow-lg z-10 cursor-pointer backdrop-blur-md ${isRoot ? 'bg-red-600 border-red-500 text-white font-bold scale-110 shadow-red-900/50' : 'bg-neutral-900/90 border border-neutral-700 text-neutral-200 hover:border-red-500 hover:text-white'}`}
            style={{ 
              left: pos.x, 
              top: pos.y,
              transform: 'translate(-50%, -50%)'
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: i * 0.05 }}
            drag
            dragMomentum={false}
            onDrag={(e, info) => {
              setPositions(prev => ({
                ...prev,
                [node.id]: { x: prev[node.id].x + info.delta.x, y: prev[node.id].y + info.delta.y }
              }));
            }}
          >
            <span className="text-xs text-center max-w-[120px] font-semibold">{node.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
};
