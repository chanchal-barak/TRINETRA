import os
import math

import pandas as pd

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient

from backend.services.river import (
    get_latest_river,
    refresh_river,
)

from backend.services.rainfall import (
    get_latest_rainfall,
    refresh_rainfall,
)

from backend.services.satellite import (
    get_latest_satellite,
    refresh_satellite,
)

from backend.services.terrain import (
    get_latest_terrain,
    refresh_terrain,
)

from backend.services.hazard_zones import (
    get_hazard_zones,
)

from backend.services.settlement_risk import (
    get_settlement_risk,
)

from backend.services.relocation import (
    refresh_relocation_data,
    get_relocation_summary,
    get_top_relocations,
    get_relocation_decisions,
    get_safe_sites,
)


# ============================================================
# CONFIG
# ============================================================

load_dotenv()

app = FastAPI(title="TRINETRA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"
                   "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MONGODB
# ============================================================

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB", "trinetra")

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB]


# ============================================================
# HELPERS
# ============================================================

FINAL_EVENT_OUTPUT = (
    "data/outputs/trinetra_event_dashboard_data.csv"
)


def clean(data):
    """
    Recursively convert NaN / infinite values to None
    so FastAPI can safely serialize the response.
    """

    if isinstance(data, list):
        return [clean(x) for x in data]

    if isinstance(data, dict):
        return {
            key: clean(value)
            for key, value in data.items()
        }

    if isinstance(data, float):
        if not math.isfinite(data):
            return None

    return data


def optional_float(value):
    """
    Convert a value to float while preserving missing values
    as None.

    IMPORTANT:
    Missing hazard data must NOT become 0.
    """

    try:
        if pd.isna(value):
            return None

        number = float(value)

        if not math.isfinite(number):
            return None

        return number

    except (TypeError, ValueError):
        return None


def safe_float(value, default=0.0):
    """
    Convert a value to float.

    Used only for fields where a fallback of zero is
    semantically safe.
    """

    try:
        if pd.isna(value):
            return default

        number = float(value)

        if not math.isfinite(number):
            return default

        return number

    except (TypeError, ValueError):
        return default


def safe_bool(value, default=False):
    """
    Safely convert CSV values to boolean.
    """

    if isinstance(value, bool):
        return value

    if pd.isna(value):
        return default

    value = str(value).strip().lower()

    if value in {"true", "1", "yes", "y"}:
        return True

    if value in {"false", "0", "no", "n"}:
        return False

    return default


def clean_string(value, default=""):
    """
    Safely convert a value to a string while preserving
    missing values as the supplied default.
    """

    if pd.isna(value):
        return default

    return str(value)


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    try:

        client.admin.command("ping")

        return {
            "status": "ok",
            "mongodb": "connected",
        }

    except Exception as e:

        return {
            "status": "error",
            "mongodb": str(e),
        }


# ============================================================
# API STATUS
# ============================================================

@app.get("/api/status")
def api_status():

    return {
        "project": "TRINETRA",
        "backend": "online",
        "mongodb": "connected",
    }


# ============================================================
# HAZARDS
# ============================================================

@app.get("/api/hazards")
def get_hazards():

    return clean({
        "status": "ok",
        "river": get_latest_river(),
        "rainfall": get_latest_rainfall(),
        "satellite": get_latest_satellite(),
        "terrain": get_latest_terrain(),
    })


# ============================================================
# REFRESH ALL
# ============================================================

@app.post("/api/refresh")
def refresh_all():

    return {
        "status": "ok",
        "river": refresh_river(),
        "rainfall": refresh_rainfall(),
        "satellite": refresh_satellite(),
        "terrain": refresh_terrain(),
    }


# ============================================================
# FINAL TRINETRA MVP RESULT
# ============================================================

