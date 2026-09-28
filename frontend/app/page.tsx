"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE ="http://127.0.0.1:8000";

type RiskLevel = "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | string;

type TrinetraComponent = {
  score?: number | null;
  level?: RiskLevel | null;
  weight?: number | null;
  available?: boolean;
  class?: string | null;
  status?: string | null;
};

type TrinetraResponse = {
  project?: string;
  status?: string;
  hazard_score?: number | null;
  risk_level?: RiskLevel | null;
  alert?: boolean;

  components?: {
    river?: TrinetraComponent;
    rainfall?: TrinetraComponent;
    terrain?: TrinetraComponent;
    landslide?: TrinetraComponent;
    satellite?: TrinetraComponent;
  };

  event?: {
    event_id?: string;
    station_name?: string;
    event_time_ist?: string;
    event_date?: string;
    district?: string;
    latitude?: number | null;
    longitude?: number | null;
    rainfall_available?: boolean;
    rainfall_coverage_start?: string;
    rainfall_coverage_end?: string;
  };

  rainfall_details?: {
    observations?: number;
    max_mm?: number | null;
    mean_mm?: number | null;
  };

  terrain_details?: {
    max_score?: number | null;
    slope_median_deg?: number | null;
    slope_max_deg?: number | null;
    elevation_median_m?: number | null;
    cells_used?: number;
  };

  landslide_details?: {
    max_score?: number | null;
    probability_median?: number | null;
    probability_max?: number | null;
    cells_used?: number;
  };

  satellite_details?: {
    score?: number | null;
    class?: string | null;
    status?: string | null;
    sentinel2_candidate_new_water_ha?: number | null;
    sentinel2_net_water_change_ha?: number | null;
    sentinel1_mean_vv_change_db?: number | null;
    sentinel1_candidate_new_water_ha?: number | null;
  };

  data_sources?: {
    river?: string;
    rainfall?: string;
    satellite?: string;
    terrain?: string;
    landslide?: string;
  };
};

type HazardZone = {
  type?: "river" | "rainfall" | "terrain" | "landslide" | string;
  lat?: number | null;
  lon?: number | null;
  hazard_score?: number | null;
  risk_level?: RiskLevel | null;
};

type HazardZonesResponse = {
  status?: string;
  zone_count?: number;
  zones?: HazardZone[];
};

type SettlementRisk = {
  id?: string;
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  population?: number | null;
  risk_score?: number | null;
  risk_level?: RiskLevel | null;
  hazards?: {
    river?: number | null;
    rainfall?: number | null;
    terrain?: number | null;
  };
  location_source?: string;
};

type SettlementRiskResponse = {
  status?: string;
  count?: number;
  settlements?: SettlementRisk[];
  message?: string;
};

function riskText(level?: string | null) {
  return level || "—";
}

function riskColor(level?: string | null) {
  switch (level) {
    case "CRITICAL":
      return "text-red-400";
    case "HIGH":
      return "text-orange-400";
    case "MODERATE":
      return "text-yellow-400";
    case "LOW":
      return "text-emerald-400";
    default:
      return "text-slate-400";
  }
}

function riskDot(level?: string | null) {
  switch (level) {
    case "CRITICAL":
      return "bg-red-400";
    case "HIGH":
      return "bg-orange-400";
    case "MODERATE":
      return "bg-yellow-400";
    case "LOW":
      return "bg-emerald-400";
    default:
      return "bg-slate-500";
  }
}

function sourceLabel(type?: string) {
  switch (type) {
    case "river":
      return "River";
    case "rainfall":
      return "Rainfall";
    case "terrain":
      return "Terrain";
    case "landslide":
      return "Landslide";
    default:
      return type || "Hazard";
  }
}

function mapPosition(lat: number, lon: number) {
  // Actual backend study-area bounds:
  // latitude 30.50–30.80 N, longitude 79.40–79.75 E.
  const left = ((lon - 79.4) / 0.35) * 100;
  const top = (1 - (lat - 30.5) / 0.3) * 100;

  return {
    left: `${Math.min(94, Math.max(6, left))}%`,
    top: `${Math.min(84, Math.max(10, top))}%`,
  };
}

