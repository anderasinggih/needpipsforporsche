"use client";

import React, { useEffect, useRef } from "react";
import { AgentOpinion } from "@/lib/ai/types";

interface SynapticNode {
  id: string;
  name: string;
  role: string;
  model: string;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  weight: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulsePhase: number;
}

interface SynapticEdge {
  source: number;
  target: number;
  strength: number;
  activePulse: number; // 0 to 1 progress of travelling signal photon
}

interface NeuralSynapseCanvasProps {
  opinions: AgentOpinion[];
  consensusSignal?: string;
  isDeliberating?: boolean;
}

export const NeuralSynapseCanvas: React.FC<NeuralSynapseCanvasProps> = ({
  opinions,
  consensusSignal = "WAIT",
  isDeliberating = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const width = canvas.width;
    const height = canvas.height;

    // Build real nodes from actual agent opinions (or fallback to the 20 Council profiles)
    const nodeCount = Math.max(opinions.length, 20);
    const nodes: SynapticNode[] = [];

    // Distribute nodes organically in a neural cluster topology
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < nodeCount; i++) {
      const op = opinions[i];
      const angle = (i / nodeCount) * Math.PI * 2 + (Math.random() * 0.2 - 0.1);
      const dist = 90 + Math.random() * (Math.min(width, height) * 0.38);

      const x = centerX + Math.cos(angle) * dist;
      const y = centerY + Math.sin(angle) * dist;

      const bias = op?.bias || (i % 3 === 0 ? "BULLISH" : i % 3 === 1 ? "BEARISH" : "NEUTRAL");
      const conf = op?.confidence || Math.floor(60 + Math.random() * 35);
      const weight = op?.voteWeight || 1;

      nodes.push({
        id: op?.agentId || `node_${i + 1}`,
        name: op?.agentName || `Agent Synapse ${i + 1}`,
        role: op?.role || "Market Microstructure Shard",
        model: op?.modelUsed || "gpt-4o / claude / deepseek",
        bias,
        confidence: conf,
        weight,
        x,
        y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: 6 + (conf / 100) * 8,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Build synaptic connection graph (interconnecting correlated nodes & central hub)
    const edges: SynapticEdge[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);

        // Connect if close enough, or if they share identical bias (synaptic alignment)
        const sameBias = nodes[i].bias === nodes[j].bias;
        const maxDist = sameBias ? 240 : 160;

        if (d < maxDist) {
          edges.push({
            source: i,
            target: j,
            strength: Math.max(0.2, 1 - d / maxDist),
            activePulse: Math.random(),
          });
        }
      }
    }

    let frame = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      // Deep dark cyber background grid
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, width, height);

      // Draw faint neural mesh grid
      ctx.strokeStyle = "rgba(39, 39, 42, 0.25)";
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

      // Physics float & boundary damping
      for (const node of nodes) {
        node.x += node.vx * (isDeliberating ? 1.8 : 1);
        node.y += node.vy * (isDeliberating ? 1.8 : 1);

        if (node.x < 30 || node.x > width - 30) node.vx *= -1;
        if (node.y < 30 || node.y > height - 30) node.vy *= -1;

        node.pulsePhase += isDeliberating ? 0.08 : 0.03;
      }

      // 1. Draw Organic Neural Cables / Axon Fiber Bundles
      for (const edge of edges) {
        const n1 = nodes[edge.source];
        const n2 = nodes[edge.target];

        // Advance travelling electrical action potential (axon pulse)
        edge.activePulse = (edge.activePulse + (isDeliberating ? 0.022 : 0.007)) % 1;

        const isBullishSynapse = n1.bias === "BULLISH" && n2.bias === "BULLISH";
        const isBearishSynapse = n1.bias === "BEARISH" && n2.bias === "BEARISH";

        // Cable midpoint with natural physical sag/curvature (catenary/bezier flex)
        const mx = (n1.x + n2.x) / 2;
        const my = (n1.y + n2.y) / 2;
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Perpendicular offset for organic cable slack
        const perpX = -dy / (dist || 1);
        const perpY = dx / (dist || 1);
        const cableSag = Math.sin((edge.source + edge.target) * 1.5) * (dist * 0.12);
        const ctrlX = mx + perpX * cableSag;
        const ctrlY = my + perpY * cableSag;

        // Base Cable Sheath (Outer insulation fiber)
        ctx.strokeStyle = "rgba(24, 24, 27, 0.75)";
        ctx.lineWidth = Math.max(1.8, edge.strength * 3.2);
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, n2.x, n2.y);
        ctx.stroke();

        // Inner Core Conductor Line (Glowing active myelin cable)
        const coreStroke = isBullishSynapse
          ? `rgba(16, 185, 129, ${0.35 + edge.strength * 0.3})`
          : isBearishSynapse
          ? `rgba(239, 68, 68, ${0.35 + edge.strength * 0.3})`
          : `rgba(161, 161, 170, ${0.2 + edge.strength * 0.25})`;

        ctx.strokeStyle = coreStroke;
        ctx.lineWidth = Math.max(0.7, edge.strength * 1.2);
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, n2.x, n2.y);
        ctx.stroke();

        // High-Definition Action Potential (Travelling Electrical Pulse Spark)
        const t = edge.activePulse;
        // Bezier position at t: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        const pulseX = (1 - t) * (1 - t) * n1.x + 2 * (1 - t) * t * ctrlX + t * t * n2.x;
        const pulseY = (1 - t) * (1 - t) * n1.y + 2 * (1 - t) * t * ctrlY + t * t * n2.y;

        // Electric spark outer coronal discharge
        const sparkGlow = ctx.createRadialGradient(pulseX, pulseY, 0.5, pulseX, pulseY, 7);
        const sparkHex = isBullishSynapse ? "#34D399" : isBearishSynapse ? "#F87171" : "#E4E4E7";
        sparkGlow.addColorStop(0, sparkHex);
        sparkGlow.addColorStop(0.4, isBullishSynapse ? "rgba(16,185,129,0.5)" : isBearishSynapse ? "rgba(239,68,68,0.5)" : "rgba(228,228,231,0.4)");
        sparkGlow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sparkGlow;
        ctx.beginPath();
        ctx.arc(pulseX, pulseY, 7, 0, Math.PI * 2);
        ctx.fill();

        // Hot electric core bead
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(pulseX, pulseY, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Draw Central Decision Hive Core (Synthesizer SOMA)
      const corePulse = Math.sin(frame * 0.04) * 3;
      const coreRadius = 26 + corePulse;
      const isCoreBull = consensusSignal === "BUY";
      const isCoreBear = consensusSignal === "SELL";

      const coreGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        4,
        centerX,
        centerY,
        coreRadius * 2.2
      );

      const coreColor = isCoreBull ? "#10B981" : isCoreBear ? "#EF4444" : "#E4E4E7";
      coreGradient.addColorStop(0, isCoreBull ? "rgba(16,185,129,0.35)" : isCoreBear ? "rgba(239,68,68,0.35)" : "rgba(161,161,170,0.25)");
      coreGradient.addColorStop(0.6, "rgba(9, 9, 11, 0.6)");
      coreGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Industrial dark membrane hub
      ctx.fillStyle = "#09090B";
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner electric ring
      ctx.strokeStyle = isCoreBull ? "rgba(52,211,153,0.6)" : isCoreBear ? "rgba(248,113,113,0.6)" : "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 0.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(consensusSignal, centerX, centerY);

      // 3. Draw Biological Neuron Bodies (Soma & Synaptic Terminals)
      for (const node of nodes) {
        const pulse = Math.sin(node.pulsePhase) * 1.5;
        const r = node.radius + pulse;

        const isBull = node.bias === "BULLISH";
        const isBear = node.bias === "BEARISH";
        const nodeColor = isBull ? "#10B981" : isBear ? "#EF4444" : "#71717A";

        // Synaptic halo glow
        const glow = ctx.createRadialGradient(node.x, node.y, 1, node.x, node.y, r * 2.4);
        glow.addColorStop(0, isBull ? "rgba(16,185,129,0.45)" : isBear ? "rgba(239,68,68,0.45)" : "rgba(161,161,170,0.25)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 2.4, 0, Math.PI * 2);
        ctx.fill();

        // Metallic/organic node shell
        ctx.fillStyle = "#09090B";
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Action potential firing center
        ctx.fillStyle = isBull ? "#34D399" : isBear ? "#F87171" : "#D4D4D8";
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Node Label
        ctx.font = "9px monospace";
        ctx.fillStyle = "#E4E4E7";
        ctx.textAlign = "center";
        ctx.fillText(node.name.slice(0, 14), node.x, node.y + r + 11);
        ctx.fillStyle = isBull ? "#34D399" : isBear ? "#F87171" : "#A1A1AA";
        ctx.fillText(`${node.bias} ${node.confidence}%`, node.x, node.y + r + 20);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [opinions, consensusSignal, isDeliberating]);

  return (
    <div className="relative w-full rounded-md border border-zinc-800 bg-black overflow-hidden select-none">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-purple-400 animate-ping" />
        <span className="text-[11px] font-mono font-bold text-zinc-300">
          BIOLOGICAL SYNAPSE GRAPH • 20 ACTIVE NEURAL AGENTS
        </span>
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 font-mono text-[10px]">
        <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400">
          ● Bullish Synapse
        </span>
        <span className="px-2 py-0.5 rounded bg-red-950/80 border border-red-800 text-red-400">
          ● Bearish Synapse
        </span>
      </div>

      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className="w-full h-[540px] block"
      />
    </div>
  );
};
