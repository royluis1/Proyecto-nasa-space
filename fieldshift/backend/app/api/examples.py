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
    "todas": {"summary": "Todas las rotaciones del lote", "value": {"field_id": "campo-este"}},
    "con_prioridades": {
        "summary": "Con prioridades propias",
        "value": {
            "field_id": "campo-este",
            "rotation_ids": ["campo-este-actual", "campo-este-agua", "campo-este-suelo"],
            "priorities": {"water": 9, "soil": 3, "risk": 5, "income": 5, "sustainability": 3},
        },
    },
}

SCENARIOS = {
    "seco_y_calor": {
        "summary": "Lluvia -20% y +1 °C",
        "value": {
            "field_id": "campo-centro",
            "scenarios": [
                {"id": "seco-20", "name": "Lluvia -20%", "rain_delta_pct": -20},
                {"id": "calor-1", "name": "+1 °C", "temp_delta_c": 1},
            ],
        },
    }
}
