"use client";

import Image from "next/image";
import { CloudSun, Droplets, MapPin, RefreshCcw, Satellite, Sprout } from "lucide-react";
import { HeroAccount } from "@/components/home/hero-account";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/lang-provider";
import type { T } from "@/lib/i18n";
import campoAereo from "@/public/img/campo-aereo.jpg";

const OBJETIVOS = (t: T) => [
  {
    icon: Sprout,
    title: t("Recomendar cultivos", "Recommend crops"),
    text: t("Sugerimos qué sembrar según la zona de tu campo y la temporada.", "We suggest what to plant based on your field's area and the season."),
    tone: "bg-secondary text-primary",
  },
  {
    icon: RefreshCcw,
    title: t("Cuidar el suelo", "Care for the soil"),
    text: t("Mejoramos la salud del suelo con planes de rotación de cultivos.", "We improve soil health with crop rotation plans."),
    tone: "bg-accent/50 text-accent-foreground",
  },
  {
    icon: Droplets,
    title: t("Adaptarse al clima", "Adapt to the climate"),
    text: t("Ajustamos cada decisión al clima y al uso eficiente del agua.", "We fit every decision to the climate and efficient water use."),
    tone: "bg-sky-soft text-sky",
  },
];

export default function HomePage() {
  const t = useT();
  return (
    <div data-full-bleed>
      <section className="bg-hero">
        <div className="container grid grid-cols-1 gap-10 py-12 md:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* En el celular primero va el texto, para dar contexto */}
          <div className="animate-rise min-w-0 space-y-6 lg:order-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-primary shadow-soft">
              <MapPin aria-hidden className="size-3.5" /> San Luis, Argentina
            </span>
            <h1 className="text-4xl font-bold leading-[1.1] text-foreground sm:text-5xl">
              {t("Sembrá con datos,", "Plant with data,")} <span className="text-primary-glow">{t("no con dudas.", "not with doubts.")}</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              {t(
                "AgroOrbit ayuda a productores de San Luis a decidir qué sembrar usando datos satelitales de la NASA, clima y rotación de cultivos.",
                "AgroOrbit helps farmers in San Luis, Argentina, decide what to plant using NASA satellite data, weather and crop rotation.",
              )}
            </p>
            <div className="relative overflow-hidden rounded-3xl shadow-lift">
              <Image
                src={campoAereo}
                alt={t("Vista aérea de campos con riego por pivote (imagen ilustrativa)", "Aerial view of fields with center-pivot irrigation (illustrative image)")}
                className="aspect-[16/10] w-full object-cover"
                sizes="(min-width: 1024px) 560px, 100vw"
                priority
              />
              <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-2">
                {[
                  { icon: Satellite, label: t("Imágenes satelitales", "Satellite imagery") },
                  { icon: CloudSun, label: t("Pronóstico local", "Local forecast") },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur"
                  >
                    <Icon aria-hidden className="size-3.5 text-sky" /> {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 lg:order-1">
            <HeroAccount />
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-24" aria-labelledby="objetivos">
        <div className="mb-10 max-w-xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-glow">{t("Nuestros objetivos", "Our goals")}</p>
          <h2 id="objetivos" className="text-3xl font-bold sm:text-4xl">{t("Decisiones simples para un campo más sano", "Simple decisions for a healthier field")}</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {OBJETIVOS(t).map(({ icon: Icon, title, text, tone }, i) => (
            <Card key={title} className="transition-shadow hover:shadow-lift">
              <CardContent className="space-y-4 p-7">
                <div className="flex items-center justify-between">
                  <span className={cn("grid size-12 place-items-center rounded-2xl", tone)}>
                    <Icon aria-hidden className="size-6" />
                  </span>
                  <span aria-hidden className="font-display text-sm font-semibold text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="leading-relaxed text-muted-foreground">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
