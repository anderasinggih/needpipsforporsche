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

      // 1. Draw Synaptic Axons (Edges)
      for (const edge of edges) {
        const n1 = nodes[edge.source];
        const n2 = nodes[edge.target];

        // Advance travelling electrical action potential (photon)
        edge.activePulse = (edge.activePulse + (isDeliberating ? 0.025 : 0.008)) % 1;

        const isBullishSynapse = n1.bias === "BULLISH" && n2.bias === "BULLISH";
        const isBearishSynapse = n1.bias === "BEARISH" && n2.bias === "BEARISH";

        const strokeColor = isBullishSynapse
          ? `rgba(16, 185, 129, ${0.15 * edge.strength})`
          : isBearishSynapse
          ? `rgba(239, 68, 68, ${0.15 * edge.strength})`
          : `rgba(168, 85, 247, ${0.12 * edge.strength})`;

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.max(0.6, edge.strength * 1.6);
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();

        // Draw travelling electrical photon packet along axon
        const px = n1.x + (n2.x - n1.x) * edge.activePulse;
        const py = n1.y + (n2.y - n1.y) * edge.activePulse;

        ctx.fillStyle = isBullishSynapse
          ? "#34D399"
          : isBearishSynapse
          ? "#F87171"
          : "#C084FC";
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Draw Central Decision Hive Core (Singularity)
      const corePulse = Math.sin(frame * 0.04) * 4;
      const coreRadius = 24 + corePulse;
      const isCoreBull = consensusSignal === "BUY";
      const isCoreBear = consensusSignal === "SELL";

      const coreGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        4,
        centerX,
        centerY,
        coreRadius * 2
      );

      const coreColor = isCoreBull ? "#10B981" : isCoreBear ? "#EF4444" : "#A855F7";
      coreGradient.addColorStop(0, coreColor);
      coreGradient.addColorStop(0.5, "rgba(88, 28, 135, 0.4)");
      coreGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(consensusSignal, centerX, centerY);

      // 3. Draw Synaptic Neuron Nodes
      for (const node of nodes) {
        const pulse = Math.sin(node.pulsePhase) * 2;
        const r = node.radius + pulse;

        const isBull = node.bias === "BULLISH";
        const isBear = node.bias === "BEARISH";
        const nodeColor = isBull ? "#10B981" : isBear ? "#EF4444" : "#71717A";

        // Synaptic halo glow
        const glow = ctx.createRadialGradient(node.x, node.y, 2, node.x, node.y, r * 2.5);
        glow.addColorStop(0, isBull ? "rgba(16,185,129,0.5)" : isBear ? "rgba(239,68,68,0.5)" : "rgba(168,85,247,0.3)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Node Body
        ctx.fillStyle = "#09090B";
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Inner nucleus
        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Node Label
        ctx.font = "9px monospace";
        ctx.fillStyle = "#D4D4D8";
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
