import { tr, type T } from "./i18n";

// Las funciones reciben t opcional: los componentes de servidor pasan el suyo (getT()).

/** Aviso general. Se arma al usarse, en el idioma elegido. */
export const disclaimer = (t: T = tr) =>
  t(
    "AgroOrbit es una herramienta de apoyo a decisiones. No reemplaza el asesoramiento de un ingeniero agrónomo, " +
      "análisis de suelo de laboratorio, conocimiento local ni decisiones comerciales del productor.",
    "AgroOrbit is a decision-support tool. It does not replace advice from an agronomist, " +
      "a laboratory soil test, local knowledge or the farmer's business decisions.",
  );

export const demoNotice = (t: T = tr) =>
  t(
    "MODO DEMOSTRACIÓN: no hay conexión con el servidor de AgroOrbit. Se muestran datos de ejemplo simulados; " +
      "no son observaciones de tu campo.",
    "DEMO MODE: there is no connection to the AgroOrbit server. Simulated sample data is shown; " +
      "these are not observations of your field.",
  );
