 "use client";

import { useEffect, useMemo, useState } from "react";

type Source = {
  source: string;
  provider: string;
  type: string;
  update: string;
  coverage: string;
  use: string;
  status: "CONNECTED" | "REFERENCE";
};

type HazardResponse = {
  status?: string;
  river?: unknown[];
  rainfall?: unknown[];
  satellite?: unknown[];
  terrain?: unknown[];
};

const sourceRegistry: Source[] = [
  {
    source: "Sentinel-1 SAR",
    provider: "Copernicus / ESA",
    type: "Satellite",
    update: "Catalogue-based",
    coverage: "TRINETRA AOI",
    status: "CONNECTED",
    use: "SAR products and surface-change evidence",
  },
  {
    source: "Rainfall Hazard Pipeline",
    provider: "TRINETRA processed rainfall data",
    type: "Rainfall",
    update: "Daily",
    coverage: "Study corridor",
    status: "CONNECTED",
    use: "Rainfall accumulation, departure and hazard scoring",
  },
  {
    source: "CWC River Telemetry",
    provider: "Central Water Commission",
    type: "Hydrology",
    update: "Hourly",
    coverage: "Telemetry station data",
    status: "CONNECTED",
    use: "Discharge, rate-of-change and hydrological hazard scoring",
  },
  {
    source: "DEM Terrain Features",
    provider: "TRINETRA terrain pipeline",
    type: "Terrain",
    update: "Static / preprocessed",
    coverage: "Study corridor",
    status: "CONNECTED",
    use: "Terrain hazard and slope-related features",
  },
  {
    source: "SRTM DEM",
    provider: "NASA / USGS",
    type: "Terrain",
    update: "Static",
    coverage: "30 m",
    status: "REFERENCE",
    use: "Elevation and terrain-feature source",
  },
  {
    source: "NRSC Landslide Atlas",
    provider: "ISRO / NRSC",
    type: "Historical",
    update: "Periodic",
    coverage: "India",
    status: "REFERENCE",
    use: "Historical landslide inventory and labels",
  },
  {
    source: "Sentinel-2",
    provider: "Copernicus / ESA",
    type: "Satellite",
    update: "Catalogue / imagery",
    coverage: "Study corridor",
    status: "REFERENCE",
    use: "Optical vegetation, water and land-cover evidence",
  },
  {
    source: "CHIRPS Rainfall",
    provider: "Climate Hazards Center",
    type: "Rainfall",
    update: "Daily",
    coverage: "0.05°",
    status: "REFERENCE",
    use: "Rainfall observation source",
  },
  {
    source: "NRSC Historical Flood",
    provider: "ISRO / NRSC",
    type: "Historical",
    update: "Periodic",
    coverage: "India",
    status: "REFERENCE",
    use: "Historical flood inundation and exposure analysis",
  },
  {
    source: "Glacial Lake Atlas",
    provider: "ISRO / NRSC",
    type: "Inventory",
    update: "Baseline",
    coverage: "Himalayan region",
    status: "REFERENCE",
    use: "Glacial-lake baseline information",
  },
  {
    source: "ESA WorldCover",
    provider: "ESA / Copernicus",
    type: "Land Cover",
    update: "Annual",
    coverage: "10 m",
    status: "REFERENCE",
    use: "Land-use and suitability screening",
  },
  {
    source: "Census 2011",
    provider: "Government of India",
    type: "Population",
    update: "Historical",
    coverage: "Village level",
    status: "REFERENCE",
    use: "Population and vulnerability indicators",
  },
  {
    source: "OpenStreetMap",
    provider: "OpenStreetMap",
    type: "Infrastructure",
    update: "Variable",
    coverage: "Corridor",
    status: "REFERENCE",
    use: "Road, bridge and accessibility analysis",
  },
  {
    source: "WorldPop",
    provider: "WorldPop",
    type: "Population Grid",
    update: "Annual",
    coverage: "100 m",
    status: "REFERENCE",
    use: "Spatial population distribution",
  },
];

