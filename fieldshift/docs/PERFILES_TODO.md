# Separación de perfiles (huerta / agricultor) — estado

Objetivo: cada perfil usa solo los datos NASA cuya resolución le sirve. Huerta = pocos m² (solo NASA POWER +
pronóstico Open-Meteo). Agricultor = hectáreas (todo el stack, sin cambios).

## Hecho
1. ✅ Catálogo: campo `scale` (huerta|campo) en el esquema y los 16 cultivos; +12 hortalizas (Kc solo FAO-56, resto a validar, confianza baja). Overlay EN y tests.
2. ✅ `/crops` y `/crops/suitability` filtran por perfil/escala. Ningún perfil ve cultivos del otro. Frontend: `api.crops("campo"|"huerta")`.
3. ✅ Panel de huerta sin datos de campo: fuera NDVI (MODIS), ECOSTRESS y SMAP (también en las alertas de huerta). Queda POWER + pronóstico + imagen GIBS de contexto.
4. ✅ "Qué sembrar este mes" desde el catálogo (mes × heladas/calor POWER × tolerancia), con evidencia y sin "recomendado". Frase del goteo citada a INTA.
5. ✅ Rotación por familias para huerta (`GET /huerta/rotation`, INTA Pro-Huerta). Sin las 16 plantillas de campo.
6. ✅ Formulario propio de huerta (`components/field/field-form.tsx`, rama `isHuerta`): m² (se guarda como ha), tipo de tierra, tipo de riego, cultivo anterior; sin establecimiento, laboratorio ni pendiente. Estimación cualitativa de nutrientes (cultivo anterior + compost), rotulada "estimado: validá con análisis de suelo".

## Pendiente
7. ⏳ Navegación y control de acceso por perfil (`app/campo/[id]/page.tsx` → `PROFILES[perfil].home(id)`; pantallas de agricultor redirigen a "Mi huerta" si huerta; verificar `field-nav.tsx` y `field-tools-menu.tsx`).

## Supuestos / deuda
- El "tipo de riego" de huerta se guarda solo como `irrigated` (bool): el backend no tiene campo para el método (goteo/regadera/aspersión). El detalle queda en la UI. Pendiente: agregar `irrigation_method` al esquema si se quiere persistir.
- La estimación cualitativa de nutrientes de huerta es de UI (no se persiste salvo lo que el usuario cargue como materia orgánica). Es orientativa y está rotulada.
