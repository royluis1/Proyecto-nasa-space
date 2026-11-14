"""Ejemplos de request que aparecen en Swagger (/docs)."""

FIELD_CREATE = {
    "lote_san_luis": {
        "summary": "Lote en el este de San Luis",
        "value": {
            "name": "Lote Norte",
            "farm_name": "La Esperanza",
            "location": {"lat": -33.8512, "lon": -65.2034},
            "area_ha": 250,
            "irrigated": False,
            "soil_profile": {
                "texture": "franco_arenosa",
                "lab_analysis": False,
                "provenance": {"label": "estimado", "confidence": "baja", "note": "Declarado por el productor."},
            },
        },
    },
    "fuera_de_san_luis": {
        "summary": "Coordenada válida fuera de San Luis (devuelve advertencia)",
        "value": {"name": "Lote Pergamino", "location": {"lat": -33.89, "lon": -60.57}, "area_ha": 100},
    },
}

PRIORITIES = {
    "prioriza_agua": {
        "summary": "Productor que prioriza el agua",
        "value": {
            "field_id": "campo-este",
            "priorities": {"water": 9, "soil": 6, "risk": 7, "income": 5, "sustainability": 4},
        },
    }
}

CLIMATE = {
    "coordenadas": {
        "summary": "Por coordenadas, 2015-2025, sin serie diaria",
        "value": {
            "latitude": -33.85,
            "longitude": -65.2,
            "start_date": "2015-01-01",
            "end_date": "2025-12-31",
            "community": "AG",
            "include_daily": False,
        },
    },
    "lote": {
        "summary": "Por lote precargado, con serie diaria",
        "value": {"field_id": "campo-centro", "start_date": "2020-01-01", "end_date": "2024-12-31"},
    },
    "parametros": {
        "summary": "Solo parámetros básicos",
        "value": {
            "latitude": -32.45,
            "longitude": -65.25,
            "start_date": "2018-01-01",
            "end_date": "2023-12-31",
            "parameters": ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR"],
            "include_daily": False,
        },
    },
}

COMPARE = {
    "todas": {"summary": "Todas las estrategias, prioridades guardadas o por defecto", "value": {"field_id": "campo-este"}},
    "prioriza_agua_escenario_seco": {
        "summary": "Prioriza agua, con escenario seco y caluroso",
        "value": {
            "field_id": "campo-centro",
            "priorities": {"water": 9, "soil": 6, "risk": 7, "income": 4, "sustainability": 5},
            "scenario": {"id": "seco-20-calor-1", "name": "Lluvia -20 % y +1 °C", "rain_delta_pct": -20, "temp_delta_c": 1},
        },
    },
    "con_sensores_e_historial": {
        "summary": "Con humedad SMAP, NDVI e historial de monocultivo",
        "value": {
            "field_id": "campo-este",
            "history": ["maiz", "soja", "soja", "soja"],
            "soil_moisture": {"product": "SMAP_L3", "anomaly_pct": -25, "period": "2025-09 a 2025-11"},
            "vegetation": {"bare_soil_fraction": 0.55, "threshold": 0.3, "period": "2021-2025"},
        },
    },
    "algunas_estrategias": {
        "summary": "Solo algunas estrategias (la actual se incluye siempre)",
        "value": {"field_id": "campo-conlara", "strategies": ["conservadora", "agua", "rentabilidad"]},
    },
}

SCENARIOS = {
    "seco_y_calor": {
        "summary": "Lluvia -20% y +1 °C",
        "value": {
            "field_id": "campo-centro",
            "scenarios": [
                {"id": "base", "name": "Clima del período"},
                {"id": "seco-20", "name": "Lluvia -20%", "rain_delta_pct": -20},
                {"id": "calor-1", "name": "+1 °C", "temp_delta_c": 1},
                {"id": "anio-seco", "name": "Año más seco observado", "dry_year": True},
            ],
        },
    }
}

SOIL_MOISTURE = {
    "lote": {"summary": "Lote precargado, SMAP L4 en zona de raíces", "value": {"field_id": "campo-centro"}},
    "coordenadas": {
        "summary": "Por coordenadas, con la serie diaria",
        "value": {"latitude": -33.85, "longitude": -65.2, "start_date": "2020-01-01", "end_date": "2025-12-31", "include_series": True},
    },
    "csv": {
        "summary": "CSV propio (formato simple)",
        "value": {"latitude": -33.85, "longitude": -65.2, "start_date": "2024-01-01", "end_date": "2024-01-03",
                  "csv_content": "date,value\n2024-01-01,0.21\n2024-01-02,0.20\n2024-01-03,0.19\n"},
    },
}

VEGETATION = {
    "lote": {"summary": "Lote precargado, MOD13Q1 250 m", "value": {"field_id": "campo-este"}},
    "umbral": {
        "summary": "Con otro umbral de barbecho y la serie",
        "value": {"field_id": "campo-centro", "bare_threshold": 0.25, "include_series": True},
    },
}
