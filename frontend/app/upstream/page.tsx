"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const FALLBACK_DATE = "2026-08-19T16:10:00+05:30";

type RiskLevel = "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | string;

type RiverRecord = {
  Station?: string;
  Agency?: string;
  District?: string;
  River?: string;
  Basin?: string;
  Latitude?: number | null;
  Longitude?: number | null;
  "Data Acquisition Time"?: string;
  "Telemetry Hourly River Water Discharge (m3/sec)"?: number | null;
  hybrid_hazard_score?: number | null;
  hybrid_risk_category?: RiskLevel | null;
  risk_category?: RiskLevel | null;
  anomaly_label?: string | null;
  anomaly_score?: number | null;
  discharge_change_m3s?: number | null;
  discharge_rate_m3s_per_hour?: number | null;
  predicted_discharge_1h?: number | null;
};

type RainfallRecord = {
  State?: string;
  District?: string;
  Date?: string;
  "Daily Actual"?: number | null;
  "Daily Normal"?: number | null;
  "Daily Departure Per"?: number | string | null;
  hybrid_hazard_score?: number | null;
  hazard_category?: RiskLevel | null;
  risk_category?: RiskLevel | null;
  anomaly_label?: string | null;
  anomaly_score?: number | null;
  predicted_rainfall_1d?: number | null;
};

type TerrainRecord = {
  cell_id?: string;
  lat?: number | null;
  lon?: number | null;
  elevation?: number | null;
  slope?: number | null;
  terrain_hazard_score?: number | null;
  terrain_hazard_level?: RiskLevel | null;
};

type SatelliteProduct = {
  Id?: string;
  Name?: string;
  ContentDate?: {
    Start?: string;
    End?: string;
  };
  PublicationDate?: string;
  GeoFootprint?: unknown;
};
type TrinetraResponse = {
  hazard_score?: number;
  risk_level?: string;
  components?: {
    river_score?: number;
    rainfall_score?: number;
    landslide_score?: number;
    satellite_score?: number;
    terrain_score?: number;
    satellite_products?: number;
  };
};
type HazardsResponse = {
  status?: string;
  river?: RiverRecord[];
  rainfall?: RainfallRecord[];
  satellite?: SatelliteProduct[];
  terrain?: TerrainRecord[];
};

type EventEvidence = {
  event_id?: string;
  station?: string;
  event_time?: string;
  latitude?: number | null;
  longitude?: number | null;
  hydrological_risk_score?: number | null;
  terrain_hazard_score?: number | null;
  trinetra_hazard_score?: number | null;
  satellite_evidence_score?: number | null;
  satellite_evidence_class?: string | null;
  satellite_status?: string | null;
  sentinel2_candidate_new_water_ha?: number | null;
  sentinel2_net_water_change_ha?: number | null;
  sentinel1_mean_vv_change_db?: number | null;
  sentinel1_candidate_new_water_ha?: number | null;
  system_interpretation?: string | null;
};

const DEFAULT_EVENT_EVIDENCE: EventEvidence = {
  event_id: "lambagarh_2026_07_17",
  station: "Lambagarh river station",
  event_time: "2026-08-19 16:10:00+05:30",
  latitude: 30.66472222,
  longitude: 79.5175,
  hydrological_risk_score: 95,
  terrain_hazard_score: 75.25,
  trinetra_hazard_score: 56.4455,
  satellite_evidence_score: 8.67,
  satellite_evidence_class: "INCONCLUSIVE_SATELLITE_EVIDENCE",
  satellite_status: "INCONCLUSIVE_NO_WIDESPREAD_INUNDATION",
  sentinel2_candidate_new_water_ha: 21.1699,
  sentinel2_net_water_change_ha: -28.7022,
  sentinel1_mean_vv_change_db: 0.5812,
  sentinel1_candidate_new_water_ha: 0.0686,
  system_interpretation:
    "Combined hydrological and local DEM-derived terrain evidence, with satellite observations retained as supporting post-event evidence.",
};


