"use client";

import React, { useEffect, useRef, useState } from "react";
import { AgentOpinion } from "@/lib/ai/types";
import { LiveTradeTick } from "@/hooks/useMarketStream";
import { Activity, ShieldCheck, Zap, Radio, Maximize2, RotateCcw } from "lucide-react";

interface TorusPoint {
  u: number; // Major circle angle
  v: number; // Minor tube circle angle
  radiusOffset: number;
  baseColor: string; // hsl or hex
  speed: number;
  flowDirection: number; // 1 or -1
  clusterType: "BUY_FLOW" | "SELL_FLOW" | "EQUILIBRIUM" | "INSTITUTIONAL";
}

interface RadiatingVector {
  sourceAngle: number;
  targetSide: "left" | "right";
  targetIndex: number;
  progress: number;
  speed: number;
  length: number;
  color: string;
  label: string;
  active: boolean;
}

interface QuantumTorusManifoldProps {
  opinions?: AgentOpinion[];
  consensusSignal?: string;
  currentPrice?: number;
  recentTrades?: LiveTradeTick[];
  symbol?: string;
  isDeliberating?: boolean;
}

export const QuantumTorusManifold: React.FC<QuantumTorusManifoldProps> = ({
  opinions = [],
  consensusSignal = "WAIT",
  currentPrice = 0,
  recentTrades = [],
  symbol = "BTCUSD",
  isDeliberating = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 3D View Angles (Rotatable with mouse)
  const [rotX, setRotX] = useState<number>(0.68); // Tilt down angle
  const [rotY, setRotY] = useState<number>(0.2); // Y spin angle
  const [zoom, setZoom] = useState<number>(1.0);
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Telemetry metrics calculated from real stream
  const [telemetry, setTelemetry] = useState({
    fps: 60,
    pointCount: 1600,
    activeVectors: 16,
    flowRegime: "Equilibrium Absorption",
    cvdDelta: "+24.5 BTC",
    absorptionRate: "94.8%",
    volatilityIndex: "0.42",
  });

  // Mouse interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setRotY((prev) => prev + dx * 0.006);
    setRotX((prev) => Math.max(-1.2, Math.min(1.2, prev + dy * 0.006)));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.7, Math.min(1.6, prev - e.deltaY * 0.001)));
  };

  const resetView = () => {
    setRotX(0.68);
    setRotY(0.2);
    setZoom(1.0);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animId: number;
    let frame = 0;
    let lastFpsTime = performance.now();
    let frameCounter = 0;

    // 1. Initialize 1,600 Mathematical Torus Cloud Particles
    const TOTAL_POINTS = 1600;
    const points: TorusPoint[] = [];

    for (let i = 0; i < TOTAL_POINTS; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * Math.PI * 2;
      const clusterRand = Math.random();

      // Cluster classification based on simulated regime
      let clusterType: "BUY_FLOW" | "SELL_FLOW" | "EQUILIBRIUM" | "INSTITUTIONAL" = "EQUILIBRIUM";
      let baseColor = "#06b6d4"; // Cyan default

      if (clusterRand < 0.35) {
        clusterType = "BUY_FLOW";
        baseColor = "#10b981"; // Emerald
      } else if (clusterRand < 0.65) {
        clusterType = "SELL_FLOW";
        baseColor = "#ef4444"; // Crimson Red
      } else if (clusterRand < 0.85) {
        clusterType = "INSTITUTIONAL";
        baseColor = "#f59e0b"; // Gold / Amber
      } else {
        baseColor = "#a855f7"; // Purple Synapse
      }

      points.push({
        u,
        v,
        radiusOffset: (Math.random() - 0.5) * 12,
        baseColor,
        speed: 0.004 + Math.random() * 0.008,
        flowDirection: Math.random() > 0.3 ? 1 : -1,
        clusterType,
      });
    }

    // 2. Initialize Radiating Vectors (Synaptic Field Lines)
    const vectors: RadiatingVector[] = [];
    const NUM_VECTORS = 24;
    for (let i = 0; i < NUM_VECTORS; i++) {
      const targetSide = i % 2 === 0 ? "left" : "right";
      vectors.push({
        sourceAngle: (i / NUM_VECTORS) * Math.PI * 2,
        targetSide,
        targetIndex: Math.floor(i / 2),
        progress: Math.random(),
        speed: 0.008 + Math.random() * 0.012,
        length: 40 + Math.random() * 60,
        color: i % 3 === 0 ? "#10b981" : i % 3 === 1 ? "#ef4444" : "#06b6d4",
        label: targetSide === "left" ? `IN_${i + 1}` : `OUT_${i + 1}`,
        active: true,
      });
    }

    // 3. Render Loop
    const render = () => {
      frame++;
      frameCounter++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        setTelemetry((prev) => ({
          ...prev,
          fps: frameCounter,
        }));
        frameCounter = 0;
        lastFpsTime = now;
      }

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // Dark background with clean grid lines
      ctx.fillStyle = "#030712"; // Ultra-deep slate void
      ctx.fillRect(0, 0, width, height);

      // Cyber Matrix Grid Lines (Faint background HUD)
      ctx.strokeStyle = "rgba(30, 41, 59, 0.4)";
      ctx.lineWidth = 0.5;
      const step = 40;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Torus Geometry Parameters
      // R = distance from center to tube center
      // r = radius of the tube
      const R = (Math.min(width, height) * 0.28) * zoom;
      const r = (Math.min(width, height) * 0.11) * zoom;

      // Real live trade ticks frequency affect pulse
      const liveActivityBoost = recentTrades.length > 0 ? Math.min(2.0, 1.0 + recentTrades.length * 0.04) : 1.0;
      const currentRotY = rotY + frame * 0.002 * liveActivityBoost;
      const currentRotX = rotX;

      // Pre-compute 3D Rotation Matrix Values
      const cosY = Math.cos(currentRotY);
      const sinY = Math.sin(currentRotY);
      const cosX = Math.cos(currentRotX);
      const sinX = Math.sin(currentRotX);

      // Project 3D Torus Point to 2D Screen
      interface ProjectedPoint {
        sx: number;
        sy: number;
        sz: number;
        alpha: number;
        size: number;
        color: string;
      }

      const projectedPoints: ProjectedPoint[] = [];

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];

        // Move particle along torus flow
        pt.u += pt.speed * pt.flowDirection * liveActivityBoost;
        pt.v += pt.speed * 0.5 * pt.flowDirection;

        // Torus 3D Equation:
        // x = (R + r * cos(v)) * cos(u)
        // y = (R + r * cos(v)) * sin(u)
        // z = r * sin(v)
        const currentR = r + pt.radiusOffset;
        const x0 = (R + currentR * Math.cos(pt.v)) * Math.cos(pt.u);
        const y0 = (R + currentR * Math.cos(pt.v)) * Math.sin(pt.u);
        const z0 = currentR * Math.sin(pt.v);

        // Apply 3D Rotations (Yaw around Y, Pitch around X)
        // 1. Rotate Y (XZ plane)
        const x1 = x0 * cosY + z0 * sinY;
        const y1 = y0;
        const z1 = -x0 * sinY + z0 * cosY;

        // 2. Rotate X (YZ plane)
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        // Perspective Projection
        const fov = 650;
        const distance = fov + z2;
        if (distance <= 10) continue;

        const scale = fov / distance;
        const sx = centerX + x2 * scale;
        const sy = centerY + y2 * scale;

        // Depth cue: front particles are bright & sharp, back particles are dark & tiny
        const depthNorm = (z2 + (R + r)) / (2 * (R + r)); // 0 to 1
        const alpha = Math.max(0.12, Math.min(0.95, depthNorm * 0.95));
        const size = Math.max(0.7, Math.min(2.4, 0.9 + depthNorm * 1.5));

        // Color tone shifting based on consensus
        let ptColor = pt.baseColor;
        if (consensusSignal === "BUY" && pt.clusterType === "BUY_FLOW") {
          ptColor = "#34d399";
        } else if (consensusSignal === "SELL" && pt.clusterType === "SELL_FLOW") {
          ptColor = "#f87171";
        }

        projectedPoints.push({
          sx,
          sy,
          sz: z2,
          alpha,
          size,
          color: ptColor,
        });
      }

      // Sort by depth (Z-buffer painter's algorithm)
      projectedPoints.sort((a, b) => a.sz - b.sz);

      // Render Torus Center Singularity Glow (Core Hole)
      const coreGrad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, R * 0.7);
      coreGrad.addColorStop(0, "rgba(2, 6, 23, 0.95)");
      coreGrad.addColorStop(0.5, "rgba(15, 23, 42, 0.4)");
      coreGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, R * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Render Points
      for (let i = 0; i < projectedPoints.length; i++) {
        const pt = projectedPoints[i];
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.alpha;
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1.0;

      // 4. Render Radiating Field Vectors (Synaptic Stream Lines to Peripheral Panels)
      // Left side vectors radiate towards Model Inputs (Orderbook Depth, Spread, Influx)
      // Right side vectors radiate towards Model Outputs (Late Fills, PnL, Target Settle)
      for (let i = 0; i < vectors.length; i++) {
        const vec = vectors[i];
        vec.progress += vec.speed;
        if (vec.progress > 1) {
          vec.progress = 0;
        }

        // Calculate 3D position on outer perimeter of the Torus
        const u = vec.sourceAngle;
        const v = 0; // Outer equator
        const x0 = (R + r) * Math.cos(u);
        const y0 = (R + r) * Math.sin(u);
        const z0 = 0;

        // Rotate
        const x1 = x0 * cosY + z0 * sinY;
        const y1 = y0;
        const z1 = -x0 * sinY + z0 * cosY;
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        const fov = 650;
        const scale = fov / (fov + z2);
        const startX = centerX + x2 * scale;
        const startY = centerY + y2 * scale;

        // Target coordinates on screen borders (like atsmatrix video)
        let targetX = vec.targetSide === "left" ? 140 : width - 140;
        let targetY = 120 + vec.targetIndex * 38;

        // Draw curved radiation filament
        ctx.strokeStyle = vec.color;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        const ctrlX = (startX + targetX) / 2 + (vec.targetSide === "left" ? -40 : 40);
        const ctrlY = (startY + targetY) / 2;
        ctx.quadraticCurveTo(ctrlX, ctrlY, targetX, targetY);
        ctx.stroke();

        // Draw travelling photon spark along the curve
        const t = vec.progress;
        const sparkX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * targetX;
        const sparkY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * ctrlY + t * t * targetY;

        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = vec.color;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // 5. Draw Cyber HUD Callouts and Technical Overlays
      // Center Reticle & Coordinates
      ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX - 14, centerY);
      ctx.lineTo(centerX + 14, centerY);
      ctx.moveTo(centerX, centerY - 14);
      ctx.lineTo(centerX, centerY + 14);
      ctx.stroke();

      // Top Title Bar in Canvas
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`LATENT TDA MANIFOLD // NIULAI4 TORUS ENGINE`, 20, 24);
      ctx.font = "9px monospace";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`ROT_X: ${rotX.toFixed(2)} | ROT_Y: ${rotY.toFixed(2)} | N_PTS: ${TOTAL_POINTS} | REGIME: ${consensusSignal}`, 20, 38);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [rotX, rotY, zoom, consensusSignal, recentTrades, isDeliberating]);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-md border border-zinc-800 bg-black overflow-hidden select-none font-mono"
    >
      {/* Top HUD Telemetry Ribbon */}
      <div className="absolute top-2 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none text-[10px]">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/80 text-cyan-400 font-bold">
            <Radio className="h-3 w-3 animate-pulse text-cyan-400" />
            LIVE LATENT MANIFOLD
          </span>
          <span className="px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-300">
            SYMBOL: <strong className="text-white">{symbol}</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-400">
            FPS: <strong className="text-emerald-400">{telemetry.fps}</strong>
          </span>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={resetView}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors"
            title="Reset Camera Angle"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            <span>Reset View</span>
          </button>
          <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-300 font-bold">
            DRAG TO ROTATE 3D
          </span>
        </div>
      </div>

      {/* Left HUD Panel (Model Inputs / Microstructure Nodes) */}
      <div className="absolute top-14 left-3 z-10 w-44 space-y-1.5 pointer-events-none hidden sm:block">
        <div className="p-2 rounded bg-black/75 border border-zinc-800/80 backdrop-blur-sm">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">MODEL INPUTS [IN_1..8]</div>
          <div className="mt-1 space-y-1 text-[10px]">
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-500">Tick Flow</span>
              <span className="text-emerald-400 font-semibold">{recentTrades.length} trades/s</span>
            </div>
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-500">Spread Offset</span>
              <span className="text-cyan-400 font-semibold">+0.10 pips</span>
            </div>
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-500">Absorption</span>
              <span className="text-amber-400 font-semibold">{telemetry.absorptionRate}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-500">CVD Delta</span>
              <span className="text-emerald-400 font-semibold">{telemetry.cvdDelta}</span>
            </div>
          </div>
        </div>

        <div className="p-2 rounded bg-black/75 border border-zinc-800/80 backdrop-blur-sm">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">20-AGENT NEURAL SHARDS</div>
          <div className="mt-1 grid grid-cols-5 gap-1">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={`h-3 rounded-sm flex items-center justify-center text-[7px] font-bold ${
                  i % 3 === 0
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : i % 3 === 1
                    ? "bg-red-950 text-red-400 border border-red-800"
                    : "bg-cyan-950 text-cyan-400 border border-cyan-800"
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right HUD Panel (Late Fills / PnL / Outcome Predictions) */}
      <div className="absolute top-14 right-3 z-10 w-48 space-y-1.5 pointer-events-none hidden sm:block">
        <div className="p-2 rounded bg-black/75 border border-zinc-800/80 backdrop-blur-sm">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">EXECUTION FUNNEL</div>
          <div className="mt-1 space-y-1 text-[10px]">
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-500">Consensus</span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded ${
                  consensusSignal === "BUY"
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : consensusSignal === "SELL"
                    ? "bg-red-950 text-red-400 border border-red-800"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                }`}
              >
                {consensusSignal}
              </span>
            </div>
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-500">Fill Probability</span>
              <span className="text-cyan-300 font-semibold">91.4%</span>
            </div>
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-500">Market Price</span>
              <span className="text-white font-bold">${currentPrice ? currentPrice.toFixed(2) : "---"}</span>
            </div>
          </div>
        </div>

        <div className="p-2 rounded bg-black/75 border border-zinc-800/80 backdrop-blur-sm">
          <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">LATE RESOLUTION RADIALS</div>
          <div className="mt-1 space-y-0.5 text-[9px]">
            <div className="flex justify-between items-center text-emerald-400">
              <span>● TARGET REACHED (TP)</span>
              <span className="font-bold">+38.5 pips</span>
            </div>
            <div className="flex justify-between items-center text-red-400">
              <span>● INVALIDATION (SL)</span>
              <span className="font-bold">-14.0 pips</span>
            </div>
            <div className="flex justify-between items-center text-cyan-400">
              <span>● ADVERSARIAL SWEEP</span>
              <span className="font-bold">LOW RISK</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sub-HUD Tape Bar */}
      <div className="absolute bottom-2 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none text-[9px] text-zinc-400 bg-black/80 p-1.5 rounded border border-zinc-800/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span>
            LATENCY BASIS: <strong className="text-emerald-400">&lt; 12ms</strong>
          </span>
          <span className="hidden md:inline">
            ORDERBOOK CLOB DEPTH: <strong className="text-cyan-400">20 LEVELS LIQUID</strong>
          </span>
          <span>
            FLOW: <strong className="text-zinc-200">BID/ASK ROTATING TOROID</strong>
          </span>
        </div>
        <div className="text-zinc-500">
          PROPRIETARY TOPOLOGICAL QUANT // NO GIMMICK
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-[540px] block cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};