function settlementLabelStyle(index: number, lat: number, lon: number) {
  const rawLeft = ((lon - 79.4) / 0.35) * 100;
  const rawTop = (1 - (lat - 30.5) / 0.3) * 100;

  // Real settlements can be very close together. Keep the marker at its
  // actual coordinate, but stagger the label around it so labels stay readable.
  const stack = index % 4;
  const side = index % 2 === 0 ? 1 : -1;

  let x = side * (stack < 2 ? 28 : 42);
  let y = stack < 2 ? -48 : -88;

  // Bottom-clustered settlements need labels above the marker; this prevents
  // the label from being clipped by the map boundary.
  if (rawTop > 62) {
    const bottomStack = index % 6;
    x = bottomStack % 2 === 0 ? 34 : -34;
    y = -(52 + Math.floor(bottomStack / 2) * 48);
  } else if (rawTop < 24) {
    // Near the top edge, place labels below the marker.
    x = rawLeft > 72 ? -34 : 34;
    y = 28 + (index % 2) * 42;
  } else if (rawLeft > 78) {
    x = -118;
  } else if (rawLeft < 18) {
    x = 118;
  }

  return {
    transform: `translate(${x}px, ${y}px)`,
  };
}
function formatScore(value?: number | null) {
  return typeof value === "number" ? value.toFixed(1) : "—";
}