const pipeline = [
  {
    step: "01",
    title: "Acquire",
    description:
      "Collect available satellite, rainfall, hydrology and terrain observations.",
  },
  {
    step: "02",
    title: "Validate",
    description:
      "Check timestamps, missing values, spatial coverage and usable records.",
  },
  {
    step: "03",
    title: "Transform",
    description:
      "Convert observations into hazard and terrain features used by TRINETRA.",
  },
  {
    step: "04",
    title: "Model",
    description:
      "Combine validated hazard features into risk and decision-support outputs.",
  },
  {
    step: "05",
    title: "Decide",
    description:
      "Use risk, capacity and infrastructure information for response planning.",
  },
];

function countRecords(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function formatTime(value: unknown) {
  if (!value) return "Not available";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DataSourcesPage() {
  const [hazards, setHazards] = useState<HazardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSources() {
    try {
      setError("");
      const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/hazards`,
      {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();
      setHazards(data);
    } catch {
      setError(
        "Unable to load source telemetry. Check that FastAPI and MongoDB are running."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  const connectedCount = useMemo(
    () => sourceRegistry.filter((source) => source.status === "CONNECTED").length,
    []
  );

  const referenceCount = sourceRegistry.length - connectedCount;

  const liveRecords = useMemo(() => {
    if (!hazards) return 0;

    return (
      countRecords(hazards.river) +
      countRecords(hazards.rainfall) +
      countRecords(hazards.satellite) +
      countRecords(hazards.terrain)
    );
  }, [hazards]);

  return (
    <main className="min-h-screen bg-[#081016] text-white">
      <div className="flex min-h-screen">
        <aside className="w-[230px] shrink-0 border-r border-[#1c3038] bg-[#0b151b] px-4 py-5">
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
            <a href="/" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
              <span>⌂</span>
              Command Center
            </a>
            <a href="/upstream" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
              <span>◈</span>
              Upstream Intelligence
            </a>
            <a href="/risk" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
              <span>◆</span>
              Risk Intelligence
            </a>
            <a href="/safe-sites" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
              <span>⌂</span>
              Safe Sites
            </a>
            <a href="/relocation" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
              <span>⇄</span>
              Relocation
            </a>
          </nav>

          <p className="mb-3 mt-8 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
            System
          </p>

          <nav>
            <a href="/data-sources" className="flex items-center gap-3 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2.5 text-sm text-cyan-300">
              <span>▣</span>
              Data Sources
            </a>
          </nav>

          <div className="mt-12 rounded-md border border-[#1c3038] bg-[#0e1b22] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  error ? "bg-orange-400" : "bg-emerald-400"
                }`}
              />
              <span
                className={`text-xs ${
                  error ? "text-orange-300" : "text-emerald-300"
                }`}
              >
                {error ? "TELEMETRY DEGRADED" : "SYSTEM OPERATIONAL"}
              </span>
            </div>
            <p className="text-[10px] leading-4 text-slate-500">
              Source availability is shown separately from model confidence.
            </p>
          </div>
        </aside>

        <section className="flex-1">
          <header className="flex min-h-[68px] items-center justify-between border-b border-[#1c3038] bg-[#0b151b] px-6 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                System
              </p>
              <h2 className="mt-1 text-lg font-medium">Data Sources</h2>
              <p className="mt-1 text-xs text-slate-500">
                Source inventory, live feed status and processing pipeline
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-slate-600">
                  Primary AOI
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Joshimath → Vishnuprayag → Badrinath
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/5 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                <span className="text-xs text-cyan-300">
                  {loading ? "CHECKING DATA" : "DATA LAYER ACTIVE"}
                </span>
              </div>
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
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Source Catalogue
                </p>
                <p className="mt-2 text-4xl font-semibold text-cyan-300">
                  {sourceRegistry.length}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  documented data sources
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Integrated Feeds
                </p>
                <p className="mt-2 text-4xl font-semibold text-emerald-400">
                  {connectedCount}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  feeds represented in current API
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Reference Sources
                </p>
                <p className="mt-2 text-4xl font-semibold text-slate-300">
                  {referenceCount}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  catalogue / contextual sources
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-5">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  API Records
                </p>
                <p className="mt-2 text-4xl font-semibold text-cyan-300">
                  {loading ? "—" : liveRecords.toLocaleString()}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  records returned by live feeds
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-[#1c3038] bg-[#0d1920]">
              <div className="border-b border-[#1c3038] px-5 py-4">
                <h3 className="text-sm font-medium">TRINETRA Data Pipeline</h3>
                <p className="mt-1 text-[10px] text-slate-500">
                  From source observations to operational decisions
                </p>
              </div>

              <div className="grid grid-cols-5 gap-3 p-5">
                {pipeline.map((item, index) => (
                  <div
                    key={item.step}
                    className="relative rounded-md border border-[#1c3038] bg-[#0a151b] p-4"
                  >
                    <p className="text-[9px] font-semibold text-cyan-400">
                      {item.step}
                    </p>
                    <h4 className="mt-2 text-sm font-medium">{item.title}</h4>
                    <p className="mt-2 text-[10px] leading-5 text-slate-500">
                      {item.description}
                    </p>
                    {index < pipeline.length - 1 && (
                      <span className="absolute -right-3 top-1/2 z-10 text-cyan-400">
                        →
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-[#1c3038] bg-[#0d1920]">
              <div className="flex items-center justify-between border-b border-[#1c3038] px-4 py-4">
                <div>
                  <h3 className="text-sm font-medium">Source Registry</h3>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Integrated sources are separated from reference/contextual datasets
                  </p>
                </div>

                <span className="rounded border border-[#293d44] px-2 py-1 text-[9px] text-slate-500">
                  {connectedCount} INTEGRATED
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-[#1c3038]">
                    <tr className="text-[9px] uppercase tracking-wider text-slate-600">
                      <th className="px-4 py-3 font-medium">Source</th>
                      <th className="px-4 py-3 font-medium">Provider</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Update</th>
                      <th className="px-4 py-3 font-medium">Coverage</th>
                      <th className="px-4 py-3 font-medium">Used For</th>
                      <th className="px-4 py-3 text-right font-medium">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#1c3038]">
                    {sourceRegistry.map((source) => (
                      <tr
                        key={source.source}
                        className="hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-slate-200">
                            {source.source}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-500">
                          {source.provider}
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded border border-[#293d44] bg-[#101d23] px-2 py-1 text-[9px] text-slate-400">
                            {source.type}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-400">
                          {source.update}
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-400">
                          {source.coverage}
                        </td>

                        <td className="max-w-[300px] px-4 py-3 text-xs leading-5 text-slate-500">
                          {source.use}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <span
                            className={`rounded px-2 py-1 text-[9px] ${
                              source.status === "CONNECTED"
                                ? "bg-emerald-400/10 text-emerald-400"
                                : "bg-slate-400/10 text-slate-400"
                            }`}
                          >
                            {source.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Live vs Reference
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  A source is marked connected only when it is represented by
                  the current TRINETRA API/data pipeline. Reference sources are
                  not presented as live feeds.
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Data Validation
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  The backend cleans non-finite values before returning hazard
                  observations to the frontend.
                </p>
              </div>

              <div className="rounded-lg border border-[#1c3038] bg-[#0d1920] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Decision Readiness
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Validated hazard observations feed risk scoring, safe-site
                  screening and relocation decision support.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-cyan-300">
                    Primary Study Area
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    Joshimath → Vishnuprayag → Badrinath Corridor
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    30.50–30.80°N · 79.40–79.75°E
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[9px] text-slate-600">DATA POLICY</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Source availability is not the same as model confidence
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#1c3038] pt-4">
              <p className="text-[9px] text-slate-600">
                TRINETRA · Data Reliability Layer
              </p>
              <p className="text-[9px] text-slate-600">
                LIVE STATUS · Based on current API feeds
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
