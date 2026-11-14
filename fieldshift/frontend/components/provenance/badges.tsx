import {
  AlertTriangle, Calculator, CircleHelp, Cpu, Database, Droplet, Eye, FlaskConical, Shapes, ShieldCheck, OctagonAlert,
  BatteryFull, BatteryLow, BatteryMedium, Snowflake, Store, Thermometer, Upload, WifiOff, Wind, Repeat, Shuffle, ClipboardList, Satellite,
  Info, CloudRain, type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { CONFIDENCE_LABELS, LABEL_INFO, LEVEL_LABELS, ORIGIN_HELP, ORIGIN_LABELS, SEVERITY_LABELS } from "@/lib/format";
import type { Confidence, DataLabel, Level, OriginStatus, Severity } from "@/types/api";

const ORIGIN_ICON: Record<OriginStatus, LucideIcon> = {
  live: Satellite, cached: Database, sample: FlaskConical, uploaded: Upload, mock: Shapes, demo: WifiOff,
};
const ORIGIN_TONE: Record<OriginStatus, BadgeProps["variant"]> = {
  live: "cultivo", cached: "agua", uploaded: "agua", sample: "tierra", mock: "tierra", demo: "alerta",
};

/** Origen del dato: siempre ícono + texto en mayúsculas (DATO NASA EN VIVO / CACHEADO / DE MUESTRA...). */
export function OriginBadge({ status, label }: { status: OriginStatus; label?: string | null }) {
  const Icon = ORIGIN_ICON[status] ?? Info;
  return (
    <Badge variant={ORIGIN_TONE[status] ?? "outline"} title={ORIGIN_HELP[status]}>
      <Icon aria-hidden />
      <span className="uppercase tracking-wide">{label ?? ORIGIN_LABELS[status] ?? status}</span>
    </Badge>
  );
}

const LABEL_ICON: Record<DataLabel, LucideIcon> = { observado: Eye, modelado: Cpu, estimado: Calculator, supuesto: CircleHelp };
const LABEL_TONE: Record<DataLabel, BadgeProps["variant"]> = { observado: "cultivo", modelado: "agua", estimado: "secondary", supuesto: "tierra" };

/** Tipo de dato: observado, modelado, estimado o supuesto. */
export function LabelBadge({ label }: { label: DataLabel }) {
  const Icon = LABEL_ICON[label];
  return (
    <Badge variant={LABEL_TONE[label]} title={LABEL_INFO[label].help}>
      <Icon aria-hidden />
      {LABEL_INFO[label].text}
    </Badge>
  );
}

const RISK_ICON: Record<Level, LucideIcon> = { bajo: ShieldCheck, medio: AlertTriangle, alto: OctagonAlert };
const RISK_TONE: Record<Level, BadgeProps["variant"]> = { bajo: "cultivo", medio: "tierra", alto: "alerta" };

/** Nivel de riesgo: ícono distinto por nivel y la palabra escrita. Nunca solo color. */
export function RiskLevelBadge({ level, prefix = "Riesgo" }: { level: Level | null | undefined; prefix?: string }) {
  if (!level) return null;
  const Icon = RISK_ICON[level];
  return (
    <Badge variant={RISK_TONE[level]}>
      <Icon aria-hidden />
      {prefix} {LEVEL_LABELS[level].toLowerCase()}
    </Badge>
  );
}

const CONF_ICON: Record<Confidence, LucideIcon> = { alta: BatteryFull, media: BatteryMedium, baja: BatteryLow };

export function ConfidenceBadge({ level }: { level: Confidence }) {
  const Icon = CONF_ICON[level];
  return (
    <Badge variant="outline" title="Qué tan confiable es el resultado según la calidad de los datos disponibles.">
      <Icon aria-hidden />
      {CONFIDENCE_LABELS[level]}
    </Badge>
  );
}

const FLAG_ICON: Record<string, LucideIcon> = {
  droplet: Droplet, thermometer: Thermometer, snowflake: Snowflake, wind: Wind, repeat: Repeat, shuffle: Shuffle, store: Store,
  "clipboard-list": ClipboardList, "help-circle": CircleHelp, "alert-triangle": AlertTriangle, "cloud-rain": CloudRain,
};
export const flagIcon = (name: string): LucideIcon => FLAG_ICON[name] ?? AlertTriangle;

const SEV_TONE: Record<Severity, BadgeProps["variant"]> = { info: "agua", media: "tierra", alta: "alerta" };
const SEV_ICON: Record<Severity, LucideIcon> = { info: Info, media: AlertTriangle, alta: OctagonAlert };

export function SeverityBadge({ severity }: { severity: Severity }) {
  const Icon = SEV_ICON[severity];
  return (
    <Badge variant={SEV_TONE[severity]}>
      <Icon aria-hidden />
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}