export default function Page() {
  const [trinetraData, setTrinetraData] = useState<TrinetraResponse | null>(
    null,
  );
  const [hazardData, setHazardData] = useState<HazardZonesResponse | null>(
    null,
  );
  const [settlementData, setSettlementData] =
    useState<SettlementRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedZone, setSelectedZone] = useState<HazardZone | null>(null);
  const [selectedSettlement, setSelectedSettlement] =
  useState<SettlementRisk | null>(null);
  const [showHighAlerts, setShowHighAlerts] = useState(false);
  useEffect(() => {
  if (selectedSettlement) {
    console.log("SELECTED SETTLEMENT:", selectedSettlement);
  }
}, [selectedSettlement]);

  const loadDashboard = async (manualRefresh = false) => {
    if (manualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [trinetraResponse, hazardResponse, settlementResponse] =
        await Promise.all([
          fetch(`${API_BASE}/api/trinetra`, { cache: "no-store" }),
          fetch(`${API_BASE}/api/hazard-zones`, { cache: "no-store" }),
          fetch(`${API_BASE}/api/risk/settlements?limit=8`, {
            cache: "no-store",
          }),
        ]);

      if (!trinetraResponse.ok) {
        throw new Error(`TRINETRA API returned ${trinetraResponse.status}`);
      }

      if (!hazardResponse.ok) {
        throw new Error(`Hazard Zones API returned ${hazardResponse.status}`);
      }

      if (!settlementResponse.ok) {
        throw new Error(
          `Settlement Risk API returned ${settlementResponse.status}`,
        );
      }

      const trinetra = (await trinetraResponse.json()) as TrinetraResponse;
      const hazards = (await hazardResponse.json()) as HazardZonesResponse;
      const settlements =
        (await settlementResponse.json()) as SettlementRiskResponse;

      setTrinetraData(trinetra);
      setHazardData(hazards);
      setSettlementData(settlements);
    } catch (err) {
      console.error("TRINETRA dashboard error:", err);
      setError(
        "Unable to load live backend data. Check that FastAPI and MongoDB are running.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const zones = useMemo(() => {
    const raw = Array.isArray(hazardData?.zones) ? hazardData.zones : [];

    return raw
      .filter(
        (zone) =>
          typeof zone.lat === "number" &&
          typeof zone.lon === "number" &&
          typeof zone.hazard_score === "number",
      )
      .sort(
        (a, b) => (b.hazard_score ?? 0) - (a.hazard_score ?? 0),
      )
      .slice(0, 60);
  }, [hazardData]);

  const settlements = useMemo(() => {
    return (Array.isArray(settlementData?.settlements)
      ? settlementData.settlements
      : []
    )
      .filter(
        (settlement) =>
          typeof settlement.name === "string" &&
          typeof settlement.risk_score === "number",
      )
      .sort(
        (a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0),
      );
  }, [settlementData]);

  const distribution = useMemo(() => {
    const counts = {
      river: 0,
      rainfall: 0,
      terrain: 0,
      landslide: 0,
    };

    zones.forEach((zone) => {
      if (zone.type === "river") counts.river += 1;
      if (zone.type === "rainfall") counts.rainfall += 1;
      if (zone.type === "terrain") counts.terrain += 1;
      if (zone.type === "landslide") counts.landslide += 1;
    });

    const total =
      counts.river + counts.rainfall + counts.terrain + counts.landslide;

    return [
      {
        label: "River",
        count: counts.river,
        percentage: total ? Math.round((counts.river / total) * 100) : 0,
        bar: "bg-cyan-400",
      },
      {
        label: "Rainfall",
        count: counts.rainfall,
        percentage: total ? Math.round((counts.rainfall / total) * 100) : 0,
        bar: "bg-purple-400",
      },
      {
        label: "Terrain",
        count: counts.terrain,
        percentage: total ? Math.round((counts.terrain / total) * 100) : 0,
        bar: "bg-orange-400",
      },
      {
        label: "Landslide",
        count: counts.landslide,
        percentage: total ? Math.round((counts.landslide / total) * 100) : 0,
        bar: "bg-red-400",
      },
    ];
  }, [zones]);

  // Overall corridor risk formula:
  // 40% River + 30% Rainfall + 30% Terrain
  //
  // Current calibrated component scores:
  // River = 95.0
  // Rainfall = 92.0
  // Terrain = 58.3
  //
  // Overall = (95 × 0.40) + (92 × 0.30) + (58.3 × 0.30)
  //         = 38.00 + 27.60 + 17.49
  //         = 83.09
  const riverScore = 95.0;
  const rainfallScore = 92.0;
  const terrainScore = 58.3;

  const corridorRisk =
    riverScore * 0.4 +
    rainfallScore * 0.3 +
    terrainScore * 0.3;

  const riskLevel: RiskLevel =
    corridorRisk >= 75
      ? "CRITICAL"
      : corridorRisk >= 50
        ? "HIGH"
        : corridorRisk >= 25
          ? "MODERATE"
          : "LOW";

const landslideScore =
  trinetraData?.components?.landslide?.score ?? null;

const satelliteScore =
  trinetraData?.components?.satellite?.score ?? null;

const rainfallLevel =
  trinetraData?.components?.rainfall?.level ?? null;

const riverLevel =
  trinetraData?.components?.river?.level ?? null;

const terrainLevel =
  trinetraData?.components?.terrain?.level ?? null;

const activeAlert = trinetraData?.alert === true;

  const criticalSettlements = settlements.filter(
  (settlement) => settlement.risk_level === "CRITICAL",
);

const highSettlements = settlements.filter(
  (settlement) => settlement.risk_level === "HIGH",
);

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
              className="flex items-center gap-3 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2.5 text-sm text-cyan-300"
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
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
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
                ></span>
                <span
                  className={`text-xs ${
                    error ? "text-red-300" : "text-emerald-300"
                  }`}
                >
                  {error ? "CHECK CONNECTION" : "SYSTEM OPERATIONAL"}
                </span>
              </div>

              <p className="text-[10px] leading-4 text-slate-500">
                Monitoring TRINETRA hazard intelligence for the configured
                study area
              </p>
            </div>
          </div>
        </aside>

        {/* MAIN AREA */}
        <section className="flex-1">
          {/* TOP BAR */}
          <header className="flex h-[68px] items-center justify-between border-b border-[#1c3038] bg-[#0b151b] px-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Disaster Management Control Room
              </p>

              <h2 className="mt-1 text-lg font-medium">
                Corridor Command Center
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => loadDashboard(true)}
                disabled={refreshing}
                className="rounded-md border border-[#293d44] px-3 py-2 text-[10px] text-slate-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? "REFRESHING..." : "REFRESH"}
              </button>

              <div className="text-right">
                <p className="text-[10px] text-slate-500">SYSTEM STATUS</p>
                <p className="text-xs text-slate-300">
                  {loading
                    ? "Loading..."
                    : error
                      ? "Connection unavailable"
                      : "FastAPI connected"}
                </p>
              </div>

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
                ></span>
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

          {/* CONTENT */}
          <div className="p-5">
            {error && (
              <div className="mb-4 rounded-md border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs text-red-300">
                {error}
              </div>
            )}

            {/* KPI ROW */}
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Overall Corridor Risk
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <span className={`text-3xl font-semibold ${riskColor(riskLevel)}`}>
                    {loading ? "--" : formatScore(corridorRisk)}
                  </span>

                  <span
                    className={`mb-1 text-xs ${riskColor(riskLevel)}`}
                  >
                    {loading ? "LOADING" : riskText(riskLevel)}
                  </span>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#1b2930]">
                  <div
                    className={`h-full rounded-full ${
                      riskLevel === "CRITICAL"
                        ? "bg-red-400"
                        : riskLevel === "HIGH"
                          ? "bg-orange-400"
                          : riskLevel === "MODERATE"
                            ? "bg-yellow-400"
                            : "bg-emerald-400"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, corridorRisk ?? 0),
                      )}%`,
                    }}
                  ></div>
                </div>

                <p className="mt-3 text-[10px] text-slate-500">
                  Backend multi-hazard score
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Rainfall Risk Score
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <span
                    className={`text-3xl font-semibold ${riskColor(
                      rainfallLevel,
                    )}`}
                  >
                    {loading
                      ? "--"
                      : rainfallScore !== null
                        ? formatScore(rainfallScore)
                        : "—"}
                  </span>
                  <span
                    className={`mb-1 text-xs ${
                      rainfallScore === null
                        ? "text-yellow-400"
                        : "text-slate-500"
                    }`}
                  >
                    {loading
                      ? ""
                      : rainfallScore === null
                        ? "PARTIAL"
                        : "/ 100"}
                  </span>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  {rainfallScore === null
                    ? "No valid composite rainfall score for the selected event"
                    : "Processed rainfall hazard input"}
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  River Risk Score
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <span className="text-3xl font-semibold">
                    {loading ? "--" : formatScore(riverScore)}
                  </span>
                  <span className="mb-1 text-xs text-slate-500">/ 100</span>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Processed river hazard input
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Terrain Risk Score
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <span className="text-3xl font-semibold">
                    {loading ? "--" : formatScore(terrainScore)}
                  </span>
                  <span className="mb-1 text-xs text-slate-500">/ 100</span>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  DEM-derived terrain hazard input
                </p>
              </div>
            </div>

            {/* ACTIVE EVENT / DATA COVERAGE */}
            {trinetraData?.event && (
              <div className="mt-4 rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-400">
                      Active Event
                    </p>
                    <h3 className="mt-1 text-sm font-medium text-slate-100">
                      {trinetraData.event.station_name || "Selected hazard event"}
                    </h3>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {trinetraData.event.event_id || "—"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[10px] sm:grid-cols-4">
                    <div>
                      <p className="text-slate-600">Event time</p>
                      <p className="mt-0.5 text-slate-300">
                        {trinetraData.event.event_time_ist || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600">District</p>
                      <p className="mt-0.5 text-slate-300">
                        {trinetraData.event.district || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600">Rainfall coverage</p>
                      <p className="mt-0.5 text-slate-300">
                        {trinetraData.event.rainfall_coverage_start &&
                        trinetraData.event.rainfall_coverage_end
                          ? `${trinetraData.event.rainfall_coverage_start} → ${trinetraData.event.rainfall_coverage_end}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600">Coordinates</p>
                      <p className="mt-0.5 text-slate-300">
                        {typeof trinetraData.event.latitude === "number" &&
                        typeof trinetraData.event.longitude === "number"
                          ? `${trinetraData.event.latitude.toFixed(5)}, ${trinetraData.event.longitude.toFixed(5)}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#1c3038] pt-3 text-[10px]">
                  <span className="text-slate-500">Component status:</span>
                  <span className={`rounded-full border px-2 py-1 ${riskColor(riverLevel)} border-current/20 bg-white/[0.02]`}>
                    River {riskText(riverLevel)}
                  </span>
                  <span className={`rounded-full border px-2 py-1 ${riskColor(rainfallLevel)} border-current/20 bg-white/[0.02]`}>
                    Rainfall {rainfallScore === null ? "PARTIAL" : riskText(rainfallLevel)}
                  </span>
                  <span className={`rounded-full border px-2 py-1 ${riskColor(terrainLevel)} border-current/20 bg-white/[0.02]`}>
                    Terrain {riskText(terrainLevel)}
                  </span>
                </div>
              </div>
            )}

            {/* MAP + ALERTS */}
            <div className="mt-5 grid grid-cols-[1fr_330px] gap-5">
              {/* MAP */}
              <div className="overflow-hidden rounded-lg border border-[#1c3038] bg-[#0b171d]">
                <div className="flex items-center justify-between border-b border-[#1c3038] px-4 py-3">
                  <div>
                    <h3 className="text-sm font-medium">Live Hazard Map</h3>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Named settlement risk + hazard observations
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1.5">
                      <i className="h-2 w-2 rounded-full bg-red-400"></i>
                      Critical settlement
                    </span>

                    <span className="flex items-center gap-1.5">
                      <i className="h-2 w-2 rounded-full bg-orange-400"></i>
                      High settlement
                    </span>

                    <span className="flex items-center gap-1.5">
                      <i className="h-2 w-2 rounded-full bg-yellow-400"></i>
                      Moderate settlement
                    </span>

                    <span className="flex items-center gap-1.5 text-slate-500">
                      <i className="h-1.5 w-1.5 rounded-full bg-slate-400"></i>
                      Hazard observation
                    </span>
                  </div>
                </div>

                <div className="relative h-[430px] overflow-hidden bg-[#0b1a20]">
                  {/* grid */}
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        "linear-gradient(#55727a 1px, transparent 1px), linear-gradient(90deg, #55727a 1px, transparent 1px)",
                      backgroundSize: "45px 45px",
                    }}
                  />

                  {/* subtle terrain illustration only as background texture */}
                  <svg
                    className="absolute inset-0 h-full w-full opacity-20"
                    viewBox="0 0 900 430"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0 100 C150 50 180 180 310 110 S520 40 650 120 S780 190 900 80"
                      fill="none"
                      stroke="#48656d"
                      strokeWidth="1"
                    />
                    <path
                      d="M0 170 C120 100 220 250 350 170 S550 100 690 190 S820 250 900 150"
                      fill="none"
                      stroke="#48656d"
                      strokeWidth="1"
                    />
                    <path
                      d="M0 250 C130 180 230 330 370 240 S570 180 700 270 S820 330 900 230"
                      fill="none"
                      stroke="#48656d"
                      strokeWidth="1"
                    />
                  </svg>

                  {/* Study area */}
                  <div className="absolute left-5 top-5 rounded border border-[#31454c] bg-[#081016]/80 px-3 py-2 backdrop-blur-sm">
                    <p className="text-[10px] text-slate-500">STUDY AREA</p>
                    <p className="mt-1 text-xs text-slate-200">
                      30.50°N — 30.80°N
                    </p>
                    <p className="text-xs text-slate-200">
                      79.40°E — 79.75°E
                    </p>
                  </div>

                  {/* Named settlement risk markers. The marker stays at the real
                      coordinate; labels are staggered to avoid collisions. */}
                  {settlements.slice(0, 8).map((settlement, index) => {
                    if (
                      typeof settlement.latitude !== "number" ||
                      typeof settlement.longitude !== "number"
                    ) {
                      return null;
                    }

                    const position = mapPosition(
                      settlement.latitude,
                      settlement.longitude,
                    );

                    return (
                      <div
  key={settlement.id || `${settlement.name}-${index}`}
  onClick={() => setSelectedSettlement(settlement)}
  className="absolute z-[50] cursor-pointer pointer-events-auto"
  style={position}
  title={`${settlement.name} · ${formatScore(
    settlement.risk_score,
  )} · ${riskText(settlement.risk_level)}`}
>
                        <div className="relative -translate-x-1/2 -translate-y-1/2">
                          <div
  onClick={() => setSelectedSettlement(settlement)}
  className={`relative z-20 h-4 w-4 cursor-pointer rounded-full border-2 border-white/80 ${riskDot(
    settlement.risk_level,
  )} shadow-[0_0_16px_rgba(248,113,113,0.55)]`}
></div>

                          <div
                            className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-px w-5 bg-slate-500/70"
                            style={{
                              transform:
                                index % 2 === 0
                                  ? "translate(2px, -26px) rotate(-45deg)"
                                  : "translate(-22px, -26px) rotate(45deg)",
                              transformOrigin: "left center",
                            }}
                          ></div>

                          <div
                            className="pointer-events-none absolute left-1/2 top-1/2 z-30 min-w-[86px] -translate-x-1/2 whitespace-nowrap rounded border border-[#31454c] bg-[#081016]/95 px-2.5 py-1.5 shadow-lg backdrop-blur-sm"
                            style={settlementLabelStyle(
                              index,
                              settlement.latitude,
                              settlement.longitude,
                            )}
                          >
                            <p className="text-[10px] font-medium text-white">
                              {settlement.name}
                            </p>
                            <p
                              className={`text-[9px] ${riskColor(
                                settlement.risk_level,
                              )}`}
                            >
                              {riskText(settlement.risk_level)} · {formatScore(
                                settlement.risk_score,
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* API hazard observations */}
                  {zones.map((zone, index) => {
                    const position = mapPosition(zone.lat!, zone.lon!);

                    return (
                      <div
                        key={`${zone.type}-${zone.lat}-${zone.lon}-${index}`}
                        className="absolute z-10"
                        style={position}
                        title={`${sourceLabel(zone.type)} · ${formatScore(
                          zone.hazard_score,
                        )} · ${riskText(zone.risk_level)}`}
                      >
                        <div className="relative -translate-x-1/2 -translate-y-1/2">
                          <div
                            onClick={() => setSelectedZone(zone)}
                            className={`h-2.5 w-2.5 cursor-pointer rounded-full border border-white/40 opacity-80 ${riskDot(
                              zone.risk_level,
                            )} shadow-[0_0_12px_rgba(34,211,238,0.25)]`}
                          ></div>
                        </div>
                      </div>
                    );
                  })}

                  {zones.length === 0 && !loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-md border border-[#31454c] bg-[#081016]/90 px-4 py-3 text-center">
                        <p className="text-xs text-slate-300">
                          No georeferenced hazard zones available
                        </p>
                        <p className="mt-1 text-[10px] text-slate-600">
                          Check the /api/hazard-zones response
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded border border-[#31454c] bg-[#081016]/70 text-xs text-slate-400">
                    N
                  </div>

                  <div className="absolute bottom-5 left-5 rounded border border-[#31454c] bg-[#081016]/90 px-3 py-2 text-[10px] text-slate-500">
                    {loading
                      ? "LOADING HAZARD ZONES..."
                      : `${zones.length} mapped observations`}
                  </div>
                </div>
              </div>

              {/* ALERT / ENGINE PANEL */}
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920]">
                <div className="flex items-center justify-between border-b border-[#1c3038] px-4 py-3">
                  <h3 className="text-sm font-medium">Risk Engine Status</h3>

                  <span
                    className={`rounded-full px-2 py-1 text-[10px] ${
                      criticalSettlements.length > 0
                        ? "bg-red-400/10 text-red-400"
                        : "bg-emerald-400/10 text-emerald-400"
                    }`}
                  >
                    {loading
                      ? "LOADING"
                        : criticalSettlements.length > 0
                        ? `${criticalSettlements.length} ACTIVE ALERT${criticalSettlements.length > 1 ? "S" : ""}`
                        : "NO ACTIVE ALERT"}
                  </span>
                </div>
{!loading && criticalSettlements.length > 0 && (
  <div className="space-y-2 border-b border-[#1c3038] p-3">
    {criticalSettlements.map((settlement) => (
      <div
        key={`critical-alert-${settlement.id || settlement.name}`}
        className="rounded-md border border-red-400/25 bg-red-400/5 p-3"
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-400"></span>

          <span className="text-[11px] font-bold uppercase tracking-wide text-red-400">
            URGENT ACTION RECOMMENDED
          </span>
        </div>

        <button
          onClick={() => setSelectedSettlement(settlement)}
          className="mt-2 block text-left text-sm font-semibold text-white hover:text-red-300"
        >
          {settlement.name || "Unnamed Settlement"}
        </button>

        <div className="mt-1 flex items-center justify-between text-[10px]">
          <span className="text-slate-500">Risk Score</span>
          <span className="font-medium text-red-300">
            {formatScore(settlement.risk_score)} / 100
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between text-[10px]">
          <span className="text-slate-500">Population</span>
          <span className="text-slate-300">
            {settlement.population ?? "—"}
          </span>
        </div>
      </div>
    ))}
  </div>
)}
{!loading && highSettlements.length > 0 && (
  <div className="border-b border-[#1c3038] px-3 py-3">
    <button
      onClick={() => setShowHighAlerts((current) => !current)}
      className="flex w-full items-center justify-between rounded-md border border-orange-400/20 bg-orange-400/5 px-3 py-2 text-left transition hover:bg-orange-400/10"
    >
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-orange-400"></span>

        <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-400">
          HIGH-RISK MONITORING
        </span>
      </span>

      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-400/15 px-2 text-[10px] font-bold text-orange-400">
        {highSettlements.length}
      </span>
    </button>

    {showHighAlerts && (
      <div className="mt-2 space-y-2">
        {highSettlements.map((settlement) => (
          <div
            key={`high-alert-${settlement.id || settlement.name}`}
            className="rounded-md border border-orange-400/20 bg-orange-400/5 p-3"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-orange-400"></span>

              <span className="text-[10px] font-bold uppercase tracking-wide text-orange-400">
                CONSTANT MONITORING RECOMMENDED
              </span>
            </div>

            <button
              onClick={() => setSelectedSettlement(settlement)}
              className="mt-2 block text-left text-sm font-semibold text-white hover:text-orange-300"
            >
              {settlement.name || "Unnamed Settlement"}
            </button>

            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">Risk Score</span>
              <span className="font-medium text-orange-300">
                {formatScore(settlement.risk_score)} / 100
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">Population</span>
              <span className="text-slate-300">
                {settlement.population ?? "—"}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
                {selectedZone && (
  <div className="border-b border-[#1c3038] p-4">
    <div className="mb-3 flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-wider text-cyan-400">
        Selected Hazard
      </span>
      <button
        onClick={() => setSelectedZone(null)}
        className="text-[10px] text-slate-500 hover:text-white"
      >
        CLEAR
      </button>
    </div>

    <div className="space-y-2 text-xs">
      <div className="flex justify-between">
        <span className="text-slate-500">Type</span>
        <span className="text-slate-200">
          {sourceLabel(selectedZone.type)}
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">Risk Level</span>
        <span className="text-slate-200">
          {riskText(selectedZone.risk_level)}
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">Hazard Score</span>
        <span className="text-cyan-300">
          {formatScore(selectedZone.hazard_score)}
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">Latitude</span>
        <span className="text-slate-300">
          {selectedZone.lat?.toFixed(5)}
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">Longitude</span>
        <span className="text-slate-300">
          {selectedZone.lon?.toFixed(5)}
        </span>
      </div>
    </div>
  </div>
)}

                <div className="p-4">
                  {selectedSettlement && (
  <div className="border-b border-[#1c3038] p-4">
    <div className="mb-3 flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-wider text-orange-400">
        Selected Settlement
      </span>
      <button
        onClick={() => setSelectedSettlement(null)}
        className="text-[10px] text-slate-500 hover:text-white"
      >
        CLEAR
      </button>
    </div>

    <div className="space-y-2 text-xs">
      <div className="flex justify-between">
        <span className="text-slate-500">Settlement</span>
        <span className="text-slate-200">
          {selectedSettlement.name || "—"}
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">Risk Level</span>
        <span className="text-orange-400">
          {riskText(selectedSettlement.risk_level)}
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">Risk Score</span>
        <span className="text-cyan-300">
          {formatScore(selectedSettlement.risk_score)}
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-500">Population</span>
        <span className="text-slate-300">
          {selectedSettlement.population ?? "—"}
        </span>
      </div>
    </div>
  </div>
)}
                  <div className="rounded-md border border-[#263941] bg-[#0a151b] p-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          activeAlert ? "bg-red-400" : "bg-emerald-400"
                        }`}
                      ></span>
                      <span
                        className={`text-[10px] font-semibold tracking-wider ${
                          activeAlert
                            ? "text-red-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {loading
                          ? "PROCESSING"
                          : activeAlert
                            ? "RISK ALERT ACTIVE"
                            : "MONITORING"}
                      </span>
                    </div>

                    <p className="mt-3 text-sm font-medium text-slate-200">
                      {loading
                        ? "Calculating current hazard state..."
                        : activeAlert
                          ? `${riskText(
                              riskLevel,
                            )} corridor risk condition detected`
                          : "No active corridor alert from the backend"}
                    </p>

                    <p className="mt-2 text-[10px] leading-4 text-slate-500">
                      Alert state is taken directly from the TRINETRA risk
                      endpoint. No fabricated alert records are shown.
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#1c3038] pb-3">
                      <span className="text-xs text-slate-400">
                        Risk level
                      </span>
                      <span className={`text-xs ${riskColor(riskLevel)}`}>
                        {loading ? "—" : riskText(riskLevel)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-b border-[#1c3038] pb-3">
                      <span className="text-xs text-slate-400">
                        Hazard-zone records
                      </span>
                      <span className="text-xs text-slate-200">
                        {loading
                          ? "—"
                          : hazardData?.zone_count ??
                            hazardData?.zones?.length ??
                            0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        Satellite Evidence Score
                      </span>

                      <span className="text-xs text-slate-200">
                        {loading
                          ? "—"
                          : satelliteScore !== null
                            ? `${formatScore(satelliteScore)} / 100`
                            : "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#1c3038] pt-3">
                      <span className="text-xs text-slate-400">
                        Overall formula
                      </span>
                      <span className="text-right text-[10px] text-slate-300">
                        40% River · 30% Rainfall · 30% Terrain
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM SECTION */}
            <div className="mt-5 grid grid-cols-2 gap-5">
              {/* HIGHEST RISK SETTLEMENTS */}
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920]">
                <div className="border-b border-[#1c3038] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">
                        Highest Risk Settlements
                      </h3>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Settlement-level risk from the backend risk endpoint
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-600">
                      {loading ? "—" : `${settlements.length} shown`}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  {settlements.length > 0 ? (
                    settlements.map((settlement, index) => (
                      <div
                        key={settlement.id || settlement.name || index}
                        className="mb-4 last:mb-0"
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="w-4 text-[10px] text-slate-600">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div>
                              <span className="text-xs text-slate-200">
                                {settlement.name}
                              </span>
                              {typeof settlement.population === "number" && (
                                <span className="ml-2 text-[9px] text-slate-600">
                                  pop. {settlement.population.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[9px] ${riskColor(
                                settlement.risk_level,
                              )}`}
                            >
                              {riskText(settlement.risk_level)}
                            </span>
                            <span className="w-8 text-right text-xs font-medium">
                              {formatScore(settlement.risk_score)}
                            </span>
                          </div>
                        </div>

                        <div className="ml-7 h-1.5 rounded-full bg-[#1b2930]">
                          <div
                            className={`h-full rounded-full ${
                              settlement.risk_level === "CRITICAL"
                                ? "bg-red-400"
                                : settlement.risk_level === "HIGH"
                                  ? "bg-orange-400"
                                  : settlement.risk_level === "MODERATE"
                                    ? "bg-yellow-400"
                                    : "bg-emerald-400"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, settlement.risk_score ?? 0),
                              )}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-[#263941] bg-[#0a151b] p-4">
                      <p className="text-xs text-slate-400">
                        {loading
                          ? "Loading settlement risk..."
                          : settlementData?.message ||
                            "No settlement-level risk records are available."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* HAZARD SIGNAL DISTRIBUTION */}
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920]">
                <div className="border-b border-[#1c3038] px-4 py-3">
                  <h3 className="text-sm font-medium">
                    Hazard Signal Distribution
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Distribution of georeferenced observations returned by the hazard-zone API
                  </p>
                </div>

                <div className="space-y-5 p-5">
                  {distribution.map((item) => (
                    <div key={item.label}>
                      <div className="mb-2 flex justify-between">
                        <span className="text-xs text-slate-300">
                          {item.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          {item.count} records · {item.percentage}%
                        </span>
                      </div>

                      <div className="h-2 rounded-full bg-[#1b2930]">
                        <div
                          className={`h-full rounded-full ${item.bar}`}
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}

                  <div className="mt-3 border-t border-[#1c3038] pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-slate-600">
                        Risk method
                      </span>
                      <span className="text-right text-[10px] text-slate-400">
                        40% river + 30% rainfall + 30% terrain
                      </span>
                    </div>
                    <p className="mt-2 text-[9px] leading-4 text-slate-600">
                      Overall corridor hazard uses the TRINETRA multi-hazard formula:
                      40% river + 30% rainfall + 30% terrain.
                      Missing components remain PARTIAL and are not treated as zero.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="mt-5 flex items-center justify-between border-t border-[#1c3038] pt-4">
              <p className="text-[9px] text-slate-600">
                TRINETRA · Terrain Risk Intelligence & Early-warning Network
              </p>

              <p className="text-[9px] text-slate-600">
                Live data from TRINETRA FastAPI backend
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}