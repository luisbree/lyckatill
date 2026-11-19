export type SeasonId = "primavera" | "verano" | "otono" | "invierno";

export interface SeasonTheme {
  id: SeasonId;
  label: string;
  emoji: string;
  pageBg: string;
  badge: string;
  cardBorder: string;
  tableHeader: string;
  primaryButton: string;
  cabezaBadge: string;
  atrasadoRow: string;
  atrasadoBadge: string;
  atrasadoPill: string;
  atrasadoCardHighlight: string;
  candidatoBadge: string;
  ecoBadge: string;
}

export const SEASON_THEMES: Record<SeasonId, SeasonTheme> = {
  primavera: {
    id: "primavera",
    label: "Primavera",
    emoji: "🌸",
    pageBg:
      "bg-gradient-to-b from-emerald-50/90 via-rose-50/40 to-amber-50/50 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-rose-950/20",
    badge:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800",
    cardBorder: "border-emerald-200/80 dark:border-emerald-900/60",
    tableHeader: "bg-emerald-50/80 dark:bg-emerald-950/40",
    primaryButton:
      "bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500",
    cabezaBadge:
      "bg-emerald-700 text-white dark:bg-emerald-500 dark:text-zinc-950",
    atrasadoRow:
      "border-t-2 border-rose-200 bg-gradient-to-r from-rose-50/80 via-amber-50/70 to-emerald-50/70 dark:border-rose-900/60 dark:from-rose-950/30 dark:via-amber-950/20 dark:to-emerald-950/20",
    atrasadoBadge:
      "bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-md shadow-rose-500/25 ring-2 ring-rose-300/80 dark:ring-rose-700/80",
    atrasadoPill:
      "bg-gradient-to-r from-rose-600 to-amber-500 text-white shadow-sm",
    atrasadoCardHighlight:
      "bg-gradient-to-r from-rose-100 to-amber-100 border border-rose-300 text-rose-950 dark:from-rose-950/60 dark:to-amber-950/50 dark:border-rose-700 dark:text-rose-100",
    candidatoBadge:
      "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/20 ring-2 ring-violet-300/80 dark:ring-violet-700/80",
    ecoBadge:
      "bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-md shadow-cyan-500/20 ring-2 ring-cyan-300/80 dark:ring-cyan-700/80",
  },
  verano: {
    id: "verano",
    label: "Verano",
    emoji: "☀️",
    pageBg:
      "bg-gradient-to-b from-sky-50/90 via-amber-50/50 to-teal-50/50 dark:from-sky-950/30 dark:via-zinc-950 dark:to-amber-950/20",
    badge:
      "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-800",
    cardBorder: "border-sky-200/80 dark:border-sky-900/60",
    tableHeader: "bg-sky-50/80 dark:bg-sky-950/40",
    primaryButton:
      "bg-sky-700 text-white hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500",
    cabezaBadge: "bg-sky-700 text-white dark:bg-sky-500 dark:text-zinc-950",
    atrasadoRow:
      "border-t-2 border-amber-200 bg-gradient-to-r from-amber-50/80 via-sky-50/60 to-teal-50/70 dark:border-amber-900/60 dark:from-amber-950/30 dark:via-sky-950/20 dark:to-teal-950/20",
    atrasadoBadge:
      "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-300/80 dark:ring-amber-700/80",
    atrasadoPill:
      "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm",
    atrasadoCardHighlight:
      "bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-300 text-amber-950 dark:from-amber-950/60 dark:to-orange-950/50 dark:border-amber-700 dark:text-amber-100",
    candidatoBadge:
      "bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/20 ring-2 ring-teal-300/80 dark:ring-teal-700/80",
    ecoBadge:
      "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/20 ring-2 ring-indigo-300/80 dark:ring-indigo-700/80",
  },
  otono: {
    id: "otono",
    label: "Otoño",
    emoji: "🍂",
    pageBg:
      "bg-gradient-to-b from-amber-50/90 via-orange-50/40 to-stone-100/60 dark:from-amber-950/30 dark:via-zinc-950 dark:to-orange-950/20",
    badge:
      "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800",
    cardBorder: "border-amber-200/80 dark:border-amber-900/60",
    tableHeader: "bg-amber-50/80 dark:bg-amber-950/40",
    primaryButton:
      "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500",
    cabezaBadge:
      "bg-amber-700 text-white dark:bg-amber-500 dark:text-zinc-950",
    atrasadoRow:
      "border-t-2 border-orange-200 bg-gradient-to-r from-orange-50/80 to-amber-50/80 dark:border-orange-900/60 dark:from-orange-950/30 dark:to-amber-950/20",
    atrasadoBadge:
      "bg-gradient-to-br from-orange-600 to-red-500 text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-300/80 dark:ring-orange-700/80",
    atrasadoPill:
      "bg-gradient-to-r from-orange-600 to-red-500 text-white shadow-sm",
    atrasadoCardHighlight:
      "bg-gradient-to-r from-orange-100 to-red-100 border border-orange-300 text-orange-950 dark:from-orange-950/60 dark:to-red-950/50 dark:border-orange-700 dark:text-orange-100",
    candidatoBadge:
      "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 ring-2 ring-emerald-300/80 dark:ring-emerald-700/80",
    ecoBadge:
      "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/20 ring-2 ring-purple-300/80 dark:ring-purple-700/80",
  },
  invierno: {
    id: "invierno",
    label: "Invierno",
    emoji: "❄️",
    pageBg:
      "bg-gradient-to-b from-slate-100 via-sky-50/40 to-indigo-50/50 dark:from-slate-950 dark:via-zinc-950 dark:to-indigo-950/30",
    badge:
      "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800",
    cardBorder: "border-indigo-200/80 dark:border-indigo-900/60",
    tableHeader: "bg-indigo-50/80 dark:bg-indigo-950/40",
    primaryButton:
      "bg-indigo-700 text-white hover:bg-indigo-800 dark:bg-indigo-600 dark:hover:bg-indigo-500",
    cabezaBadge:
      "bg-indigo-700 text-white dark:bg-indigo-500 dark:text-zinc-950",
    atrasadoRow:
      "border-t-2 border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-sky-50/80 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-sky-950/20",
    atrasadoBadge:
      "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-indigo-300/80 dark:ring-indigo-700/80",
    atrasadoPill:
      "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm",
    atrasadoCardHighlight:
      "bg-gradient-to-r from-indigo-100 to-violet-100 border border-indigo-300 text-indigo-950 dark:from-indigo-950/60 dark:to-violet-950/50 dark:border-indigo-700 dark:text-indigo-100",
    candidatoBadge:
      "bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md shadow-sky-500/20 ring-2 ring-sky-300/80 dark:ring-sky-700/80",
    ecoBadge:
      "bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/20 ring-2 ring-teal-300/80 dark:ring-teal-700/80",
  },
};

/**
 * Determina la estación del hemisferio sur a partir de una fecha YYYY-MM-DD.
 * Si no se pasa fecha, devuelve "primavera" por defecto.
 */
export function getSeasonFromFecha(fecha?: string): SeasonId {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return "primavera";
  }

  const [, mesStr, diaStr] = fecha.split("-");
  const mmdd = Number(mesStr) * 100 + Number(diaStr);

  if (mmdd >= 921 && mmdd <= 1220) return "primavera";
  if (mmdd >= 1221 || mmdd <= 320) return "verano";
  if (mmdd >= 321 && mmdd <= 620) return "otono";
  return "invierno";
}

