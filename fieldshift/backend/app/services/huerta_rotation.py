"""Rotación de huerta por familias botánicas, armada desde el catálogo de hortalizas.

Reglas básicas de INTA Pro-Huerta (orientativas, a validar localmente): no repetir la misma familia en el
mismo cantero, aprovechar que las leguminosas fijan nitrógeno y dejar pasar temporadas antes de volver a una familia.
No son las 16 plantillas de rotación de campo.
"""

from __future__ import annotations

from app.i18n import tr
from app.schemas.huerta import HuertaFamilyGroup, HuertaRotationGuide

# familia botánica del catálogo -> (id de grupo, etiqueta es, etiqueta en)
_FAMILY_GROUP: dict[str, tuple[str, tuple[str, str]]] = {
    "solanacea": ("solanaceas", ("Solanáceas (frutos y papa)", "Nightshades (fruits and potato)")),
    "cucurbitacea": ("cucurbitaceas", ("Cucurbitáceas (frutos)", "Cucurbits (fruits)")),
    "leguminosa": ("leguminosas", ("Leguminosas (legumbres)", "Legumes")),
    "asteracea": ("hojas", ("Hojas", "Leafy greens")),
    "amarantacea": ("hojas", ("Hojas", "Leafy greens")),
    "apiacea": ("raices", ("Raíces", "Roots")),
    "aliacea": ("aliaceas", ("Aliáceas (bulbos)", "Alliums (bulbs)")),
}

# Orden sugerido en el cantero: las legumbres dejan nitrógeno para las hojas; después frutos y raíces.
_ORDER = ["leguminosas", "hojas", "solanaceas", "cucurbitaceas", "raices", "aliaceas"]

_GROUP_NOTE = {
    "leguminosas": ("Fijan nitrógeno: conviene ponerlas antes de las hojas, que piden mucho nitrógeno.",
                    "They fix nitrogen: put them before leafy greens, which need a lot of nitrogen."),
    "hojas": ("Piden bastante nitrógeno: van bien después de una leguminosa.",
              "They need fair nitrogen: they do well after a legume."),
    "solanaceas": ("Comparten plagas y enfermedades (y con la papa): dejá pasar varias temporadas antes de repetir.",
                   "They share pests and diseases (and with potato): let several seasons pass before repeating."),
    "cucurbitaceas": ("Ocupan mucho espacio y agotan el cantero: seguilas con una leguminosa u hojas.",
                      "They take up space and exhaust the bed: follow them with a legume or leafy greens."),
    "raices": ("Aflojan el suelo en profundidad: van bien después de las hojas.",
               "They loosen the soil deeper down: they do well after leafy greens."),
    "aliaceas": ("Poco exigentes: cierran bien la rotación antes de volver a empezar.",
                 "Not very demanding: they close the rotation well before starting over."),
}

_SOURCE = "INTA Pro-Huerta: rotación de cultivos en la huerta familiar (orientativo, a validar localmente)"


def huerta_rotation(crops) -> HuertaRotationGuide:
    """Agrupa las hortalizas del catálogo por familia y arma la guía de rotación."""
    groups: dict[str, HuertaFamilyGroup] = {}
    intervals: dict[str, list[int]] = {}
    for c in crops:
        if c.scale != "huerta":
            continue
        fam = _FAMILY_GROUP.get(c.family.value)
        if not fam:
            continue
        gid, (es, en) = fam
        intervals.setdefault(gid, [])
        if c.rotation and c.rotation.return_interval_years:
            intervals[gid].append(int(c.rotation.return_interval_years.min))
        if gid not in groups:
            note_es, note_en = _GROUP_NOTE[gid]
            groups[gid] = HuertaFamilyGroup(group_id=gid, label=tr(es, en), crops=[], return_interval_years=None,
                                            note=tr(note_es, note_en))
        groups[gid].crops.append(c.name)

    for gid, g in groups.items():
        g.return_interval_years = max(intervals[gid]) if intervals.get(gid) else None

    order = [gid for gid in _ORDER if gid in groups]
    rules = [
        tr("No sembrés la misma familia en el mismo cantero dos temporadas seguidas: acumula plagas y enfermedades del suelo.",
           "Do not plant the same family in the same bed two seasons in a row: it builds up soil pests and diseases."),
        tr("Después de una leguminosa (arveja, poroto) poné hojas: aprovechan el nitrógeno que dejó.",
           "After a legume (pea, bean) plant leafy greens: they use the nitrogen it left behind."),
        tr("Alterná familias que comen distinto y tienen raíces distintas (frutos, hojas, raíces, legumbres).",
           "Alternate families that feed differently and have different roots (fruits, leaves, roots, legumes)."),
        tr("Con las solanáceas (tomate, papa, pimiento) dejá pasar varias temporadas antes de repetirlas en el mismo lugar.",
           "With nightshades (tomato, potato, pepper) let several seasons pass before repeating them in the same spot."),
    ]
    return HuertaRotationGuide(groups=[groups[gid] for gid in order], order=order, rules=rules, source=_SOURCE)