@app.get("/api/trinetra")
def trinetra_result():

    """
    Return the final event-level TRINETRA MVP result.

    The endpoint reads the already-generated final event
    dashboard CSV.

    Overall TRINETRA formula:

        H = 0.40 * River
          + 0.30 * Rainfall
          + 0.30 * Terrain

    Landslide remains a separate hazard layer.

    If River, Rainfall, or Terrain is unavailable for the
    selected event, the overall result remains PARTIAL.

    Missing values are NEVER converted to zero.
    """

    try:

        # ----------------------------------------------------
        # CHECK FINAL OUTPUT
        # ----------------------------------------------------

        if not os.path.exists(FINAL_EVENT_OUTPUT):

            return {
                "project": "TRINETRA",
                "status": "error",
                "message": (
                    "Final TRINETRA event output not found: "
                    f"{FINAL_EVENT_OUTPUT}"
                ),
            }

        # ----------------------------------------------------
        # LOAD FINAL EVENT OUTPUT
        # ----------------------------------------------------

        df = pd.read_csv(
            FINAL_EVENT_OUTPUT
        )

        if df.empty:

            return {
                "project": "TRINETRA",
                "status": "error",
                "message": (
                    "Final TRINETRA event output is empty"
                ),
            }

        # The current pipeline produces one selected event.
        row = df.iloc[0]

        # ----------------------------------------------------
        # EVENT INFORMATION
        # ----------------------------------------------------

        event_id = clean_string(
            row.get("event_id", "")
        )

        station_name = clean_string(
            row.get("station_name", "")
        )

        event_time = clean_string(
            row.get("event_time_ist", "")
        )

        event_date = clean_string(
            row.get("event_date", "")
        )

        district = clean_string(
            row.get("district", "")
        )

        latitude = optional_float(
            row.get("latitude")
        )

        longitude = optional_float(
            row.get("longitude")
        )

        # ----------------------------------------------------
        # COMPONENT SCORES
        # ----------------------------------------------------

        river_score = optional_float(
            row.get("river_risk_score_0_100")
        )

        rainfall_score = optional_float(
            row.get("rainfall_risk_score_0_100")
        )

        terrain_score = optional_float(
            row.get("terrain_hazard_score_0_100")
        )

        landslide_score = optional_float(
            row.get("landslide_hazard_score_0_100")
        )

        satellite_score = optional_float(
            row.get("satellite_evidence_score_0_100")
        )

        final_score = optional_float(
            row.get("trinetra_hazard_score_0_100")
        )

        # ----------------------------------------------------
        # COMPONENT LEVELS
        # ----------------------------------------------------

        river_level = clean_string(
            row.get(
                "river_risk_level",
                "UNKNOWN",
            ),
            "UNKNOWN",
        )

        rainfall_level = clean_string(
            row.get(
                "rainfall_risk_level",
                "PARTIAL",
            ),
            "PARTIAL",
        )

        terrain_level = clean_string(
            row.get(
                "terrain_hazard_level",
                "UNKNOWN",
            ),
            "UNKNOWN",
        )

        landslide_level = clean_string(
            row.get(
                "landslide_hazard_level",
                "UNKNOWN",
            ),
            "UNKNOWN",
        )

        final_level = clean_string(
            row.get(
                "trinetra_hazard_level",
                "UNKNOWN",
            ),
            "UNKNOWN",
        )

        satellite_class = clean_string(
            row.get(
                "satellite_evidence_class",
                "",
            )
        )

        satellite_status = clean_string(
            row.get(
                "satellite_evidence_status",
                "",
            )
        )

        # ----------------------------------------------------
        # AVAILABILITY
        # ----------------------------------------------------

        rainfall_available = safe_bool(
            row.get(
                "rainfall_available",
                False,
            )
        )

        # ----------------------------------------------------
        # RISK / ALERT
        # ----------------------------------------------------

        alert = final_level in {
            "HIGH",
            "CRITICAL",
        }

        # PARTIAL is intentionally NOT treated as an alert.
        if final_level == "PARTIAL":
            alert = False

        # ----------------------------------------------------
        # RAINFALL INFORMATION
        # ----------------------------------------------------

        rainfall_observations = safe_float(
            row.get(
                "rainfall_observations",
                0,
            ),
            0,
        )

        rainfall_max_mm = optional_float(
            row.get("rainfall_max_mm")
        )

        rainfall_mean_mm = optional_float(
            row.get("rainfall_mean_mm")
        )

        rainfall_start = clean_string(
            row.get(
                "rainfall_coverage_start",
                "",
            )
        )

        rainfall_end = clean_string(
            row.get(
                "rainfall_coverage_end",
                "",
            )
        )

        # ----------------------------------------------------
        # LANDSLIDE INFORMATION
        # ----------------------------------------------------

        landslide_max_score = optional_float(
            row.get(
                "landslide_hazard_max_score_0_100"
            )
        )

        landslide_probability_median = optional_float(
            row.get(
                "landslide_probability_median"
            )
        )

        landslide_probability_max = optional_float(
            row.get(
                "landslide_probability_max"
            )
        )

        landslide_slope_median = optional_float(
            row.get(
                "landslide_slope_median_deg"
            )
        )

        landslide_slope_max = optional_float(
            row.get(
                "landslide_slope_max_deg"
            )
        )

        landslide_elevation_median = optional_float(
            row.get(
                "landslide_elevation_median_m"
            )
        )

        landslide_cells = safe_float(
            row.get(
                "landslide_cells_used",
                0,
            ),
            0,
        )

        # ----------------------------------------------------
        # TERRAIN INFORMATION
        # ----------------------------------------------------

        terrain_max_score = optional_float(
            row.get(
                "terrain_hazard_max_score_0_100"
            )
        )

        terrain_slope_median = optional_float(
            row.get(
                "terrain_slope_median_deg"
            )
        )

        terrain_slope_max = optional_float(
            row.get(
                "terrain_slope_max_deg"
            )
        )

        terrain_elevation_median = optional_float(
            row.get(
                "terrain_elevation_median_m"
            )
        )

        terrain_cells = safe_float(
            row.get(
                "terrain_cells_used",
                0,
            ),
            0,
        )

        # ----------------------------------------------------
        # WEIGHTS
        # ----------------------------------------------------

        river_weight = optional_float(
            row.get(
                "river_weight",
                0.40,
            )
        )

        rainfall_weight = optional_float(
            row.get(
                "rainfall_weight",
                0.30,
            )
        )

        terrain_weight = optional_float(
            row.get(
                "terrain_weight",
                0.30,
            )
        )

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        response = {

            "project": "TRINETRA",

            "status": "ok",

            # Overall result
            "hazard_score": (
                round(final_score, 2)
                if final_score is not None
                else None
            ),

            "risk_level": final_level,

            "alert": alert,

            # ------------------------------------------------
            # COMPONENTS
            # ------------------------------------------------

            "components": {

                "river": {
                    "score": (
                        round(river_score, 2)
                        if river_score is not None
                        else None
                    ),
                    "level": river_level,
                    "weight": river_weight,
                },

                "rainfall": {
                    "score": (
                        round(rainfall_score, 2)
                        if rainfall_score is not None
                        else None
                    ),
                    "level": rainfall_level,
                    "weight": rainfall_weight,
                    "available": rainfall_available,
                },

                "terrain": {
                    "score": (
                        round(terrain_score, 2)
                        if terrain_score is not None
                        else None
                    ),
                    "level": terrain_level,
                    "weight": terrain_weight,
                },

                "landslide": {
                    "score": (
                        round(landslide_score, 2)
                        if landslide_score is not None
                        else None
                    ),
                    "level": landslide_level,
                },

                "satellite": {
                    "score": (
                        round(satellite_score, 2)
                        if satellite_score is not None
                        else None
                    ),
                    "class": satellite_class,
                    "status": satellite_status,
                },

            },

            # ------------------------------------------------
            # EVENT
            # ------------------------------------------------

            "event": {

                "event_id": event_id,

                "station_name": station_name,

                "event_time_ist": event_time,

                "event_date": event_date,

                "district": district,

                "latitude": latitude,

                "longitude": longitude,

                "rainfall_available":
                    rainfall_available,

                "rainfall_coverage_start":
                    rainfall_start,

                "rainfall_coverage_end":
                    rainfall_end,

            },

            # ------------------------------------------------
            # RAINFALL DETAILS
            # ------------------------------------------------

            "rainfall_details": {

                "observations":
                    rainfall_observations,

                "max_mm":
                    rainfall_max_mm,

                "mean_mm":
                    rainfall_mean_mm,

            },

            # ------------------------------------------------
            # TERRAIN DETAILS
            # ------------------------------------------------

            "terrain_details": {

                "max_score":
                    terrain_max_score,

                "slope_median_deg":
                    terrain_slope_median,

                "slope_max_deg":
                    terrain_slope_max,

                "elevation_median_m":
                    terrain_elevation_median,

                "cells_used":
                    terrain_cells,

            },

            # ------------------------------------------------
            # LANDSLIDE DETAILS
            # ------------------------------------------------

            "landslide_details": {

                "max_score":
                    landslide_max_score,

                "probability_median":
                    landslide_probability_median,

                "probability_max":
                    landslide_probability_max,

                "slope_median_deg":
                    landslide_slope_median,

                "slope_max_deg":
                    landslide_slope_max,

                "elevation_median_m":
                    landslide_elevation_median,

                "cells_used":
                    landslide_cells,

            },

            # ------------------------------------------------
            # SATELLITE DETAILS
            # ------------------------------------------------

            "satellite_details": {

                "score":
                    (
                        round(satellite_score, 2)
                        if satellite_score is not None
                        else None
                    ),

                "class":
                    satellite_class,

                "status":
                    satellite_status,

                "sentinel2_candidate_new_water_ha":
                    optional_float(
                        row.get(
                            "sentinel2_candidate_new_water_ha"
                        )
                    ),

                "sentinel2_net_water_change_ha":
                    optional_float(
                        row.get(
                            "sentinel2_net_water_change_ha"
                        )
                    ),

                "sentinel1_mean_vv_change_db":
                    optional_float(
                        row.get(
                            "sentinel1_mean_vv_change_db"
                        )
                    ),

                "sentinel1_candidate_new_water_ha":
                    optional_float(
                        row.get(
                            "sentinel1_candidate_new_water_ha"
                        )
                    ),

            },

            # ------------------------------------------------
            # DATA SOURCES
            # ------------------------------------------------

            "data_sources": {

                "river": "CWC",

                "rainfall":
                    "NWDP rainfall pipeline",

                "terrain":
                    "DEM",

                "landslide":
                    "DEM + landslide ML pipeline",

                "satellite":
                    "Copernicus Sentinel-1/Sentinel-2",

            },

        }

        return clean(response)

    except Exception as e:

        return {
            "project": "TRINETRA",
            "status": "error",
            "message": str(e),
        }


# ============================================================
# HAZARD ZONES
# ============================================================

@app.get("/api/hazard-zones")
def hazard_zones():

    return get_hazard_zones()


# ============================================================
# RELOCATION REFRESH
# ============================================================

@app.post("/api/relocation/refresh")
def refresh_relocation():

    return refresh_relocation_data()


# ============================================================
# SAFE SITES
# ============================================================

@app.get("/api/safe-sites")
def safe_sites(limit: int = 2000):

    return get_safe_sites(limit)


# ============================================================
# RELOCATION SUMMARY
# ============================================================

@app.get("/api/relocation/summary")
def relocation_summary():

    return get_relocation_summary()


# ============================================================
# TOP RELOCATIONS
# ============================================================

@app.get("/api/relocation/top")
def top_relocations(limit: int = 20):

    return get_top_relocations(limit)


# ============================================================
# RELOCATION DECISIONS
# ============================================================

@app.get("/api/relocation/decisions")
def relocation_decisions(limit: int = 20):

    return get_relocation_decisions(limit)


# ============================================================
# SETTLEMENT RISK
# ============================================================

@app.get("/api/risk/settlements")
def risk_settlements(limit: int = 8):

    return get_settlement_risk(limit)