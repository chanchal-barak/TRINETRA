"use client";

import { useEffect, useMemo, useState } from "react";

type Relocation = {
  source_settlement_id?: string;
  source_settlement?: string;
  source_population_2026_est?: number;
  destination_site_id?: string;
  destination_site?: string;
destination_village?: string;
allocated_people?: number;
  ai_score?: number;
  ai_rank?: number;
  distance_km?: number;
  site_safe_score?: number;
  site_accessibility?: number;
  site_infrastructure?: number;
  site_capacity_original?: number;
  site_capacity_remaining_after?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  allocation_status?: string;
  allocation_reason?: string;
  emergency_access?: {
    nearest_road_km?: number | null;
    nearest_bridge_km?: number | null;
    nearest_hospital_km?: number | null;
    nearest_emergency_facility_km?: number | null;
    status?: string;
  };
  recommended_action?: string;
};

type Summary = {
  population?: number;
  safe_sites?: number;
  relocation_assignments?: number;
  relocation_recommendations?: number;
  final_relocation_plan?: number;
  roads?: number;
  bridges?: number;
  shelters?: number;
  hospitals?: number;
  emergency_capabilities?: number;
};

type SafeSitesResponse = {
  summary?: {
    total_sites?: number;
    high_suitability_sites?: number;
    medium_suitability_sites?: number;
    low_suitability_sites?: number;
    total_available_capacity?: number;
    best_safety_score?: number | null;
    mapped_sites?: number;
  };
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function num(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function fmt(value: unknown, digits = 0) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString("en-IN", { maximumFractionDigits: digits })
    : String(value);
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-cyan-300";
  if (score >= 40) return "text-yellow-400";
  return "text-orange-400";
}

function accessTone(status?: string) {
  if (status === "GOOD") return "text-emerald-400 bg-emerald-400/10";
  if (status === "MODERATE") return "text-yellow-400 bg-yellow-400/10";
  if (status === "LIMITED") return "text-orange-400 bg-orange-400/10";
  return "text-slate-400 bg-slate-400/10";
}

export default function RelocationPage() {
  const [plans, setPlans] = useState<Relocation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [siteSummary, setSiteSummary] = useState<SafeSitesResponse["summary"] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setError("");
      const [summaryRes, plansRes, decisionsRes, sitesRes] = await Promise.all([
        fetch(`${API_BASE}/api/relocation/summary`),
        fetch(`${API_BASE}/api/relocation/top?limit=2000`),
        fetch(`${API_BASE}/api/relocation/decisions?limit=2000`),
        fetch(`${API_BASE}/api/safe-sites?limit=2000`),
      ]);

      if (!summaryRes.ok || !plansRes.ok || !decisionsRes.ok) {
        throw new Error("Relocation API request failed");
      }

      const summaryData = await summaryRes.json();
      const decisionsData = await decisionsRes.json();
      const sitesData = sitesRes.ok ? await sitesRes.json() : null;

      const decisionRows = Array.isArray(decisionsData?.relocations)
        ? decisionsData.relocations
        : [];

      setSummary(summaryData || null);
      setPlans(decisionRows);
      setSiteSummary(sitesData?.summary || null);
      setSelectedIndex(0);
    } catch (err) {
      console.error(err);
      setError("Unable to load relocation data. Check that FastAPI and MongoDB are running.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function recalculate() {
    setRefreshing(true);
    try {
      const response = await fetch(`${API_BASE}/api/relocation/refresh`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Refresh failed");
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Relocation data could not be refreshed.");
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selected = plans[selectedIndex] || plans[0];

  const allocatedPeople = useMemo(
    () => plans.reduce((total, plan) => total + num(plan.allocated_people), 0),
    [plans]
  );

  const sourceSettlements = useMemo(
    () => new Set(plans.map((plan) => plan.source_settlement).filter(Boolean)).size,
    [plans]
  );

  return (
    <main className="min-h-screen bg-[#081016] text-white">
      <div className="flex min-h-screen">
        <aside className="w-[230px] shrink-0 border-r border-[#1c3038] bg-[#0b151b] px-4 py-5">
          <div className="mb-8 px-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-cyan-400/40 bg-cyan-400/10 text-sm font-bold text-cyan-300">T</div>
              <div>
                <h1 className="text-[18px] font-semibold tracking-[0.18em]">TRINETRA</h1>
                <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Terrain Intelligence</p>
              </div>
            </div>
          </div>

          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Monitoring</p>
          <nav className="space-y-1">
            <a href="/" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"><span>⌂</span>Command Center</a>
            <a href="/upstream" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"><span>◈</span>Upstream Intelligence</a>
            <a href="/risk" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"><span>◆</span>Risk Intelligence</a>
            <a href="/safe-sites" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"><span>⌂</span>Safe Sites</a>
          </nav>

          <p className="mb-3 mt-8 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">Response</p>
          <nav>
            <a href="/relocation" className="flex items-center gap-3 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2.5 text-sm text-cyan-300"><span>⇄</span>Relocation</a>
          </nav>

          <p className="mb-3 mt-8 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">System</p>
          <nav>
            <a href="/data-sources" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"><span>▣</span>Data Sources</a>
          </nav>

          <div className="mt-12 rounded-md border border-[#1c3038] bg-[#0e1b22] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="text-xs text-emerald-300">SYSTEM OPERATIONAL</span>
            </div>
            <p className="text-[10px] leading-4 text-slate-500">Relocation decisions are sourced from the current allocation and infrastructure datasets.</p>
          </div>
        </aside>

        <section className="flex-1">
          <header className="flex h-[68px] items-center justify-between border-b border-[#1c3038] bg-[#0b151b] px-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Emergency Response</p>
              <h2 className="mt-1 text-lg font-medium">Relocation Optimizer</h2>
              <p className="mt-1 text-xs text-slate-500">Risk-aware allocation using screened sites, capacity and emergency access</p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/5 px-3 py-2">
              <span className={`h-2 w-2 rounded-full ${loading || refreshing ? "bg-yellow-400" : error ? "bg-orange-400" : "bg-emerald-400"}`}></span>
              <span className={`text-xs ${loading || refreshing ? "text-yellow-300" : error ? "text-orange-300" : "text-emerald-300"}`}>
                {loading || refreshing ? "LOADING DATA" : error ? "DATA ISSUE" : "OPTIMIZER DATA READY"}
              </span>
            </div>
          </header>

          <div className="p-5">
            {error && (
              <div className="mb-5 rounded-lg border border-orange-400/20 bg-orange-400/5 px-4 py-3 text-xs text-orange-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Allocated Source Settlements</p>
                <p className="mt-2 text-4xl font-semibold text-cyan-300">{loading ? "—" : fmt(sourceSettlements)}</p>
                <p className="mt-3 text-xs text-slate-500">settlements represented in allocated plans</p>
              </div>
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">People Allocated</p>
                <p className="mt-2 text-4xl font-semibold text-orange-400">{loading ? "—" : fmt(allocatedPeople)}</p>
                <p className="mt-3 text-xs text-slate-500">across current allocated plan records</p>
              </div>
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Screened Capacity</p>
                <p className="mt-2 text-4xl font-semibold text-emerald-400">{loading ? "—" : fmt(siteSummary?.total_available_capacity)}</p>
                <p className="mt-3 text-xs text-slate-500">available capacity across screened sites</p>
              </div>
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Plan Records</p>
                <p className="mt-2 text-4xl font-semibold text-cyan-300">{loading ? "—" : fmt(summary?.final_relocation_plan)}</p>
                <p className="mt-3 text-xs text-slate-500">records returned by the final relocation plan</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-[1fr_360px] gap-5">
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920]">
                <div className="flex items-center justify-between border-b border-[#1c3038] px-5 py-4">
                  <div>
                    <h3 className="text-sm font-medium">Relocation Decision Flow</h3>
                    <p className="mt-1 text-[10px] text-slate-500">Selected allocation from the current final relocation plan</p>
                  </div>
                  <span className="text-[10px] text-cyan-300">{selected ? `AI RANK #${fmt(selected.ai_rank || selectedIndex + 1)}` : "NO PLAN"}</span>
                </div>

                <div className="p-5">
                  {!selected ? (
                    <div className="rounded-md border border-[#1c3038] bg-[#0a151b] p-6 text-center text-xs text-slate-500">No allocated relocation plan is available.</div>
                  ) : (
                    <>
                      <div className="rounded-md border border-red-400/20 bg-red-400/5 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-red-400">SOURCE SETTLEMENT</p>
                            <h3 className="mt-2 text-xl font-semibold">
  {selected.source_settlement || "Unknown settlement"}
</h3>

<p className="mt-1 text-sm text-cyan-300">
  Settlement ID · {selected.source_settlement_id || "—"}
</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-3xl font-semibold ${scoreTone(num(selected.ai_score))}`}>{fmt(selected.ai_score, 1)}</p>
                            <p className="text-[9px] text-slate-500">AI RELOCATION SCORE</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-px w-12 bg-[#30444c]"></div>
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">↓</div>
                          <div className="h-px w-12 bg-[#30444c]"></div>
                        </div>
                      </div>

                      <div className="rounded-md border border-emerald-400/20 bg-emerald-400/5 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-emerald-400">DESTINATION SITE</p>
                            <h3 className="mt-2 text-xl font-semibold">{selected.destination_site || "Unknown site"}</h3>
                            <p className="mt-1 text-xs text-slate-500">Site ID · {selected.destination_site_id || "—"}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-3xl font-semibold ${scoreTone(num(selected.site_safe_score))}`}>{fmt(selected.site_safe_score, 1)}</p>
                            <p className="text-[9px] text-slate-500">SITE SAFETY SCORE</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-4 gap-3">
                        <div className="rounded border border-[#1c3038] bg-[#0a151b] p-3"><p className="text-[9px] text-slate-600">ALLOCATED</p><p className="mt-1 text-sm font-medium">{fmt(selected.allocated_people)}</p></div>
                        <div className="rounded border border-[#1c3038] bg-[#0a151b] p-3"><p className="text-[9px] text-slate-600">DISTANCE</p><p className="mt-1 text-sm font-medium">{fmt(selected.distance_km, 2)} km</p></div>
                        <div className="rounded border border-[#1c3038] bg-[#0a151b] p-3"><p className="text-[9px] text-slate-600">SITE CAPACITY</p><p className="mt-1 text-sm font-medium">{fmt(selected.site_capacity_remaining_after)} remaining</p></div>
                        <div className="rounded border border-[#1c3038] bg-[#0a151b] p-3"><p className="text-[9px] text-slate-600">ACCESS</p><p className={`mt-1 text-sm font-medium ${accessTone(selected.emergency_access?.status).split(" ")[0]}`}>{selected.emergency_access?.status || "—"}</p></div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920]">
                <div className="border-b border-[#1c3038] px-4 py-4">
                  <h3 className="text-sm font-medium">Decision Factors</h3>
                  <p className="mt-1 text-[10px] text-slate-500">Values returned by the relocation allocation pipeline</p>
                </div>
                <div className="space-y-4 p-5">
                  {[
                    ["Site safety", selected?.site_safe_score],
                    ["Accessibility", selected?.site_accessibility],
                    ["Infrastructure", selected?.site_infrastructure],
                    ["AI relocation score", selected?.ai_score],
                  ].map(([label, value]) => {
                    const score = Math.max(0, Math.min(100, num(value)));
                    return (
                      <div key={String(label)}>
                        <div className="flex justify-between"><span className="text-xs text-slate-300">{label}</span><span className="text-xs text-cyan-300">{value === undefined ? "—" : fmt(value, 1)}</span></div>
                        <div className="mt-2 h-1.5 rounded-full bg-[#1b2930]"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${score}%` }} /></div>
                      </div>
                    );
                  })}

                  <div className="rounded border border-cyan-400/20 bg-cyan-400/5 p-3">
                    <p className="text-[9px] uppercase tracking-wider text-cyan-300">Capacity Check</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {selected
                        ? `${fmt(selected.allocated_people)} people allocated; ${fmt(selected.site_capacity_remaining_after)} capacity remains after this allocation.`
                        : "Select an allocation to inspect capacity."}
                    </p>
                  </div>

                  <div className="rounded border border-[#1c3038] bg-[#0a151b] p-3">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Plan Reason</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{selected?.allocation_reason || "No allocation reason returned."}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-[#1c3038] bg-[#0d1920]">
              <div className="flex items-center justify-between border-b border-[#1c3038] px-4 py-4">
                <div>
                  <h3 className="text-sm font-medium">Allocated Relocation Plans</h3>
                  <p className="mt-1 text-[10px] text-slate-500">Sorted by the AI relocation ranking returned by the backend</p>
                </div>
                <button onClick={recalculate} disabled={refreshing} className="rounded border border-[#293d44] px-3 py-1.5 text-[10px] text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50">
                  {refreshing ? "REFRESHING" : "REFRESH DATA"}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-[#1c3038]">
                    <tr className="text-[9px] uppercase tracking-wider text-slate-600">
                      <th className="px-4 py-3 font-medium">Rank</th>
                      <th className="px-4 py-3 font-medium">From</th>
                      <th className="px-4 py-3 font-medium">Destination</th>
                      <th className="px-4 py-3 font-medium">People</th>
                      <th className="px-4 py-3 font-medium">Distance</th>
                      <th className="px-4 py-3 font-medium">AI Score</th>
                      <th className="px-4 py-3 font-medium">Remaining</th>
                      <th className="px-4 py-3 text-right font-medium">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c3038]">
                    {plans.slice(0, 20).map((plan, index) => (
                      <tr key={`${plan.source_settlement_id}-${plan.destination_site_id}-${index}`} onClick={() => setSelectedIndex(index)} className={`cursor-pointer hover:bg-white/[0.02] ${index === selectedIndex ? "bg-cyan-400/[0.03]" : ""}`}>
                        <td className="px-4 py-3 text-xs font-medium text-cyan-300">#{fmt(plan.ai_rank || index + 1)}</td>
                        <td className="px-4 py-3 text-xs text-slate-300">{plan.source_settlement || "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-300">
  <div>{plan.destination_site || "—"}</div>
  <div className="mt-1 text-[10px] text-cyan-300">
    {plan.destination_village || "Location unavailable"}
  </div>
</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{fmt(plan.allocated_people)}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{fmt(plan.distance_km, 2)} km</td>
                        <td className={`px-4 py-3 text-xs ${scoreTone(num(plan.ai_score))}`}>{fmt(plan.ai_score, 1)}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{fmt(plan.site_capacity_remaining_after)}</td>
                        <td className="px-4 py-3 text-right"><span className={`rounded px-2 py-1 text-[9px] ${accessTone(plan.emergency_access?.status)}`}>{plan.emergency_access?.status || "—"}</span></td>
                      </tr>
                    ))}
                    {!loading && plans.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-500">No allocated relocation plans returned.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">01 · Prioritize</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">Use the current allocation records to identify where people have already been assigned to screened destination sites.</p>
              </div>
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">02 · Match</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">Match source settlements with destination sites using the backend allocation score, site safety, accessibility, infrastructure and capacity values.</p>
              </div>
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">03 · Check Access</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">Screen the selected destination against nearest roads, bridges, hospitals and emergency facilities before operational use.</p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#1c3038] pt-4">
              <p className="text-[9px] text-slate-600">TRINETRA · Risk-Aware Relocation Optimisation</p>
              <p className="text-[9px] text-slate-600">LIVE BACKEND DATA · Allocation + infrastructure layers</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
