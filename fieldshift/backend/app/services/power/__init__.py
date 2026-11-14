"""Integración con NASA POWER (API diaria por punto).

- parser.py   JSON de POWER -> DataFrame diario, -999 -> faltante
- units.py    verificación y conversión de unidades
- cache.py    caché en disco + memoria
- client.py   cliente HTTP con timeout y reintentos (httpx)
- sample.py   datos de muestra para funcionar sin red
- service.py  orquestación: caché -> en vivo -> caché vencida -> muestra
"""
