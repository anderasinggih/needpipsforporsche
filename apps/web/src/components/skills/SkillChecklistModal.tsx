"use client";

import React, { useState, useEffect } from "react";
import { X, ShieldCheck, Plus, Trash2 } from "lucide-react";

export interface Rule {
  id: string;
  text: string;
  required: boolean;
}

export interface TradingSkill {
  id: string;
  title: string;
  description?: string;
  timeframes?: string[];
  rules_checklist: Rule[];
  risk_reward_min: number;
}

interface SkillChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSkillSelect?: (skill: TradingSkill) => void;
}

export const SkillChecklistModal: React.FC<SkillChecklistModalProps> = ({
  isOpen,
  onClose,
  onSkillSelect,
}) => {
  const [skills, setSkills] = useState<TradingSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newSkill, setNewSkill] = useState({
    title: "",
    description: "",
    riskRewardMin: 2.5,
    rules: [{ id: `rule_${Date.now()}`, text: "", required: true }],
  });

  useEffect(() => {
    if (isOpen) {
      fetchSkills();
    }
  }, [isOpen]);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/skills");
      const data = await response.json();
      setSkills(data.skills || []);
    } catch (error) {
      console.error("Failed to fetch skills:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSkill = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSkill.title,
          description: newSkill.description,
          rulesChecklist: newSkill.rules,
          riskRewardMin: newSkill.riskRewardMin,
        }),
      });
      if (response.ok) {
        await fetchSkills();
        setIsCreating(false);
        setNewSkill({
          title: "",
          description: "",
          riskRewardMin: 2.5,
          rules: [{ id: `rule_${Date.now()}`, text: "", required: true }],
        });
      }
    } catch (error) {
      console.error("Failed to create skill:", error);
    } finally {
      setLoading(false);
    }
  };

  const addRule = () => {
    setNewSkill({
      ...newSkill,
      rules: [...newSkill.rules, { id: `rule_${Date.now()}`, text: "", required: true }],
    });
  };

  const removeRule = (id: string) => {
    setNewSkill({
      ...newSkill,
      rules: newSkill.rules.filter((r) => r.id !== id),
    });
  };

  const updateRule = (id: string, text: string) => {
    setNewSkill({
      ...newSkill,
      rules: newSkill.rules.map((r) => (r.id === id ? { ...r, text } : r)),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Trading Skills & Execution Checklist
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition hover:bg-white/5">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-73px)]">
          <div className="w-2/5 border-r border-border/60 overflow-y-auto p-4">
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-bold uppercase tracking-wider text-amber-400 transition hover:bg-amber-500/20"
            >
              <Plus className="h-4 w-4" />
              {isCreating ? "Cancel" : "Create New Skill"}
            </button>

            {skills.map((skill) => (
              <div
                key={skill.id}
                className="mb-2 cursor-pointer rounded-lg border border-border/40 bg-[#0E1018] p-3 transition hover:border-amber-500/40"
                onClick={() => onSkillSelect && onSkillSelect(skill)}
              >
                <div className="text-sm font-semibold text-white">{skill.title}</div>
                <div className="mt-1 text-xs text-slate-400 line-clamp-2">{skill.description}</div>
                <div className="mt-2 text-[10px] uppercase tracking-wider text-amber-400">
                  {skill.rules_checklist.length} Rules • RR≥{skill.risk_reward_min}:1
                </div>
              </div>
            ))}
          </div>

          <div className="w-3/5 overflow-y-auto p-6">
            {isCreating ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-400">Skill Title</label>
                  <input
                    type="text"
                    value={newSkill.title}
                    onChange={(e) => setNewSkill({ ...newSkill, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    placeholder="e.g., XAU/USD Liquidity Sweep & SMC"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-400">Description</label>
                  <textarea
                    value={newSkill.description}
                    onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-400">Min Risk/Reward</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newSkill.riskRewardMin}
                    onChange={(e) => setNewSkill({ ...newSkill, riskRewardMin: parseFloat(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-border bg-[#0E1018] px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider text-slate-400">Execution Rules</label>
                    <button onClick={addRule} className="text-xs text-amber-400 hover:text-amber-300">
                      + Add Rule
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {newSkill.rules.map((rule, idx) => (
                      <div key={rule.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={rule.text}
                          onChange={(e) => updateRule(rule.id, e.target.value)}
                          className="flex-1 rounded-lg border border-border bg-[#0E1018] px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                          placeholder={`Rule ${idx + 1}`}
                        />
                        {newSkill.rules.length > 1 && (
                          <button onClick={() => removeRule(rule.id)} className="rounded p-1.5 hover:bg-red-500/20">
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleCreateSkill}
                  disabled={loading || !newSkill.title}
                  className="w-full rounded-lg bg-emerald-500 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-600"
                >
                  {loading ? "Creating..." : "Save Skill"}
                </button>
              </div>
            ) : (
              <div className="text-center text-sm text-slate-400 mt-12">
                Select a skill or create a new one
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
