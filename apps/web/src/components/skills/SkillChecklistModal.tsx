"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Plus, Trash2, CheckCircle, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
  const [selectedPreview, setSelectedPreview] = useState<TradingSkill | null>(null);
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
      const list = data.skills || [];
      setSkills(list);
      if (list.length > 0 && !selectedPreview) {
        setSelectedPreview(list[0]);
      }
    } catch (error) {
      console.error("Failed to fetch skills:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
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
    setNewSkill((prev) => ({
      ...prev,
      rules: [...prev.rules, { id: `rule_${Date.now()}`, text: "", required: true }],
    }));
  };

  const removeRule = (id: string) => {
    setNewSkill((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== id),
    }));
  };

  const updateRule = (id: string, text: string) => {
    setNewSkill((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === id ? { ...r, text } : r)),
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl border-neutral-800 bg-[#0A0A0A] p-6 shadow-2xl">
        <DialogHeader className="border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/20">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold tracking-wide text-neutral-100 uppercase">
                Quantitative Trading Strategies &amp; Rules
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-400">
                Enforce institutional execution rules from the strategy library
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-12 pt-2 h-[480px]">
          {/* List of Skills (5 cols) */}
          <div className="md:col-span-5 flex flex-col h-full border-r border-neutral-800 pr-4 overflow-hidden">
            <div className="flex items-center justify-between pb-3">
              <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-400">
                Active Library ({skills.length})
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreating(!isCreating)}
                className="h-7 text-[11px] px-2.5 border-neutral-800 bg-black hover:border-neutral-700"
              >
                <Plus className="mr-1 h-3 w-3 text-[#00FF66]" />
                {isCreating ? "Back" : "New Strategy"}
              </Button>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {skills.map((skill) => {
                const isSelected = selectedPreview?.id === skill.id;
                return (
                  <div
                    key={skill.id}
                    onClick={() => {
                      setSelectedPreview(skill);
                      setIsCreating(false);
                    }}
                    className={`cursor-pointer rounded-lg border p-3 transition text-left ${
                      isSelected
                        ? "border-[#00FF66]/50 bg-[#00FF66]/5 text-neutral-100"
                        : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-neutral-100">{skill.title}</div>
                      <Badge variant="electric" className="text-[10px]">
                        RR 1:{skill.risk_reward_min}
                      </Badge>
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-neutral-400">
                      {skill.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Skill Detail / Creation Form (7 cols) */}
          <div className="md:col-span-7 flex flex-col h-full overflow-y-auto pl-1">
            {isCreating ? (
              <form onSubmit={handleCreateSkill} className="space-y-3.5">
                <div className="space-y-1">
                  <Label htmlFor="skill-title">Strategy Title</Label>
                  <Input
                    id="skill-title"
                    value={newSkill.title}
                    onChange={(e) => setNewSkill({ ...newSkill, title: e.target.value })}
                    placeholder="e.g., Gold Liquidity Sweep & Breakeven"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="skill-desc">Description &amp; Logic</Label>
                  <Input
                    id="skill-desc"
                    value={newSkill.description}
                    onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                    placeholder="Overview of strategy execution mechanics"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="skill-rr">Min. Risk-to-Reward Ratio (1 : X)</Label>
                  <Input
                    id="skill-rr"
                    type="number"
                    step="0.1"
                    value={newSkill.riskRewardMin}
                    onChange={(e) => setNewSkill({ ...newSkill, riskRewardMin: parseFloat(e.target.value) || 2.0 })}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Mandatory Rules Checklist</Label>
                    <button
                      type="button"
                      onClick={addRule}
                      className="text-[11px] font-mono text-[#00FF66] hover:underline"
                    >
                      + Add Rule
                    </button>
                  </div>
                  {newSkill.rules.map((rule, idx) => (
                    <div key={rule.id} className="flex items-center gap-2">
                      <Input
                        value={rule.text}
                        onChange={(e) => updateRule(rule.id, e.target.value)}
                        placeholder={`Rule ${idx + 1}`}
                        className="text-xs"
                        required
                      />
                      {newSkill.rules.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRule(rule.id)}
                          className="h-8 w-8 text-neutral-500 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="electric" disabled={loading} className="w-full">
                    Save New Strategy
                  </Button>
                </div>
              </form>
            ) : selectedPreview ? (
              <div className="flex flex-col justify-between h-full space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-neutral-100">{selectedPreview.title}</h3>
                      <Badge variant="electric">R:R ≥ 1:{selectedPreview.risk_reward_min}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                      {selectedPreview.description}
                    </p>
                  </div>

                  <div className="rounded-lg border border-neutral-800 bg-black p-3.5 space-y-2">
                    <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-400">
                      Execution Rules ({selectedPreview.rules_checklist.length} Conditions)
                    </span>
                    <div className="space-y-2 pt-1">
                      {selectedPreview.rules_checklist.map((rule, idx) => (
                        <div key={rule.id || idx} className="flex items-start gap-2 text-xs text-neutral-300">
                          <CheckCircle className="h-3.5 w-3.5 text-[#00FF66] mt-0.5 shrink-0" />
                          <div className="leading-snug">
                            <span>{rule.text}</span>
                            {rule.required && (
                              <span className="ml-1 text-[10px] text-[#00FF66] font-mono font-bold">[MANDATORY]</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="electric"
                    onClick={() => {
                      if (onSkillSelect && selectedPreview) {
                        onSkillSelect(selectedPreview);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <span>Load Strategy to Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-neutral-500 font-mono">
                Select a strategy from the left panel
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
