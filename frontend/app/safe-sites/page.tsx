"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type SafeSite = {
  site_id?: string | number | null;
  site_name?: string | null;
  site_cluster?: string | null;
  village_name?: string | null;
  urban_local_body_name?: string | null;
  ward_name?: string | null;
  block_name?: string | null;
  district_name?: string | null;
  matched_settlement_id?: string | number | null;
  matched_settlement_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coordinate_confidence?: number | null;
  normal_classroom_capacity?: number | null;
  temporary_capacity?: number | null;
  available_capacity?: number | null;
  building_score?: number | null;
  road_score?: number | null;
  water_score?: number | null;
  electricity_score?: number | null;
  land_score?: number | null;
  boundary_wall_score?: number | null;
  safety_score?: number | null;
  accessibility_score?: number | null;
  capacity_score?: number | null;
  infrastructure_score?: number | null;
  facility_suitability_score?: number | null;
  safe_site_score?: number | null;
  nearest_settlement_id?: string | number | null;
  nearest_settlement_name?: string | null;
  nearest_settlement_distance_km?: number | null;
  site_status?: string | null;
};

type SafeSitesResponse = {
  status?: string;
  count?: number;
  total_count?: number;
  sites?: SafeSite[];
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

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fmt(value: unknown, decimals = 0) {
  const n = num(value);
  if (n === null) return "—";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function statusColor(status?: string | null) {
  if (status === "HIGH_SUITABILITY") return "text-emerald-400";
  if (status === "MEDIUM_SUITABILITY") return "text-yellow-400";
  if (status === "LOW_SUITABILITY") return "text-slate-400";
  return "text-slate-400";
}

function statusBg(status?: string | null) {
  if (status === "HIGH_SUITABILITY") return "bg-emerald-400";
  if (status === "MEDIUM_SUITABILITY") return "bg-yellow-400";
  if (status === "LOW_SUITABILITY") return "bg-slate-500";
  return "bg-slate-500";
}

function statusLabel(status?: string | null) {
  if (!status) return "UNKNOWN";
  return status.replaceAll("_", " ");
}

function mapPosition(lat: number, lon: number) {
  const left = ((lon - 79.38) / 0.52) * 100;
  const top = (1 - (lat - 30.44) / 0.55) * 100;

  return {
    left: `${Math.min(96, Math.max(4, left))}%`,
    top: `${Math.min(92, Math.max(7, top))}%`,
  };
}

function siteTitle(site: SafeSite) {
  return site.site_name || "Educational Facility";
}

function siteLocation(site: SafeSite) {
  return (
    site.village_name ||
    site.urban_local_body_name ||
    site.matched_settlement_name ||
    site.district_name ||
    "—"
  );
}

function siteScore(site: SafeSite) {
  return num(site.safe_site_score);
}

function siteCapacity(site: SafeSite) {
  return num(site.available_capacity);
}

function selectedScoreClass(score: number | null) {
  if (score === null) return "border-[#31454c]";
  if (score >= 75) return "border-emerald-400";
  if (score >= 50) return "border-yellow-400";
  return "border-slate-500";
}

export default function SafeSitesPage() {
  const [sites, setSites] = useState<SafeSite[]>([]);
  const [summary, setSummary] = useState<SafeSitesResponse["summary"] | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadSites = async (manual = false) => {
    setError("");
    manual ? setRefreshing(true) : setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/safe-sites`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Safe-site API returned ${response.status}`);
      }

      const data = (await response.json()) as SafeSitesResponse;
      const returnedSites = Array.isArray(data.sites) ? data.sites : [];

      setSites(returnedSites);
      setSummary(data.summary || null);

      const mapped = returnedSites
        .filter(
          (site) =>
            num(site.latitude) !== null && num(site.longitude) !== null,
        )
        .sort(
          (a, b) => (siteScore(b) ?? -1) - (siteScore(a) ?? -1),
        );

      const firstMapped = mapped[0];
      setSelectedId(
        firstMapped?.site_id ??
          returnedSites[0]?.site_id ??
          null,
      );
    } catch (err) {
      console.error("Safe Sites error:", err);
      setError(
        "Unable to load safe-site screening data. Check FastAPI and MongoDB connection.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  const sortedSites = useMemo(
    () =>
      [...sites].sort(
        (a, b) => (siteScore(b) ?? -1) - (siteScore(a) ?? -1),
      ),
    [sites],
  );

  const selectedSite =
    sites.find((site) => String(site.site_id) === String(selectedId)) ||
    sortedSites[0] ||
    null;

  const mappedSites = sortedSites
    .map((site) => ({
      site,
      lat: num(site.latitude),
      lon: num(site.longitude),
    }))
    .filter(
      (item): item is { site: SafeSite; lat: number; lon: number } =>
        item.lat !== null && item.lon !== null,
    );

  const visibleSites = sortedSites.slice(0, 50);

  const totalSites = summary?.total_sites ?? sites.length;
  const highSuitability =
    summary?.high_suitability_sites ??
    sites.filter((site) => site.site_status === "HIGH_SUITABILITY").length;

  const totalCapacity =
    summary?.total_available_capacity ??
    sites.reduce((total, site) => total + (siteCapacity(site) ?? 0), 0);

  const bestScore =
    summary?.best_safety_score ??
    (sortedSites.length ? siteScore(sortedSites[0]) : null);

  const selectedAvailable = selectedSite
    ? siteCapacity(selectedSite)
    : null;

  const selectedNormalCapacity = selectedSite
    ? num(selectedSite.normal_classroom_capacity)
    : null;

  const selectedTemporaryCapacity = selectedSite
    ? num(selectedSite.temporary_capacity)
    : null;

  const selectedCapacityTotal =
    selectedNormalCapacity !== null || selectedTemporaryCapacity !== null
      ? (selectedNormalCapacity ?? 0) + (selectedTemporaryCapacity ?? 0)
      : null;

  const selectedScoreValue = selectedSite ? siteScore(selectedSite) : null;

  const screeningFactors = selectedSite
    ? [
        {
          label: "Site safety",
          value: num(selectedSite.safety_score),
        },
        {
          label: "Accessibility",
          value: num(selectedSite.accessibility_score),
        },
        {
          label: "Infrastructure",
          value: num(selectedSite.infrastructure_score),
        },
        {
          label: "Capacity",
          value: num(selectedSite.capacity_score),
        },
      ].filter((factor) => factor.value !== null)
    : [];

  return (
    <main className="min-h-screen bg-[#081016] text-white">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="flex w-[230px] shrink-0 flex-col border-r border-[#1c3038] bg-[#0b151b] px-4 py-5">
          <div className="mb-8 px-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-cyan-400/40 bg-cyan-400/10 text-sm font-bold text-cyan-300">
                T
              </div>
              <div>
                <h1 className="text-[18px] font-semibold tracking-[0.18em]">
                  TRINETRA
                </h1>
                <p className="text-[9px] uppercase tracking-[0.18em] text-slate-500">
                  Terrain Intelligence
                </p>
              </div>
            </div>
          </div>

          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
            Monitoring
          </p>

          <nav className="space-y-1">
            <a
              href="/"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <span>⌂</span>
              Command Center
            </a>

            <a
              href="/upstream"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <span>◈</span>
              Upstream Intelligence
            </a>

            <a
              href="/risk"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <span>◆</span>
              Risk Intelligence
            </a>

            <a
              href="/safe-sites"
              className="flex items-center gap-3 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2.5 text-sm text-cyan-300"
            >
              <span>⌂</span>
              Safe Sites
            </a>

            <a
              href="/relocation"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <span>⇄</span>
              Relocation
            </a>
          </nav>

          <p className="mb-3 mt-8 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
            System
          </p>

          <nav>
            <a
              href="/data-sources"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <span>▣</span>
              Data Sources
            </a>
          </nav>

          <div className="mt-auto pt-12">
            <div className="rounded-md border border-[#1c3038] bg-[#0e1b22] p-3">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    error ? "bg-red-400" : "bg-emerald-400"
                  }`}
                />
                <span
                  className={`text-xs ${
                    error ? "text-red-300" : "text-emerald-300"
                  }`}
                >
                  {error ? "CHECK CONNECTION" : "SCREENING ENGINE ACTIVE"}
                </span>
              </div>
              <p className="text-[10px] leading-4 text-slate-500">
                Safe-site records and carrying-capacity inputs from backend
              </p>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <section className="flex-1">
          <header className="flex h-[68px] items-center justify-between border-b border-[#1c3038] bg-[#0b151b] px-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Site Assessment
              </p>
              <h2 className="mt-1 text-lg font-medium">
                Safe Sites & Capacity
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Safer-site screening and realistic available capacity
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => loadSites(true)}
                disabled={refreshing}
                className="rounded-md border border-[#293d44] px-3 py-2 text-[10px] text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                {refreshing ? "REFRESHING..." : "REFRESH"}
              </button>

              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                  error
                    ? "border-red-400/20 bg-red-400/5"
                    : "border-emerald-400/20 bg-emerald-400/5"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    error ? "bg-red-400" : "bg-emerald-400"
                  }`}
                />
                <span
                  className={`text-xs ${
                    error ? "text-red-300" : "text-emerald-300"
                  }`}
                >
                  {error ? "OFFLINE" : loading ? "CONNECTING" : "MONITORING"}
                </span>
              </div>
            </div>
          </header>

          <div className="p-5">
            {error && (
              <div className="mb-4 rounded-md border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs text-red-300">
                {error}
              </div>
            )}

            {/* SUMMARY */}
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Candidate Sites
                </p>
                <p className="mt-2 text-4xl font-semibold text-cyan-300">
                  {loading ? "—" : fmt(totalSites)}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  records in the safe-site dataset
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  High-Suitability Sites
                </p>
                <p className="mt-2 text-4xl font-semibold text-emerald-400">
                  {loading ? "—" : fmt(highSuitability)}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  classified HIGH_SUITABILITY
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Available Capacity
                </p>
                <p className="mt-2 text-4xl font-semibold text-cyan-300">
                  {loading ? "—" : fmt(totalCapacity)}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  available_capacity across all records
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Best Safety Score
                </p>
                <p className="mt-2 text-4xl font-semibold text-cyan-300">
                  {loading ? "—" : fmt(bestScore)}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  highest safe-site score returned
                </p>
              </div>
            </div>

            {/* MAP + SELECTED SITE */}
            <div className="mt-5 grid grid-cols-[1fr_390px] items-start gap-5">
              <div className="overflow-hidden rounded-lg border border-[#1c3038] bg-[#0b171d]">
                <div className="flex items-center justify-between border-b border-[#1c3038] px-4 py-3">
                  <div>
                    <h3 className="text-sm font-medium">
                      Candidate Site Screening Map
                    </h3>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Only backend records with coordinates are plotted
                    </p>
                  </div>

                  <span className="text-[10px] text-slate-500">
                    {summary?.mapped_sites ?? mappedSites.length} MAPPED
                  </span>
                </div>

                <div className="relative h-[680px] overflow-hidden bg-[#0a191f]">
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        "linear-gradient(#55727a 1px, transparent 1px), linear-gradient(90deg, #55727a 1px, transparent 1px)",
                      backgroundSize: "42px 42px",
                    }}
                  />

                  <svg
                    className="absolute inset-0 h-full w-full opacity-25"
                    viewBox="0 0 900 390"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0 90 C120 20 180 150 310 80 S500 40 620 110 S790 180 900 70"
                      fill="none"
                      stroke="#48656d"
                      strokeWidth="1"
                    />
                    <path
                      d="M0 165 C120 90 220 230 340 155 S530 100 680 180 S800 230 900 140"
                      fill="none"
                      stroke="#48656d"
                      strokeWidth="1"
                    />
                    <path
                      d="M720 0 C680 80 720 120 650 170 C590 215 620 260 540 300 C480 330 450 360 410 390"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="3"
                      opacity="0.45"
                    />
                  </svg>

                  <div className="absolute left-5 top-5 rounded border border-[#31454c] bg-[#081016]/90 px-3 py-2">
                    <p className="text-[9px] text-slate-500">DATA EXTENT</p>
                    <p className="mt-1 text-[10px] text-slate-300">
                      Coordinates supplied by safe-site dataset
                    </p>
                  </div>

                  {mappedSites.slice(0, 80).map(({ site, lat, lon }, index) => {
                    const position = mapPosition(lat, lon);
                    const selected =
                      String(site.site_id) === String(selectedId);
                    const status = site.site_status;

                    return (
                      <button
                        key={`${site.site_id}-${index}`}
                        onClick={() => setSelectedId(site.site_id ?? null)}
                        className="absolute"
                        style={position}
                        title={`${siteTitle(site)} · ${siteLocation(site)} · score ${fmt(
                          siteScore(site),
                        )}`}
                      >
                        <span
                          className={`block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                            selected
                              ? "h-5 w-5 border-white"
                              : "border-white/50"
                          } ${statusBg(status)}`}
                        />
                      </button>
                    );
                  })}

                  {!loading && mappedSites.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-md border border-[#263a42] bg-[#081016]/95 p-5 text-center">
                        <p className="text-xs font-medium text-slate-300">
                          No site coordinates available
                        </p>
                        <p className="mt-2 text-[10px] leading-4 text-slate-600">
                          The safe-site records are still available in the
                          table, but the backend did not return usable
                          coordinates for mapping.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-4 left-4 rounded border border-[#31454c] bg-[#081016]/90 px-3 py-2">
                    <p className="text-[9px] text-slate-600">SCREENING</p>
                    <p className="mt-1 text-[10px] text-emerald-400">
                      ● BACKEND SITE RECORDS
                    </p>
                  </div>

                  <div className="absolute right-5 bottom-5 flex h-9 w-9 items-center justify-center rounded border border-[#31454c] bg-[#081016]/80 text-xs text-slate-400">
                    N
                  </div>
                </div>
              </div>

              {/* SELECTED SITE */}
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920]">
                <div className="flex items-center justify-between border-b border-[#1c3038] px-4 py-3">
                  <h3 className="text-sm font-medium">Selected Site</h3>
                  <span
                    className={`text-[10px] ${statusColor(
                      selectedSite?.site_status,
                    )}`}
                  >
                    {statusLabel(selectedSite?.site_status)}
                  </span>
                </div>

                <div className="p-5">
                  {selectedSite ? (
                    <>
                      <h2 className="text-xl font-semibold">
                        {siteTitle(selectedSite)}
                      </h2>

                      <p className="mt-2 text-xs text-slate-500">
                        {siteLocation(selectedSite)}
                        {selectedSite.nearest_settlement_distance_km !==
                          null &&
                          selectedSite.nearest_settlement_distance_km !==
                            undefined &&
                          ` · ${fmt(
                            selectedSite.nearest_settlement_distance_km,
                            2,
                          )} km from nearest settlement`}
                      </p>

                      <p className="mt-1 text-[9px] text-slate-600">
                        SITE ID {String(selectedSite.site_id ?? "—")}
                      </p>

                      <div className="mt-6 flex items-center gap-5">
                        <div
                          className={`flex h-[118px] w-[118px] items-center justify-center rounded-full border-[7px] ${selectedScoreClass(
                            selectedScoreValue,
                          )}`}
                        >
                          <div className="text-center">
                            <p className="text-3xl font-semibold">
                              {fmt(selectedScoreValue)}
                            </p>
                            <p className="text-[9px] text-slate-500">
                              / 100
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] text-slate-500">
                            SAFE-SITE SCORE
                          </p>
                          <p
                            className={`mt-2 text-sm font-medium ${statusColor(
                              selectedSite.site_status,
                            )}`}
                          >
                            {statusLabel(selectedSite.site_status)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-7 border-t border-[#1c3038] pt-5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          Available Capacity
                        </p>

                        <div className="mt-2 flex items-end justify-between">
                          <p className="text-3xl font-semibold">
                            {fmt(selectedAvailable)}
                          </p>
                          <p className="text-xs text-cyan-300">
                            people currently available
                          </p>
                        </div>

                        {selectedCapacityTotal !== null && (
                          <>
                            <div className="mt-3 h-2 rounded-full bg-[#1b2930]">
                              <div
                                className="h-full rounded-full bg-cyan-400"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    selectedCapacityTotal
                                      ? ((selectedAvailable ?? 0) /
                                          selectedCapacityTotal) *
                                        100
                                      : 0,
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="mt-2 flex justify-between text-[9px] text-slate-600">
                              <span>Available</span>
                              <span>
                                Normal + temporary capacity:{" "}
                                {fmt(selectedCapacityTotal)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="mt-6 border-t border-[#1c3038] pt-5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                          Screening Factors
                        </p>

                        <div className="mt-4 space-y-4">
                          {screeningFactors.map((factor) => (
                            <div key={factor.label}>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-300">
                                  {factor.label}
                                </span>
                                <span className="text-xs text-cyan-300">
                                  {fmt(factor.value)}
                                </span>
                              </div>

                              <div className="mt-2 h-1.5 rounded-full bg-[#1b2930]">
                                <div
                                  className="h-full rounded-full bg-cyan-400"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.max(0, factor.value ?? 0),
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6 rounded border border-emerald-400/20 bg-emerald-400/5 p-3">
                        <p className="text-[9px] uppercase tracking-wider text-emerald-400">
                          Screening Note
                        </p>
                        <p className="mt-2 text-xs leading-5 text-slate-300">
                          This is a backend suitability assessment. Final
                          relocation use should still follow ground
                          verification and operational clearance.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="py-10 text-center text-xs text-slate-600">
                      {loading
                        ? "Loading site assessment..."
                        : "No safe-site record returned."}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TABLE */}
            <div className="mt-5 rounded-lg border border-[#1c3038] bg-[#0d1920]">
              <div className="flex items-center justify-between border-b border-[#1c3038] px-4 py-3">
                <div>
                  <h3 className="text-sm font-medium">
                    Candidate Site Assessment
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Top 50 records sorted by backend safe-site score
                  </p>
                </div>

                <span className="text-[9px] text-slate-600">
                  {totalSites} TOTAL RECORDS
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-[#1c3038]">
                    <tr className="text-[9px] uppercase tracking-wider text-slate-600">
                      <th className="px-4 py-3 font-medium">Site</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 font-medium">Suitability</th>
                      <th className="px-4 py-3 font-medium">Capacity</th>
                      <th className="px-4 py-3 font-medium">Access</th>
                      <th className="px-4 py-3 font-medium">
                        Infrastructure
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#1c3038]">
                    {visibleSites.map((site, index) => (
                      <tr
                        key={`${site.site_id}-${index}`}
                        onClick={() => setSelectedId(site.site_id ?? null)}
                        className="cursor-pointer hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/5 text-[9px] font-semibold text-cyan-300">
                              {String(site.site_id ?? "—").slice(-2)}
                            </span>
                            <span className="max-w-[230px] truncate text-xs text-slate-200">
                              {siteTitle(site)}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-400">
                          {siteLocation(site)}
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-300">
                          {fmt(siteScore(site))}
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-400">
                          {fmt(siteCapacity(site))}
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-400">
                          {fmt(site.accessibility_score)}
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-400">
                          {fmt(site.infrastructure_score)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <span
                            className={`text-[9px] ${statusColor(
                              site.site_status,
                            )}`}
                          >
                            {statusLabel(site.site_status)}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {!loading && visibleSites.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-xs text-slate-600"
                        >
                          No safe-site records were returned by the backend.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* LOGIC */}
            <div className="mt-5 grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Suitability Classification
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Site status is taken directly from the backend
                  HIGH_SUITABILITY, MEDIUM_SUITABILITY and LOW_SUITABILITY
                  classification.
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Infrastructure
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Accessibility and infrastructure scores are displayed from
                  the screened site records rather than invented map values.
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Carrying Capacity
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Available capacity is the dataset&apos;s
                  available_capacity field. It is not presented as a
                  guaranteed evacuation capacity.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#1c3038] pt-4">
              <p className="text-[9px] text-slate-600">
                TRINETRA · Safe Sites & Capacity
              </p>
              <p className="text-[9px] text-slate-600">
                Backend screening output · {summary?.mapped_sites ?? 0} mapped
                records
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
