import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  FileText, 
  AlertTriangle, 
  BarChart3, 
  Plus, 
  Trash2, 
  Send,
  History,
  Info,
  CheckCircle2,
  ChevronRight,
  Download,
  Layers,
  Activity,
  Search
} from "lucide-react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { generateTraceContent, INTEGRITY_MODES } from "./services/geminiService.js";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function App() {
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState([""]);
  const [mode, setMode] = useState("research_draft");
  const [isGenerating, setIsGenerating] = useState(false);
  const [paragraphs, setParagraphs] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedParagraph, setSelectedParagraph] = useState(null);

  const exportAuditPDF = (para) => {
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 241); // Indigo-500
    doc.text("TraceAI Audit Report", 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${timestamp}`, 20, 28);
    doc.text(`Integrity Mode: ${INTEGRITY_MODES[mode].label}`, 20, 34);

    let yPos = 45;

    if (para) {
      // Single Paragraph Report
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Research Objective:", 20, yPos);
      doc.setFontSize(10);
      doc.setTextColor(60);
      const queryLines = doc.splitTextToSize(query, 170);
      doc.text(queryLines, 20, yPos + 7);
      yPos += 15 + (queryLines.length * 5);

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Generated Content:", 20, yPos);
      doc.setFontSize(11);
      doc.setTextColor(40);
      const contentLines = doc.splitTextToSize(para.text, 170);
      doc.text(contentLines, 20, yPos + 7);
      yPos += 15 + (contentLines.length * 5);

      // Attribution Table
      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Percentage']],
        body: [
          ['Source Influence', `${para.attribution.source_influence_percent}%`],
          ['AI Synthesis', `${para.attribution.ai_synthesis_percent}%`],
          ['User Originality', `${para.attribution.user_originality_percent}%`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] }
      });

      yPos = doc.lastAutoTable.finalY + 15;

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("AI Reasoning:", 20, yPos);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.setFont("helvetica", "italic");
      const reasoningLines = doc.splitTextToSize(para.reasoning, 170);
      doc.text(reasoningLines, 20, yPos + 7);
      
      doc.save(`TraceAI-Audit-${para.id}.pdf`);
    } else {
      // Full Session Report
      doc.setFontSize(14);
      doc.text("Full Session Audit", 20, yPos);
      yPos += 10;

      paragraphs.forEach((p, idx) => {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(12);
        doc.text(`Paragraph #${idx + 1}`, 20, yPos);
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(p.text, 170);
        doc.text(lines, 20, yPos + 7);
        yPos += 15 + (lines.length * 5);
      });

      doc.save(`TraceAI-Full-Audit-${Date.now()}.pdf`);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  const addSource = () => setSources([...sources, ""]);
  const updateSource = (index, value) => {
    const newSources = [...sources];
    newSources[index] = value;
    setSources(newSources);
  };
  const removeSource = (index) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!query.trim()) return;
    setIsGenerating(true);
    try {
      const activeSources = sources.filter(s => s.trim() !== "");
      const result = await generateTraceContent(query, activeSources, mode);
      
      const newPara = {
        id: Math.random().toString(36).substr(2, 9),
        text: result.paragraph,
        attribution: result.attribution_breakdown,
        sources: result.source_references,
        reasoning: result.reasoning,
        quality_score: result.quality_score,
        source_diversity_score: result.source_diversity_score
      };
      
      const updatedParas = [...paragraphs, newPara];
      setParagraphs(updatedParas);
      setSelectedParagraph(newPara);

      // Save to DB
      await fetch("/api/save-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newPara.id,
          query,
          content: result.paragraph,
          attribution: result.attribution_breakdown,
          mode
        })
      });
      fetchHistory();
    } catch (error) {
      console.error(error);
      alert("Generation failed. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  const getRiskLevel = (influence, currentMode) => {
    if (currentMode === "assignment_safe") {
      if (influence < 15) return { level: "safe", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", hex: "#10b981", icon: CheckCircle2 };
      if (influence <= 20) return { level: "medium", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", hex: "#f59e0b", icon: AlertTriangle };
      return { level: "high", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", hex: "#f43f5e", icon: AlertTriangle };
    }
    
    if (currentMode === "research_draft") {
      if (influence < 30) return { level: "safe", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", hex: "#10b981", icon: CheckCircle2 };
      if (influence <= 40) return { level: "medium", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", hex: "#f59e0b", icon: AlertTriangle };
      return { level: "high", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", hex: "#f43f5e", icon: AlertTriangle };
    }

    // Creative mode
    return { level: "creative", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", hex: "#6366f1", icon: Layers };
  };

  const chartData = useMemo(() => {
    if (!selectedParagraph) return [];
    return [
      { name: "Source", value: selectedParagraph.attribution.source_influence_percent, color: "#6366f1" },
      { name: "AI Synthesis", value: selectedParagraph.attribution.ai_synthesis_percent, color: "#a855f7" },
      { name: "Originality", value: selectedParagraph.attribution.user_originality_percent, color: "#10b981" },
    ];
  }, [selectedParagraph]);

  const riskHeatmapData = useMemo(() => {
    return paragraphs.map((p, i) => ({
      name: `P${i+1}`,
      risk: p.attribution.source_influence_percent,
      fill: getRiskLevel(p.attribution.source_influence_percent, mode).hex
    }));
  }, [paragraphs, mode]);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-400 font-sans selection:bg-indigo-500/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 rotate-3">
              <ShieldCheck className="w-5 h-5 text-white -rotate-3" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">Trace<span className="text-indigo-400">AI</span></h1>
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Attribution Honesty</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-widest">
              <a href="#" className="text-white">Dashboard</a>
              <a href="#" className="hover:text-white transition-colors">Audit Logs</a>
              <a href="#" className="hover:text-white transition-colors">Settings</a>
            </nav>
            <div className="h-6 w-px bg-white/10" />
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-white/5 rounded-xl transition-all relative group"
            >
              <History className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {history.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-black" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Input & Editor */}
        <div className="lg:col-span-7 space-y-10">
          {/* Main Input Card */}
          <section className="bg-zinc-900/40 rounded-[2.5rem] border border-white/5 p-8 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Search className="w-4 h-4 text-indigo-400" />
              </div>
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Content Engine</h2>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">
                  Research Objective
                </label>
                <textarea 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Describe what you want to generate with full attribution..."
                  className="w-full bg-black/60 border border-white/10 rounded-2xl p-5 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/40 transition-all min-h-[120px] resize-none text-lg"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                    Source Repository ({sources.filter(s => s.trim()).length})
                  </label>
                  <button 
                    onClick={addSource}
                    className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
                  >
                    + Add Reference
                  </button>
                </div>
                <div className="space-y-3">
                  {sources.map((src, idx) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={idx} 
                      className="flex gap-3 group"
                    >
                      <div className="flex-1 relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-600">
                          0{idx + 1}
                        </div>
                        <input 
                          value={src}
                          onChange={(e) => updateSource(idx, e.target.value)}
                          placeholder="URL, DOI, or text snippet..."
                          className="w-full bg-black/60 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/40 transition-all"
                        />
                      </div>
                      <button 
                        onClick={() => removeSource(idx)}
                        className="p-3 text-zinc-700 hover:text-rose-500 hover:bg-rose-500/5 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-white/5">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="relative group">
                    <select 
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                      className="appearance-none bg-black/60 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-xs font-bold text-zinc-400 focus:outline-none focus:border-indigo-500/40 cursor-pointer uppercase tracking-widest"
                    >
                      {Object.entries(INTEGRITY_MODES).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                    <ChevronRight className="w-4 h-4 text-zinc-600 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                  </div>
                  <div className="hidden xl:block text-[10px] text-zinc-600 font-medium max-w-[180px] leading-relaxed">
                    {INTEGRITY_MODES[mode].description}
                  </div>
                </div>
                
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating || !query.trim()}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-3.5 rounded-2xl font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                >
                  {isGenerating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Synthesize
                </button>
              </div>
            </div>
          </section>

          {/* Content Feed */}
          <div className="space-y-8">
            <AnimatePresence mode="popLayout">
              {paragraphs.map((para, idx) => {
                const risk = getRiskLevel(para.attribution.source_influence_percent, mode);
                const isSelected = selectedParagraph?.id === para.id;
                
                return (
                  <motion.div 
                    key={para.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "group relative p-8 rounded-[2.5rem] border transition-all cursor-pointer",
                      isSelected 
                        ? "bg-zinc-900 border-indigo-500/40 shadow-2xl shadow-indigo-500/5" 
                        : "bg-zinc-900/20 border-white/5 hover:border-white/10"
                    )}
                    onClick={() => setSelectedParagraph(para)}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center text-xs font-black text-zinc-500">
                          {idx + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Paragraph Unit</span>
                          <div className={cn("text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5", risk.color)}>
                            <risk.icon className="w-3 h-3" />
                            {risk.level} profile
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {para.sources.map(s => (
                          <div key={s} className="px-2 py-1 rounded-lg bg-black/40 border border-white/5 text-[10px] font-black text-zinc-500">
                            SRC-{s}
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="text-zinc-100 leading-relaxed text-xl font-medium">
                      {para.text}
                    </p>

                    <div className="mt-10 grid grid-cols-3 gap-4 pt-8 border-t border-white/5">
                      {[
                        { label: "Source", val: para.attribution.source_influence_percent, color: "text-indigo-400" },
                        { label: "Synthesis", val: para.attribution.ai_synthesis_percent, color: "text-purple-400" },
                        { label: "Originality", val: para.attribution.user_originality_percent, color: "text-emerald-400" }
                      ].map((stat) => (
                        <div key={stat.label} className="flex flex-col">
                          <span className="text-[9px] text-zinc-600 uppercase font-black tracking-[0.2em] mb-1">{stat.label}</span>
                          <div className="flex items-end gap-1">
                            <span className={cn("text-xl font-mono font-bold leading-none", stat.color)}>{stat.val}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {paragraphs.length === 0 && !isGenerating && (
              <div className="h-80 flex flex-col items-center justify-center text-zinc-700 border-2 border-dashed border-white/5 rounded-[3rem] bg-zinc-900/10">
                <Layers className="w-16 h-16 mb-6 opacity-10" />
                <p className="text-sm font-bold uppercase tracking-widest opacity-40">Awaiting Synthesis</p>
                <p className="text-xs opacity-30 mt-2">Your attribution-first content will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Analysis & Transparency */}
        <div className="lg:col-span-5 space-y-10">
          {/* Integrity Dashboard */}
          <section className="bg-zinc-900/40 rounded-[2.5rem] border border-white/5 p-8 backdrop-blur-sm sticky top-24">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Audit Dashboard</h3>
              </div>
              <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Live Analysis
              </div>
            </div>
            
            <div className="space-y-10">
              {/* Risk Heatmap Mini */}
              {paragraphs.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Risk Heatmap</h4>
                  <div className="h-32 w-full min-h-[128px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={riskHeatmapData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis dataKey="name" hide />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip 
                          cursor={{ fill: '#ffffff05' }}
                          contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '10px' }}
                        />
                        <Bar dataKey="risk" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Attribution Chart */}
              {selectedParagraph && (
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Attribution Matrix</h4>
                  <div className="h-48 w-full min-h-[192px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {chartData.map(d => (
                      <div key={d.name} className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full mb-2" style={{ backgroundColor: d.color }} />
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter text-center">{d.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Integrity Status */}
              <div className="space-y-6 pt-6 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Integrity Mode</span>
                    <span className="text-xs font-bold text-white uppercase tracking-widest">{INTEGRITY_MODES[mode].label}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Focus</span>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{INTEGRITY_MODES[mode].focus}</span>
                  </div>
                </div>
                
                {selectedParagraph && (
                  <div className="space-y-4">
                    {/* Mode Specific Logic Display */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "p-5 rounded-3xl border flex gap-4 items-start",
                        (selectedParagraph.attribution.source_influence_percent > INTEGRITY_MODES[mode].max_source_influence || 
                         selectedParagraph.attribution.user_originality_percent < INTEGRITY_MODES[mode].min_originality)
                        ? "bg-rose-500/5 border-rose-500/20"
                        : "bg-emerald-500/5 border-emerald-500/20"
                      )}
                    >
                      {selectedParagraph.attribution.source_influence_percent > INTEGRITY_MODES[mode].max_source_influence || 
                       selectedParagraph.attribution.user_originality_percent < INTEGRITY_MODES[mode].min_originality ? (
                        <>
                          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Integrity Alert</p>
                            <p className="text-xs text-rose-400/70 leading-relaxed">
                              {selectedParagraph.attribution.source_influence_percent > INTEGRITY_MODES[mode].max_source_influence 
                                ? `Source influence (${selectedParagraph.attribution.source_influence_percent}%) exceeds ${INTEGRITY_MODES[mode].label} limit.`
                                : `Originality index (${selectedParagraph.attribution.user_originality_percent}%) is below mode minimum (${INTEGRITY_MODES[mode].min_originality}%).`}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Policy Compliant</p>
                            <p className="text-xs text-emerald-400/70 leading-relaxed">Verified safe for {INTEGRITY_MODES[mode].label} standards.</p>
                          </div>
                        </>
                      )}
                    </motion.div>

                    {/* Problematic Patterns for Research Mode */}
                    {mode === "research_draft" && selectedParagraph.attribution.individual_source_weights && (
                      Object.entries(selectedParagraph.attribution.individual_source_weights).some(([_, weight]) => weight > 50) && (
                        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex gap-3">
                          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-amber-400/70 leading-relaxed">
                            <span className="font-black text-amber-500 uppercase">Pattern Alert:</span> Over-reliant on a single source. Consider diversifying your references.
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Reasoning Panel */}
              {selectedParagraph && (
                <div className="space-y-6 pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Transparency Log</h4>
                    <div className="flex gap-4">
                      {selectedParagraph.quality_score !== undefined && (
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-black text-zinc-700 uppercase">Synthesis Quality</span>
                          <span className="text-xs font-bold text-indigo-400">{selectedParagraph.quality_score}/10</span>
                        </div>
                      )}
                      {selectedParagraph.source_diversity_score !== undefined && (
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-black text-zinc-700 uppercase">Source Diversity</span>
                          <span className="text-xs font-bold text-purple-400">{selectedParagraph.source_diversity_score}/10</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 bg-black/40 rounded-2xl border border-white/5">
                    <p className="text-xs text-zinc-500 leading-relaxed italic">
                      "{selectedParagraph.reasoning}"
                    </p>
                  </div>

                  {/* Individual Source Breakdown for Research Mode */}
                  {mode === "research_draft" && selectedParagraph.attribution.individual_source_weights && (
                    <div className="space-y-3">
                      <h5 className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Attribution Weights</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(selectedParagraph.attribution.individual_source_weights).map(([idx, weight]) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                            <span className="text-[10px] font-bold text-zinc-500">SRC-{idx}</span>
                            <span className="text-[10px] font-mono font-bold text-white">{weight}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => exportAuditPDF(selectedParagraph)}
                      className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center justify-center gap-3 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Para Audit
                    </button>
                    <button 
                      onClick={() => exportAuditPDF(null)}
                      className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center justify-center gap-3 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Full Audit
                    </button>
                  </div>
                </div>
              )}

              {!selectedParagraph && (
                <div className="text-center py-20 opacity-20">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Selection</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-96 bg-[#0A0A0A] border-l border-white/10 z-[70] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Audit History</h2>
                </div>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-140px)] pr-2 custom-scrollbar">
                {history.map((item) => (
                  <div key={item.id} className="p-5 bg-zinc-900/40 border border-white/5 rounded-3xl hover:border-indigo-500/30 transition-all cursor-pointer group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{item.mode}</span>
                      <span className="text-[9px] font-bold text-zinc-600">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-white font-bold line-clamp-2 mb-4 leading-snug">{item.query}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Verified</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="text-center py-20 opacity-20">
                    <History className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Empty Archives</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
