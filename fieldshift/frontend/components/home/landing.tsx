"use client";

import Image from "next/image";
import { Droplets, RefreshCw, Sprout } from "lucide-react";
import { StartLink } from "@/components/layout/profile-chip";
import { useT } from "@/components/i18n/lang-provider";
import type { T } from "@/lib/i18n";
import heroImage from "@/public/img/hero-campo-san-luis.jpg";

// Portada del equipo (diseño y textos fijos). El español es el de referencia; el inglés lo acompaña por el idioma de la app.
const OBJETIVOS = (t: T) => [
  {
    n: "01",
    title: t("Recomendar cultivos", "Recommend crops"),
    text: t("Sugerimos qué sembrar según la zona de tu campo y la temporada.", "We suggest what to plant based on your field's area and the season."),
    Icon: Sprout,
    iconClass: "bg-icon-leaf text-icon-leaf-foreground",
  },
  {
    n: "02",
    title: t("Cuidar el suelo", "Care for the soil"),
    text: t("Mejoramos la salud del suelo con planes de rotación de cultivos.", "We improve soil health with crop rotation plans."),
    Icon: RefreshCw,
    iconClass: "bg-icon-cycle text-icon-cycle-foreground",
  },
  {
    n: "03",
    title: t("Adaptarse al clima", "Adapt to the climate"),
    text: t("Ajustamos cada decisión al clima y al uso eficiente del agua.", "We fit every decision to the climate and efficient water use."),
    Icon: Droplets,
    iconClass: "bg-icon-water text-icon-water-foreground",
  },
];

export function Landing() {
  const t = useT();
  return (
    <div data-full-bleed>
      {/* Portada */}
      <section id="inicio" className="relative isolate overflow-hidden">
        <Image
          src={heroImage}
          alt={t("Vista aérea de un campo con riego circular en San Luis al atardecer", "Aerial view of a field with center-pivot irrigation in San Luis at sunset")}
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div className="hero-overlay absolute inset-0 -z-10" aria-hidden />
        <div className="mx-auto flex min-h-[78vh] max-w-5xl flex-col items-center justify-center px-6 py-28 text-center text-hero-foreground">
          <h1 className="hero-text-shadow text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl">
            {t("Sembrar con datos, no con dudas", "Plant with data, not with doubts")}
          </h1>
          <p className="hero-text-shadow mt-6 max-w-2xl text-lg leading-relaxed text-hero-foreground/90 md:text-xl">
            {t(
              "AgroOrbit ayuda a productores de San Luis a decidir qué sembrar usando datos satelitales de la NASA, clima y rotación de cultivos.",
              "AgroOrbit helps farmers in San Luis decide what to plant using NASA satellite data, weather and crop rotation.",
            )}
          </p>
          <StartLink className="mt-10 rounded-full bg-primary px-12 py-4 text-lg font-semibold text-primary-foreground shadow-button transition-transform hover:-translate-y-0.5">
            {t("Empezar", "Get started")}
          </StartLink>
        </div>
      </section>

      {/* Nuestros objetivos */}
      <section id="objetivos" className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
          {t("Nuestros objetivos", "Our goals")}
        </p>
        <h2 className="mt-3 max-w-lg text-2xl font-bold leading-[1.15] md:text-3xl">
          {t("Decisiones simples para un campo más sano", "Simple decisions for a healthier field")}
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {OBJETIVOS(t).map(({ n, title, text, Icon, iconClass }) => (
            <article
              key={n}
              className="rounded-2xl border border-border bg-card p-7 shadow-card transition-transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <span className={`flex h-12 w-12 items-center justify-center rounded-full ${iconClass}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-display text-sm font-bold text-muted-foreground">{n}</span>
              </div>
              <h3 className="mt-6 text-xl font-bold">{title}</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
