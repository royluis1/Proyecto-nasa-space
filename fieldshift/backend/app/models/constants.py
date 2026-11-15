DISCLAIMER = (
    "AgroOrbit es una herramienta de apoyo a decisiones. No reemplaza el asesoramiento "
    "de un ingeniero agrónomo, análisis de suelo de laboratorio, conocimiento local ni "
    "decisiones comerciales del productor."
)

DISCLAIMER_EN = (
    "AgroOrbit is a decision-support tool. It does not replace advice from an agronomist, "
    "a laboratory soil test, local knowledge or the farmer's business decisions."
)


def disclaimer() -> str:
    """El aviso en el idioma del pedido."""
    from app.i18n import tr

    return tr(DISCLAIMER, DISCLAIMER_EN)