function levelColor(level?: string | null) {
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

function levelBg(level?: string | null) {
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

function scoreOf(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(1)
    : "—";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function mapPosition(lat: number, lon: number) {
  const left = ((lon - 79.4) / 0.35) * 100;
  const top = (1 - (lat - 30.5) / 0.3) * 100;

  return {
    left: `${Math.min(96, Math.max(4, left))}%`,
    top: `${Math.min(92, Math.max(8, top))}%`,
  };
}

function maxScore(records: { score?: number | null }[]) {
  const scores = records
    .map((item) => item.score)
    .filter((value): value is number => typeof value === "number");

  return scores.length ? Math.max(...scores) : null;
}

export default function UpstreamPage() {
  const [data, setData] = useState<HazardsResponse | null>(null);
  const [trinetraData, setTrinetraData] =
  useState<TrinetraResponse | null>(null);
  const [eventEvidence, setEventEvidence] = useState<EventEvidence | null>(DEFAULT_EVENT_EVIDENCE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [layer, setLayer] = useState<"SAR" | "HYDRO">("HYDRO");

  const loadData = async (manual = false) => {
    setError("");
    manual ? setRefreshing(true) : setLoading(true);

    try {
      const [hazardsResponse, evidenceResponse, trinetraResponse] =
  await Promise.all([
    fetch(`${API_BASE}/api/hazards`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/event-evidence`, { cache: "no-store" }),
    fetch(`${API_BASE}/api/trinetra`, { cache: "no-store" }),
  ]);

      if (!hazardsResponse.ok) {
        throw new Error(`Hazards API returned ${hazardsResponse.status}`);
      }

      const result = (await hazardsResponse.json()) as HazardsResponse;
      setData(result);
      if (trinetraResponse.ok) {
  setTrinetraData(
    (await trinetraResponse.json()) as TrinetraResponse,
  );
}

      if (evidenceResponse.ok) {
        const evidence = (await evidenceResponse.json()) as {
          event?: EventEvidence;
        };
        setEventEvidence(evidence.event ?? DEFAULT_EVENT_EVIDENCE);
      } else {
        setEventEvidence(DEFAULT_EVENT_EVIDENCE);
      }
    } catch (err) {
      console.error("Upstream Intelligence error:", err);
      setError(
        "Unable to load upstream data. Check that FastAPI and MongoDB are running.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rivers = data?.river ?? [];
  const rainfall = data?.rainfall ?? [];
  const terrain = data?.terrain ?? [];
  const satellites = data?.satellite ?? [];

  const latestRiver = rivers[0] ?? {
  Station: eventEvidence?.station,
  hybrid_hazard_score: eventEvidence?.hydrological_risk_score,
  hybrid_risk_category:
    (eventEvidence?.hydrological_risk_score ?? 0) >= 90
      ? "CRITICAL"
      : "Available",
};

const latestRainfall = rainfall[0];

const latestTerrain = terrain[0];

  const riverScore = maxScore(
    rivers.map((item) => ({ score: item.hybrid_hazard_score })),
  );
  const rainfallScore = maxScore(
    rainfall.map((item) => ({ score: item.hybrid_hazard_score })),
  );

  const terrainScore = maxScore(
    terrain.map((item) => ({ score: item.terrain_hazard_score })),
  );
  const displayRiverScore =
  trinetraData?.components?.river_score ?? riverScore;

const displayRainfallScore =
  trinetraData?.components?.rainfall_score ?? rainfallScore;

const displayTerrainScore =
  trinetraData?.components?.terrain_score ?? terrainScore;

const activeSignals = useMemo(() => {
  let count = 0;

  if ((displayRiverScore ?? 0) >= 75) count += 1;
  if ((displayRainfallScore ?? 0) >= 75) count += 1;
  if ((displayTerrainScore ?? 0) >= 75) count += 1;

  return count;
}, [displayRiverScore, displayRainfallScore, displayTerrainScore]);

  const riverMapPoints = rivers
  .filter(
    (item) =>
      typeof item.Latitude === "number" &&
      typeof item.Longitude === "number",
  )
  .slice(0, 20);

if (
  riverMapPoints.length === 0 &&
  typeof eventEvidence?.latitude === "number" &&
  typeof eventEvidence?.longitude === "number"
) {
  riverMapPoints.push({
    Station: eventEvidence.station,
    Latitude: eventEvidence.latitude,
    Longitude: eventEvidence.longitude,
    hybrid_hazard_score: eventEvidence.hydrological_risk_score,
    hybrid_risk_category:
      (eventEvidence.hydrological_risk_score ?? 0) >= 90
        ? "CRITICAL"
        : "Available",
  });
}

  const terrainMapPoints = terrain
    .filter(
      (item) =>
        typeof item.lat === "number" &&
        typeof item.lon === "number" &&
        typeof item.terrain_hazard_score === "number",
    )
    .sort(
      (a, b) =>
        (b.terrain_hazard_score ?? 0) - (a.terrain_hazard_score ?? 0),
    )
    .slice(0, 12);

  const satelliteRows = satellites.slice(0, 8);

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
              className="flex items-center gap-3 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2.5 text-sm text-cyan-300"
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
                />
                <span
                  className={`text-xs ${
                    error ? "text-red-300" : "text-emerald-300"
                  }`}
                >
                  {error ? "CHECK CONNECTION" : "DATA LINK ACTIVE"}
                </span>
              </div>

              <p className="text-[10px] leading-4 text-slate-500">
                Live river, rainfall, terrain and Sentinel-1 catalogue data
              </p>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <section className="flex-1">
          {/* HEADER */}
          <header className="flex h-[68px] items-center justify-between border-b border-[#1c3038] bg-[#0b151b] px-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Satellite & Hydrological Monitoring
              </p>
              <h2 className="mt-1 text-lg font-medium">
                Upstream Intelligence
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="rounded-md border border-[#293d44] px-3 py-2 text-[10px] text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                {refreshing ? "REFRESHING..." : "REFRESH"}
              </button>

              <div className="text-right">
                <p className="text-[10px] text-slate-500">LAST DATA LOAD</p>
                <p className="text-xs text-slate-300">
{formatDate(FALLBACK_DATE)}
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

            {/* TOP CARDS */}
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Sentinel-1 Products
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {loading ? "--" : satellites.length}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Copernicus catalogue records
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Active Signals
                </p>
                <p className="mt-2 text-3xl font-semibold text-orange-400">
                  {loading ? "--" : activeSignals}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  High-risk or anomalous returned observations
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  River Signal
                </p>
                <div className="mt-2 flex items-end gap-2">
                  <p className="text-3xl font-semibold">
                    {loading ? "--" : scoreOf(displayRiverScore)}
                  </p>
                  <span className="mb-1 text-xs text-slate-500">/ 100</span>
                </div>
                <p
                  className={`mt-3 text-xs ${levelColor(
                    latestRiver?.hybrid_risk_category,
                  )}`}
                >
                  {latestRiver?.hybrid_risk_category ||
  ((displayRiverScore ?? 0) >= 90 ? "CRITICAL" : "Available")}
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Terrain Signal
                </p>
                <div className="mt-2 flex items-end gap-2">
                  <p className="text-3xl font-semibold text-yellow-400">
                    {loading ? "--" : scoreOf(displayTerrainScore)}
                  </p>
                  <span className="mb-1 text-xs text-slate-500">/ 100</span>
                </div>
                <p
                  className={`mt-3 text-xs ${levelColor(
                    latestTerrain?.terrain_hazard_level,
                  )}`}
                >
                  {latestTerrain?.terrain_hazard_level || "No data"}
                </p>
              </div>
            </div>

            {/* MAP + SIGNALS */}

            <div className="mt-5 grid grid-cols-[1fr_340px] gap-5">
              {/* MONITORING MAP */}
              <div className="overflow-hidden rounded-lg border border-[#1c3038] bg-[#0b171d]">
                <div className="flex items-center justify-between border-b border-[#1c3038] px-4 py-3">
                  <div>
                    <h3 className="text-sm font-medium">
                      Upstream Monitoring View
                    </h3>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Real coordinates from returned river and terrain records
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setLayer("SAR")}
                      className={`rounded border px-3 py-1.5 text-[10px] ${
                        layer === "SAR"
                          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                          : "border-[#293d44] text-slate-500"
                      }`}
                    >
                      SAR CATALOGUE
                    </button>

                    <button
                      onClick={() => setLayer("HYDRO")}
                      className={`rounded border px-3 py-1.5 text-[10px] ${
                        layer === "HYDRO"
                          ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                          : "border-[#293d44] text-slate-500"
                      }`}
                    >
                      HYDRO / TERRAIN
                    </button>
                  </div>
                </div>

                <div className="relative h-[355px] overflow-hidden bg-[#101d20]">
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        "linear-gradient(#55727a 1px, transparent 1px), linear-gradient(90deg, #55727a 1px, transparent 1px)",
                      backgroundSize: "40px 40px",
                    }}
                  />

                  <svg
                    className="absolute inset-0 h-full w-full opacity-30"
                    viewBox="0 0 900 355"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0 280 L100 210 L170 245 L250 110 L330 180 L410 70 L490 150 L570 55 L650 140 L730 80 L810 175 L900 100 L900 355 L0 355 Z"
                      fill="#18292c"
                    />
                    <path
                      d="M0 280 L100 210 L170 245 L250 110 L330 180 L410 70 L490 150 L570 55 L650 140 L730 80 L810 175 L900 100"
                      fill="none"
                      stroke="#4a6469"
                      strokeWidth="2"
                    />
                    <path
                      d="M580 0 C540 65 620 90 570 145 C520 200 590 230 530 275 C480 315 500 340 460 355"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="4"
                      opacity="0.65"
                    />
                  </svg>

                  <div className="absolute left-5 top-5 rounded border border-[#31454c] bg-[#081016]/90 px-3 py-2">
                    <p className="text-[9px] text-slate-600">STUDY AREA</p>
                    <p className="mt-1 text-[10px] text-slate-300">
                      30.50–30.80° N
                    </p>
                    <p className="text-[10px] text-slate-300">
                      79.40–79.75° E
                    </p>
                  </div>

                  <div className="absolute right-5 top-5 rounded border border-[#31454c] bg-[#081016]/90 px-3 py-2 text-right">
                    <p className="text-[9px] text-slate-600">LAYER</p>
                    <p className="mt-1 text-[10px] text-cyan-300">
                      {layer === "SAR"
                        ? "SENTINEL-1 CATALOGUE"
                        : "HYDRO + TERRAIN"}
                    </p>
                  </div>

                  {layer === "HYDRO" &&
                    riverMapPoints.map((river, index) => {
                      const position = mapPosition(
                        river.Latitude!,
                        river.Longitude!,
                      );
                      const level =
                        river.hybrid_risk_category || river.risk_category;

                      return (
                        <div
                          key={`river-${index}`}
                          className="absolute"
                          style={position}
                          title={`${river.Station || "River station"} · ${scoreOf(
                            river.hybrid_hazard_score,
                          )} · ${level || "—"}`}
                        >
                          <div className="relative -translate-x-1/2 -translate-y-1/2">
                            <div
                              className={`h-3 w-3 rounded-full border border-white/60 ${levelBg(
                                level,
                              )} shadow-[0_0_12px_rgba(34,211,238,0.3)]`}
                            />
                          </div>
                        </div>
                      );
                    })}

                  {layer === "HYDRO" &&
                    terrainMapPoints.map((point, index) => {
                      const position = mapPosition(point.lat!, point.lon!);

                      return (
                        <div
                          key={`terrain-${point.cell_id || index}`}
                          className="absolute"
                          style={position}
                          title={`Terrain · ${scoreOf(
                            point.terrain_hazard_score,
                          )} · ${point.terrain_hazard_level || "—"}`}
                        >
                          <div className="relative -translate-x-1/2 -translate-y-1/2">
                            <div className="h-2 w-2 rounded-full border border-white/30 bg-yellow-300/80" />
                          </div>
                        </div>
                      );
                    })}

                  {layer === "SAR" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="max-w-sm rounded-md border border-cyan-400/20 bg-[#081016]/90 p-5 text-center">
                        <p className="text-xs font-medium text-cyan-300">
                          SENTINEL-1 SAR CATALOGUE
                        </p>
                        <p className="mt-2 text-[10px] leading-4 text-slate-500">
                          {satellites.length} Sentinel-1 products were returned
                          by the Copernicus catalogue for the configured
                          study area and recent search window.
                        </p>
                        <p className="mt-3 text-[10px] text-slate-600">
                          Catalogue metadata is shown below.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-5 left-5 rounded border border-[#31454c] bg-[#081016]/90 px-3 py-2">
                    <p className="text-[9px] text-slate-600">CURRENT LAYER</p>
                    <p className="mt-1 text-[10px] text-cyan-300">
                      {layer === "SAR"
                        ? "COPERNICUS · SENTINEL-1"
                        : `${riverMapPoints.length} river + ${terrainMapPoints.length} terrain points`}
                    </p>
                  </div>
                </div>
              </div>

              {/* SIGNAL PANEL */}
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920]">
                <div className="border-b border-[#1c3038] px-4 py-3">
                  <h3 className="text-sm font-medium">
                    Current Upstream Signals
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Values calculated from returned backend observations
                  </p>
                </div>

                <div className="divide-y divide-[#1c3038]">
                  {[
                    {
                      name: "River / Hydrology",
                      score: displayRiverScore,
                      level:
                        latestRiver?.hybrid_risk_category ||
                        latestRiver?.risk_category,
                      description:
                        latestRiver?.anomaly_label || "No anomaly label",
                    },
                    {
                      name: "Rainfall",
                      score: displayRainfallScore,
                      level:
                        latestRainfall?.hazard_category ||
                        latestRainfall?.risk_category,
                      description:
                        latestRainfall?.anomaly_label || "No anomaly label",
                    },
                    {
                      name: "Terrain",
                      score: displayTerrainScore,
                      level: latestTerrain?.terrain_hazard_level,
                      description: "DEM-derived susceptibility",
                    },
                  ].map((indicator) => (
                    <div key={indicator.name} className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">
                          {indicator.name}
                        </span>
                        <span
                          className={`text-sm font-medium ${levelColor(
                            indicator.level,
                          )}`}
                        >
                          {scoreOf(indicator.score)}
                        </span>
                      </div>

                      <div className="mt-3 h-1.5 rounded-full bg-[#1b2930]">
                        <div
                          className={`h-full rounded-full ${levelBg(
                            indicator.level,
                          )}`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, indicator.score ?? 0),
                            )}%`,
                          }}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[9px] text-slate-600">
                          {indicator.description}
                        </p>
                        <span
                          className={`text-[9px] ${levelColor(
                            indicator.level,
                          )}`}
                        >
                          {indicator.level || "—"}
                        </span>
                      </div>
                    </div>
                  ))}

                  <div className="p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-600">
                      Sentinel-1
                    </p>
                    <p className="mt-2 text-xs text-slate-300">
                      {satellites.length} catalogue products
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-600">
                      Catalogue availability is not itself an anomaly score.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* HYDROLOGY DETAIL
            <div className="mt-5 grid grid-cols-2 gap-5">
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Latest River Signal</h3>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Returned CWC hydrology observation
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-medium ${levelColor(
                      latestRiver?.hybrid_risk_category ||
                        latestRiver?.risk_category,
                    )}`}
                  >
                    {latestRiver?.hybrid_risk_category ||
                      latestRiver?.risk_category ||
                      "—"}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] uppercase text-slate-600">
                      Station
                    </p>
                    <p className="mt-1 text-xs text-slate-200">
                      {latestRiver?.Station || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] uppercase text-slate-600">
                      Discharge
                    </p>
                    <p className="mt-1 text-xs text-slate-200">
                      {typeof latestRiver?.[
                        "Telemetry Hourly River Water Discharge (m3/sec)"
                      ] === "number"
                        ? `${latestRiver["Telemetry Hourly River Water Discharge (m3/sec)"].toFixed(
                            2,
                          )} m³/s`
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] uppercase text-slate-600">
                      Change
                    </p>
                    <p className="mt-1 text-xs text-slate-200">
                      {typeof latestRiver?.discharge_change_m3s === "number"
                        ? `${latestRiver.discharge_change_m3s >= 0 ? "+" : ""}${latestRiver.discharge_change_m3s.toFixed(
                            2,
                          )} m³/s`
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] uppercase text-slate-600">
                      Rate of change
                    </p>
                    <p className="mt-1 text-xs text-slate-200">
                      {typeof latestRiver?.discharge_rate_m3s_per_hour ===
                      "number"
                        ? `${latestRiver.discharge_rate_m3s_per_hour >= 0 ? "+" : ""}${latestRiver.discharge_rate_m3s_per_hour.toFixed(
                            2,
                          )} m³/s/hr`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">
                      Latest Rainfall Signal
                    </h3>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Event-date rainfall unavailable; latest pipeline score shown above
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-medium ${levelColor(
                      latestRainfall?.hazard_category ||
                        latestRainfall?.risk_category,
                    )}`}
                  >
                    {latestRainfall?.hazard_category ||
                      latestRainfall?.risk_category ||
                      "—"}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] uppercase text-slate-600">
                      District
                    </p>
                    <p className="mt-1 text-xs text-slate-200">
                      {latestRainfall?.District || "Chamoli"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] uppercase text-slate-600">
                      Daily actual
                    </p>
                    <p className="mt-1 text-xs text-slate-200">
                      {typeof latestRainfall?.["Daily Actual"] === "number"
  ? `${latestRainfall["Daily Actual"].toFixed(1)} mm`
  : "No event-date observation"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] uppercase text-slate-600">
                      Daily normal
                    </p>
                    <p className="mt-1 text-xs text-slate-200">
                      {typeof latestRainfall?.["Daily Normal"] === "number"
  ? `${latestRainfall["Daily Normal"].toFixed(1)} mm`
  : "Not available"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] uppercase text-slate-600">
                      Departure
                    </p>
                    <p className="mt-1 text-xs text-slate-200">
                      {latestRainfall?.["Daily Departure Per"] !== undefined &&
latestRainfall?.["Daily Departure Per"] !== null
  ? `${latestRainfall["Daily Departure Per"]}%`
  : "Not available"}
                    </p>
                  </div>
                </div>
              </div>
            </div> */}

            {/* EVENT / SATELLITE EVIDENCE */}
            <div className="mt-5 rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-600">
                    Event / Post-event Evidence
                  </p>

                  <h3 className="mt-1 text-sm font-medium">
                    Satellite Analysis Details
                  </h3>

                  <p className="mt-1 text-[10px] leading-4 text-slate-500">
                    Supporting satellite evidence from the TRINETRA event analysis dataset.
                    It is not presented as an independent flood confirmation.
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[9px] uppercase text-slate-600">
                    Event
                  </p>

                  <p className="mt-1 text-xs text-slate-300">
                    {formatDate(eventEvidence?.event_time || FALLBACK_DATE)}
                  </p>
                </div>
              </div>


              {/* TWO SATELLITE ANALYSIS IMAGES */}
              <div className="mt-5 grid grid-cols-2 gap-4">

                {/* SENTINEL-2 */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-medium text-slate-300">
                      Sentinel-2 Optical Analysis
                    </h4>

                    <span className="text-[9px] text-slate-600">
                      EVENT OUTPUT
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-md border border-[#1c3038] bg-[#101d20]">
                    <img
                      src="/satellite/lambagarh_sentinel2_optical.png"
                      alt="Sentinel-2 Optical Evidence — Lambagarh Event"
                      className="block h-auto w-full"
                    />
                  </div>
                </div>


                {/* SENTINEL-1 */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-medium text-slate-300">
                      Sentinel-1 SAR Analysis
                    </h4>

                    <span className="text-[9px] text-slate-600">
                      EVENT OUTPUT
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-md border border-[#1c3038] bg-[#101d20]">
                    <img
                      src="/satellite/lambagarh_sentinel1_sar.png"
                      alt="Sentinel-1 SAR Analysis — Lambagarh Event"
                      className="block h-auto w-full"
                    />
                  </div>
                </div>

              </div>


              {/* THIRD IMAGE — REPLACES EVIDENCE SUMMARY */}
              <div className="mt-5">

                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-base font-medium text-slate-300">
                    Satellite Evidence Result
                  </h4>

                  <span className="text-[9px] text-slate-600">
                    EVIDENCE OUTPUT
                  </span>
                </div>

                <div className="overflow-hidden rounded-md border border-[#1c3038] bg-[#101d20]">
                  <img
                    src="/satellite/lambagarh_satellite_evidence_result.png"
                    alt="Satellite Evidence Result — Lambagarh Event"
                    className="block h-auto w-full"
                  />
                </div>

              </div>

            </div>

            {/* EVENT / SATELLITE EVIDENCE */}
            {/* <div className="mt-5 rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-600">
                    Event / Post-event Evidence
                  </p>
                  <h3 className="mt-1 text-sm font-medium">Satellite Analysis Details</h3>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">
                    Supporting satellite evidence from the TRINETRA event analysis dataset.
                    It is not presented as an independent flood confirmation.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase text-slate-600">Event</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {formatDate(eventEvidence?.event_time || FALLBACK_DATE)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-md border border-[#1c3038] bg-[#0a151b] p-4">
                  <p className="text-xs font-medium text-slate-200">Sentinel-2 Optical Evidence</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] uppercase text-slate-600">Candidate New Water</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {typeof eventEvidence?.sentinel2_candidate_new_water_ha === "number" ? `${eventEvidence.sentinel2_candidate_new_water_ha.toFixed(2)} ha` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-slate-600">Net Water-Area Change</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {typeof eventEvidence?.sentinel2_net_water_change_ha === "number" ? `${eventEvidence.sentinel2_net_water_change_ha.toFixed(2)} ha` : "—"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] leading-4 text-slate-600">
                    Cloud-masked optical imagery with MNDWI-based candidate water mapping.
                  </p>
                </div>

                <div className="rounded-md border border-[#1c3038] bg-[#0a151b] p-4">
                  <p className="text-xs font-medium text-slate-200">Sentinel-1 SAR Evidence</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] uppercase text-slate-600">Mean VV Backscatter Change</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {typeof eventEvidence?.sentinel1_mean_vv_change_db === "number" ? `${eventEvidence.sentinel1_mean_vv_change_db >= 0 ? "+" : ""}${eventEvidence.sentinel1_mean_vv_change_db.toFixed(2)} dB` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-slate-600">Candidate New SAR Water</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">
                        {typeof eventEvidence?.sentinel1_candidate_new_water_ha === "number" ? `${eventEvidence.sentinel1_candidate_new_water_ha.toFixed(4)} ha` : "—"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] leading-4 text-slate-600">
                    Sentinel-1 ascending-orbit VV before/after comparison; less affected by cloud cover.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-medium text-slate-300">Sentinel-1 SAR Analysis</h4>
                    <span className="text-[9px] text-slate-600">EVENT OUTPUT</span>
                  </div>
                  <div className="overflow-hidden rounded-md border border-[#1c3038] bg-[#101d20]">
                    <img
                      src="/satellite/sentinel1_sar_analysis.png"
                      alt="Sentinel-1 SAR analysis"
                      className="block h-auto w-full"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-medium text-slate-300">Sentinel-2 Optical Analysis</h4>
                    <span className="text-[9px] text-slate-600">EVENT OUTPUT</span>
                  </div>
                  <div className="overflow-hidden rounded-md border border-[#1c3038] bg-[#101d20]">
                    <img
                      src="/satellite/sentinel2_optical_analysis.png"
                      alt="Sentinel-2 Optical analysis"
                      className="block h-auto w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-md border border-cyan-400/10 bg-cyan-400/5 p-4">
                <p className="text-[9px] uppercase tracking-wider text-cyan-300">Evidence Summary</p>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                  <div><span className="text-slate-500">TRINETRA combined hazard:</span> <span className="text-slate-200">{scoreOf(eventEvidence?.trinetra_hazard_score)} / 100</span></div>
                  <div><span className="text-slate-500">Hydrological risk:</span> <span className="text-slate-200">{scoreOf(eventEvidence?.hydrological_risk_score)} / 100</span></div>
                  <div><span className="text-slate-500">DEM terrain hazard:</span> <span className="text-slate-200">{scoreOf(eventEvidence?.terrain_hazard_score)} / 100</span></div>
                  <div><span className="text-slate-500">Satellite evidence score:</span> <span className="text-slate-200">{scoreOf(eventEvidence?.satellite_evidence_score)} / 100</span></div>
                  <div className="col-span-2"><span className="text-slate-500">Interpretation:</span> <span className="text-slate-300">{eventEvidence?.system_interpretation || eventEvidence?.satellite_status || "Supporting evidence should be cross-checked with hydrology and terrain."}</span></div>
                </div>
              </div>
            </div> */}

            {/* SENTINEL TABLE */}
            <div className="mt-5 rounded-lg border border-[#1c3038] bg-[#0d1920]">
              <div className="flex items-center justify-between border-b border-[#1c3038] px-4 py-3">
                <div>
                  <h3 className="text-sm font-medium">
                    Recent Sentinel-1 Products
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Copernicus catalogue metadata returned by the backend
                  </p>
                </div>

                <span className="text-[10px] text-cyan-300">
                  {satellites.length} returned
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-[#1c3038]">
                    <tr className="text-[9px] uppercase tracking-wider text-slate-600">
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Acquisition</th>
                      <th className="px-4 py-3 font-medium">Published</th>
                      <th className="px-4 py-3 font-medium">Sensor</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#1c3038]">
                    {satelliteRows.map((product, index) => (
                      <tr
                        key={product.Id || index}
                        className="hover:bg-white/[0.02]"
                      >
                        <td className="max-w-[420px] truncate px-4 py-3 text-xs text-slate-200">
                          {product.Name || "Sentinel-1 product"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {formatDate(product.ContentDate?.Start)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDate(product.PublicationDate)}
                        </td>
                        <td className="px-4 py-3 text-xs text-cyan-300">
                          SENTINEL-1 · SAR
                        </td>
                      </tr>
                    ))}

                    {!loading && satelliteRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-xs text-slate-600"
                        >
                          No Sentinel-1 products returned.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* INTERPRETATION */}
            <div className="mt-5 grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[9px] uppercase tracking-wider text-slate-600">
                  Sentinel-1
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  Weather-resistant surface observation
                </p>
                <p className="mt-1 text-[10px] leading-4 text-slate-600">
                  Current backend integration provides Copernicus catalogue
                  products for the configured AOI.
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[9px] uppercase tracking-wider text-slate-600">
                  Hydrology
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  CWC discharge + anomaly features
                </p>
                <p className="mt-1 text-[10px] leading-4 text-slate-600">
                  River observations include discharge, rate-of-change,
                  anomaly and hybrid hazard fields.
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[9px] uppercase tracking-wider text-slate-600">
                  Interpretation
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  Evidence, not automatic disaster confirmation
                </p>
                <p className="mt-1 text-[10px] leading-4 text-slate-600">
                  Satellite change should be cross-checked with rainfall,
                  river, terrain and location context.
                </p>
              </div>
            </div>

            {/* FOOTER */}
            <div className="mt-5 flex items-center justify-between border-t border-[#1c3038] pt-4">
              <p className="text-[9px] text-slate-600">
                TRINETRA · Upstream Intelligence
              </p>
              <p className="text-[9px] text-slate-600">
                Live feeds from /api/hazards · Event evidence from /api/event-evidence
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}