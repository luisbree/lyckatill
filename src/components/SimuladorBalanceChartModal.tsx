"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { LOTERIAS_CONFIG, TURNOS_CONFIG } from "@/lib/quiniela/config";
import type {
  EstrategiaSimulacion,
  SimulacionEvaluada,
} from "@/lib/quiniela/simulator";
import { TURNO_ORDER } from "@/lib/quiniela/stats";
import type { TurnoId } from "@/lib/quiniela/types";
import type { SeasonTheme } from "@/lib/theme/season";

interface SimuladorBalanceChartModalProps {
  open: boolean;
  onClose: () => void;
  simulaciones: SimulacionEvaluada[];
  theme: SeasonTheme;
}

export type ChartGroupMode = "jugada" | "turno";
export type ViewDisplayMode = "combinado" | "individual";
export type TraceKey = "total" | "candidatos" | "atrasados" | "eco" | "ambosAtrasados";

export interface ChartDataPoint {
  idx: number;
  label: string;
  sublabel: string;
  candidatos: number;
  atrasados: number;
  eco: number;
  ambosAtrasados: number;
  total: number;
  delta: number;
  play?: SimulacionEvaluada;
  playsCount?: number;
}

interface TraceMeta {
  key: TraceKey;
  label: string;
  color: string;
  strokeWidth: number;
  badgeBg: string;
  badgeText: string;
  borderBadge: string;
  dotColor: string;
}

export const TRACE_CONFIG: Record<TraceKey, TraceMeta> = {
  total: {
    key: "total",
    label: "Total acumulado",
    color: "#2563eb", // blue-600
    strokeWidth: 3.5,
    badgeBg: "bg-blue-50 dark:bg-blue-950/50",
    badgeText: "text-blue-800 dark:text-blue-300",
    borderBadge: "border-blue-300 dark:border-blue-800",
    dotColor: "bg-blue-600",
  },
  candidatos: {
    key: "candidatos",
    label: "Candidatos",
    color: "#8b5cf6", // violet-500
    strokeWidth: 2,
    badgeBg: "bg-violet-50 dark:bg-violet-950/50",
    badgeText: "text-violet-800 dark:text-violet-300",
    borderBadge: "border-violet-300 dark:border-violet-800",
    dotColor: "bg-violet-500",
  },
  atrasados: {
    key: "atrasados",
    label: "Más atrasados",
    color: "#f43f5e", // rose-500
    strokeWidth: 2,
    badgeBg: "bg-rose-50 dark:bg-rose-950/50",
    badgeText: "text-rose-800 dark:text-rose-300",
    borderBadge: "border-rose-300 dark:border-rose-800",
    dotColor: "bg-rose-500",
  },
  eco: {
    key: "eco",
    label: "Eco & Equilibrio",
    color: "#06b6d4", // cyan-500
    strokeWidth: 2,
    badgeBg: "bg-cyan-50 dark:bg-cyan-950/50",
    badgeText: "text-cyan-800 dark:text-cyan-300",
    borderBadge: "border-cyan-300 dark:border-cyan-800",
    dotColor: "bg-cyan-500",
  },
  ambosAtrasados: {
    key: "ambosAtrasados",
    label: "Ambos atrasados",
    color: "#f59e0b", // amber-500
    strokeWidth: 2,
    badgeBg: "bg-amber-50 dark:bg-amber-950/50",
    badgeText: "text-amber-800 dark:text-amber-300",
    borderBadge: "border-amber-300 dark:border-amber-800",
    dotColor: "bg-amber-500",
  },
};

function formatMoney(n: number, signed = true): string {
  const formatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
  if (!signed) return formatted;
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
}

function formatMoneyShort(n: number): string {
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 10_000) {
    return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  }
  return formatMoney(n);
}

export function SimuladorBalanceChartModal({
  open,
  onClose,
  simulaciones,
  theme,
}: SimuladorBalanceChartModalProps) {
  const clipId = useId();
  const [viewMode, setViewMode] = useState<ViewDisplayMode>("combinado");
  const [groupMode, setGroupMode] = useState<ChartGroupMode>("jugada");
  const [activeTraces, setActiveTraces] = useState<Record<TraceKey, boolean>>({
    total: true,
    candidatos: true,
    atrasados: true,
    eco: true,
    ambosAtrasados: true,
  });

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Cerrar con tecla Escape y bloquear scroll de la página
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Orden cronológico estricto (de la más antigua a la más reciente)
  const sortedSims = useMemo(() => {
    return [...simulaciones].sort((a, b) => {
      if (a.fechaInicio !== b.fechaInicio) {
        return a.fechaInicio.localeCompare(b.fechaInicio);
      }
      const ta = TURNO_ORDER[a.turnoInicio as TurnoId] ?? 0;
      const tb = TURNO_ORDER[b.turnoInicio as TurnoId] ?? 0;
      if (ta !== tb) return ta - tb;
      if (a.creadoEn && b.creadoEn && a.creadoEn !== b.creadoEn) {
        return a.creadoEn.localeCompare(b.creadoEn);
      }
      return a.id.localeCompare(b.id);
    });
  }, [simulaciones]);

  // Construir puntos cronológicos para el eje X
  const dataPoints = useMemo<ChartDataPoint[]>(() => {
    if (sortedSims.length === 0) return [];

    let cumCandidatos = 0;
    let cumAtrasados = 0;
    let cumEco = 0;
    let cumAmbos = 0;
    let cumTotal = 0;

    const initialPoint: ChartDataPoint = {
      idx: 0,
      label: "Inicio",
      sublabel: "Balance inicial $0",
      candidatos: 0,
      atrasados: 0,
      eco: 0,
      ambosAtrasados: 0,
      total: 0,
      delta: 0,
    };

    if (groupMode === "jugada") {
      const points: ChartDataPoint[] = [initialPoint];
      sortedSims.forEach((s, i) => {
        const delta = s.balance; // gananciaBruta - gastoTotal
        cumTotal += delta;

        const strat: EstrategiaSimulacion = s.estrategia ?? "candidatos";
        if (strat === "atrasados") cumAtrasados += delta;
        else if (strat === "eco") cumEco += delta;
        else if (strat === "ambos_atrasados") cumAmbos += delta;
        else cumCandidatos += delta;

        const nombreTurno =
          TURNOS_CONFIG[s.turnoInicio as TurnoId]?.nombre ?? s.turnoInicio;
        const nombreLoteria =
          LOTERIAS_CONFIG[s.loteria]?.nombre ?? s.loteria;

        points.push({
          idx: i + 1,
          label: `#${i + 1}`,
          sublabel: `${s.fechaInicio} · ${nombreTurno} · ${nombreLoteria} (${s.numero})`,
          candidatos: cumCandidatos,
          atrasados: cumAtrasados,
          eco: cumEco,
          ambosAtrasados: cumAmbos,
          total: cumTotal,
          delta,
          play: s,
        });
      });
      return points;
    } else {
      // Modo por turno
      const turnGroups = new Map<
        string,
        {
          fecha: string;
          turno: TurnoId;
          plays: SimulacionEvaluada[];
        }
      >();

      for (const s of sortedSims) {
        const key = `${s.fechaInicio}_${s.turnoInicio}`;
        let g = turnGroups.get(key);
        if (!g) {
          g = { fecha: s.fechaInicio, turno: s.turnoInicio as TurnoId, plays: [] };
          turnGroups.set(key, g);
        }
        g.plays.push(s);
      }

      const points: ChartDataPoint[] = [initialPoint];
      let tIdx = 1;

      for (const [, g] of turnGroups) {
        let deltaTurno = 0;
        for (const s of g.plays) {
          const delta = s.balance;
          deltaTurno += delta;
          const strat: EstrategiaSimulacion = s.estrategia ?? "candidatos";
          if (strat === "atrasados") cumAtrasados += delta;
          else if (strat === "eco") cumEco += delta;
          else if (strat === "ambos_atrasados") cumAmbos += delta;
          else cumCandidatos += delta;
        }
        cumTotal += deltaTurno;

        const nombreTurno =
          TURNOS_CONFIG[g.turno]?.nombre ?? g.turno;
        const shortFecha = g.fecha.slice(5);

        points.push({
          idx: tIdx++,
          label: `${shortFecha} ${nombreTurno}`,
          sublabel: `${g.fecha} · ${nombreTurno} (${g.plays.length} jugadas)`,
          candidatos: cumCandidatos,
          atrasados: cumAtrasados,
          eco: cumEco,
          ambosAtrasados: cumAmbos,
          total: cumTotal,
          delta: deltaTurno,
          playsCount: g.plays.length,
        });
      }
      return points;
    }
  }, [sortedSims, groupMode]);

  const lastPoint = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : null;
  const currentHoveredPoint =
    hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < dataPoints.length
      ? dataPoints[hoveredIdx]
      : lastPoint;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-5xl flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 px-5 py-3.5 bg-zinc-50/80 dark:bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                📈
              </span>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 sm:text-base">
                Evolución de Balance por Modelo (XY)
              </h3>
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Eje X: jugadas en orden cronológico · Eje Y: balance de dinero ($)
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Selector de Vista: Combinado (5 trazos) vs Individuales (por modelo) */}
            <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode("combinado")}
                className={`rounded-md px-2.5 py-1 text-[11px] transition-all ${
                  viewMode === "combinado"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Combinado (5 trazos)
              </button>
              <button
                type="button"
                onClick={() => setViewMode("individual")}
                className={`rounded-md px-2.5 py-1 text-[11px] transition-all ${
                  viewMode === "individual"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Gráficos individuales
              </button>
            </div>

            {/* Toggle de Agrupación Eje X: Por jugada vs Por turno */}
            <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setGroupMode("jugada")}
                className={`rounded-md px-2.5 py-1 text-[11px] transition-all ${
                  groupMode === "jugada"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Por jugada ({sortedSims.length})
              </button>
              <button
                type="button"
                onClick={() => setGroupMode("turno")}
                className={`rounded-md px-2.5 py-1 text-[11px] transition-all ${
                  groupMode === "turno"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                Por turno
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              title="Cerrar modal (Esc)"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Barra de chips de balance actual */}
        {lastPoint && (
          <div className="grid grid-cols-2 gap-2 border-b border-zinc-100 dark:border-zinc-800 px-5 py-2.5 sm:grid-cols-5 text-xs bg-white dark:bg-zinc-950">
            {(Object.keys(TRACE_CONFIG) as TraceKey[]).map((key) => {
              const conf = TRACE_CONFIG[key];
              const val = lastPoint[key];
              const pos = val >= 0;

              return (
                <div
                  key={key}
                  className={`flex flex-col rounded-lg border px-2.5 py-1.5 ${conf.badgeBg} ${conf.borderBadge}`}
                >
                  <span className={`text-[10px] font-semibold ${conf.badgeText}`}>
                    {conf.label}
                  </span>
                  <span
                    className={`font-mono text-sm font-bold ${
                      val === 0
                        ? "text-zinc-400"
                        : pos
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {formatMoney(val)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Contenedor central scrolleable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {dataPoints.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center text-sm text-zinc-400">
              <p>No hay jugadas registradas en el simulador aún para graficar.</p>
            </div>
          ) : viewMode === "combinado" ? (
            /* Vista 1: Gráfico Combinado con los 5 trazos */
            <div className="space-y-3">
              <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/40 p-2 shadow-inner">
                <SvgRenderer
                  clipId={`${clipId}-main`}
                  points={dataPoints}
                  traces={(Object.keys(TRACE_CONFIG) as TraceKey[]).filter(
                    (k) => activeTraces[k]
                  )}
                  hoveredIdx={hoveredIdx}
                  onHoverChange={setHoveredIdx}
                  height={380}
                  isMultiTrace
                />
              </div>

              {/* Leyenda interactiva para prender y apagar trazos */}
              <div className="rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40 p-3">
                <div className="mb-2 text-[11px] font-medium text-zinc-500">
                  Trazos visibles en el gráfico (haz clic para ocultar o mostrar):
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(Object.keys(TRACE_CONFIG) as TraceKey[]).map((key) => {
                    const conf = TRACE_CONFIG[key];
                    const isActive = activeTraces[key];

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setActiveTraces((prev) => ({
                            ...prev,
                            [key]: !prev[key],
                          }))
                        }
                        className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                          isActive
                            ? `${conf.borderBadge} ${conf.badgeBg} ${conf.badgeText} shadow-xs font-semibold`
                            : "border-zinc-200 bg-white text-zinc-400 opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
                        }`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${conf.dotColor} ${
                            isActive ? "ring-2 ring-zinc-300 dark:ring-zinc-700" : ""
                          }`}
                        />
                        <span>{conf.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Vista 2: Grillas individuales por cada modelo de juego + Total */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gráfico Total */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/60 p-3 md:col-span-2">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Total acumulado (todos los modelos)
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold ${
                      (lastPoint?.total ?? 0) >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {formatMoney(lastPoint?.total ?? 0)}
                  </span>
                </div>
                <SvgRenderer
                  clipId={`${clipId}-total`}
                  points={dataPoints}
                  traces={["total"]}
                  hoveredIdx={hoveredIdx}
                  onHoverChange={setHoveredIdx}
                  height={220}
                />
              </div>

              {/* Gráfico Candidatos */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Candidatos
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold ${
                      (lastPoint?.candidatos ?? 0) >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {formatMoney(lastPoint?.candidatos ?? 0)}
                  </span>
                </div>
                <SvgRenderer
                  clipId={`${clipId}-candidatos`}
                  points={dataPoints}
                  traces={["candidatos"]}
                  hoveredIdx={hoveredIdx}
                  onHoverChange={setHoveredIdx}
                  height={190}
                />
              </div>

              {/* Gráfico Más atrasados */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Más atrasados
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold ${
                      (lastPoint?.atrasados ?? 0) >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {formatMoney(lastPoint?.atrasados ?? 0)}
                  </span>
                </div>
                <SvgRenderer
                  clipId={`${clipId}-atrasados`}
                  points={dataPoints}
                  traces={["atrasados"]}
                  hoveredIdx={hoveredIdx}
                  onHoverChange={setHoveredIdx}
                  height={190}
                />
              </div>

              {/* Gráfico Eco & Equilibrio */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Eco &amp; Equilibrio
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold ${
                      (lastPoint?.eco ?? 0) >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {formatMoney(lastPoint?.eco ?? 0)}
                  </span>
                </div>
                <SvgRenderer
                  clipId={`${clipId}-eco`}
                  points={dataPoints}
                  traces={["eco"]}
                  hoveredIdx={hoveredIdx}
                  onHoverChange={setHoveredIdx}
                  height={190}
                />
              </div>

              {/* Gráfico Ambos atrasados */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/60 p-3">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Ambos atrasados
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold ${
                      (lastPoint?.ambosAtrasados ?? 0) >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {formatMoney(lastPoint?.ambosAtrasados ?? 0)}
                  </span>
                </div>
                <SvgRenderer
                  clipId={`${clipId}-ambos`}
                  points={dataPoints}
                  traces={["ambosAtrasados"]}
                  hoveredIdx={hoveredIdx}
                  onHoverChange={setHoveredIdx}
                  height={190}
                />
              </div>
            </div>
          )}

          {/* Desglose del punto seleccionado bajo el cursor */}
          {currentHoveredPoint && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-3.5 text-xs shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {currentHoveredPoint.label}
                  </span>
                  <span className="text-zinc-400">· {currentHoveredPoint.sublabel}</span>
                </div>

                {currentHoveredPoint.delta !== 0 && (
                  <div
                    className={`font-mono text-xs font-bold ${
                      currentHoveredPoint.delta > 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    Resultado en este paso: {formatMoney(currentHoveredPoint.delta)}
                  </div>
                )}
              </div>

              {/* Valores de balance por modelo en este punto */}
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5 text-[11px]">
                <div className="flex flex-col rounded-lg border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-2">
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    Total
                  </span>
                  <span className="font-mono text-xs font-bold">
                    {formatMoney(currentHoveredPoint.total)}
                  </span>
                </div>

                <div className="flex flex-col rounded-lg border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40 p-2">
                  <span className="font-semibold text-violet-700 dark:text-violet-400">
                    Candidatos
                  </span>
                  <span className="font-mono text-xs font-bold">
                    {formatMoney(currentHoveredPoint.candidatos)}
                  </span>
                </div>

                <div className="flex flex-col rounded-lg border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40 p-2">
                  <span className="font-semibold text-rose-700 dark:text-rose-400">
                    Más atrasados
                  </span>
                  <span className="font-mono text-xs font-bold">
                    {formatMoney(currentHoveredPoint.atrasados)}
                  </span>
                </div>

                <div className="flex flex-col rounded-lg border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40 p-2">
                  <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                    Eco &amp; Eq.
                  </span>
                  <span className="font-mono text-xs font-bold">
                    {formatMoney(currentHoveredPoint.eco)}
                  </span>
                </div>

                <div className="flex flex-col rounded-lg border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40 p-2">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    Ambos atrasados
                  </span>
                  <span className="font-mono text-xs font-bold">
                    {formatMoney(currentHoveredPoint.ambosAtrasados)}
                  </span>
                </div>
              </div>

              {/* Detalle si corresponde a una jugada individual */}
              {currentHoveredPoint.play && (
                <div className="mt-2.5 border-t border-zinc-100 dark:border-zinc-800 pt-2 text-[11px] text-zinc-500 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span>
                      Número apostado:{" "}
                      <strong className="font-mono text-zinc-900 dark:text-zinc-100">
                        {currentHoveredPoint.play.numero}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Lotería:{" "}
                      <strong className="text-zinc-800 dark:text-zinc-200">
                        {LOTERIAS_CONFIG[currentHoveredPoint.play.loteria]?.nombre ??
                          currentHoveredPoint.play.loteria}
                      </strong>
                    </span>
                  </div>

                  <div>
                    {currentHoveredPoint.play.acierto ? (
                      <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5">
                        🎯 ¡ACIERTO! (+{formatMoney(currentHoveredPoint.play.gananciaBruta)})
                      </span>
                    ) : currentHoveredPoint.play.estado === "cerrada" ? (
                      <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5">
                        No acertó (-${currentHoveredPoint.play.apuestaPorSorteo})
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-0.5">
                        Activa / Pendiente (-${currentHoveredPoint.play.apuestaPorSorteo})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie de modal */}
        <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 px-5 py-3 bg-zinc-50/80 dark:bg-zinc-900/50 text-xs">
          <span className="text-[11px] text-zinc-500">
            Total de datos en el gráfico: {dataPoints.length} puntos cronológicos
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg px-4 py-1.5 font-medium transition-colors ${theme.primaryButton} shadow-xs`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Renderizador de gráfico SVG para trazar líneas XY
 */
function SvgRenderer({
  clipId,
  points,
  traces,
  hoveredIdx,
  onHoverChange,
  height = 360,
  isMultiTrace = false,
}: {
  clipId: string;
  points: ChartDataPoint[];
  traces: TraceKey[];
  hoveredIdx: number | null;
  onHoverChange: (idx: number | null) => void;
  height?: number;
  isMultiTrace?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = 860;
  const marginLeft = 75;
  const marginRight = 25;
  const marginTop = 20;
  const marginBottom = 40;

  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;

  // Rango Y
  const { minVal, maxVal, ticks } = useMemo(() => {
    if (points.length === 0) {
      return { minVal: -1000, maxVal: 1000, ticks: [-1000, -500, 0, 500, 1000] };
    }

    let min = 0;
    let max = 0;

    points.forEach((p) => {
      traces.forEach((t) => {
        const val = p[t];
        if (val < min) min = val;
        if (val > max) max = val;
      });
    });

    const diff = max - min || 2000;
    const padding = Math.max(diff * 0.12, 500);
    const adjustedMin = Math.floor((min - padding) / 500) * 500;
    const adjustedMax = Math.ceil((max + padding) / 500) * 500;

    const tickCount = 5;
    const step = (adjustedMax - adjustedMin) / (tickCount - 1);
    const generatedTicks: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      generatedTicks.push(Math.round(adjustedMin + step * i));
    }

    if (!generatedTicks.includes(0) && adjustedMin < 0 && adjustedMax > 0) {
      generatedTicks.push(0);
      generatedTicks.sort((a, b) => a - b);
    }

    return { minVal: adjustedMin, maxVal: adjustedMax, ticks: generatedTicks };
  }, [points, traces]);

  const scaleY = useCallback(
    (val: number) => {
      const range = maxVal - minVal;
      if (range === 0) return marginTop + plotHeight / 2;
      return marginTop + plotHeight - ((val - minVal) / range) * plotHeight;
    },
    [maxVal, minVal, plotHeight, marginTop]
  );

  const scaleX = useCallback(
    (idx: number) => {
      if (points.length <= 1) return marginLeft + plotWidth / 2;
      return marginLeft + (idx / (points.length - 1)) * plotWidth;
    },
    [points.length, plotWidth, marginLeft]
  );

  // Generar trazados de líneas
  const paths = useMemo(() => {
    const res: Record<TraceKey, string> = {
      total: "",
      candidatos: "",
      atrasados: "",
      eco: "",
      ambosAtrasados: "",
    };

    if (points.length === 0) return res;

    traces.forEach((key) => {
      const d = points
        .map((p, i) => {
          const x = scaleX(i);
          const y = scaleY(p[key]);
          return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ");
      res[key] = d;
    });

    return res;
  }, [points, traces, scaleX, scaleY]);

  // Manejo de mouse
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * width;

    if (svgX < marginLeft || svgX > width - marginRight) {
      onHoverChange(null);
      return;
    }

    const relX = svgX - marginLeft;
    const closestIdx = Math.round((relX / plotWidth) * (points.length - 1));
    const clamped = Math.max(0, Math.min(points.length - 1, closestIdx));
    onHoverChange(clamped);
  };

  const handleMouseLeave = () => {
    onHoverChange(null);
  };

  const currentPoint =
    hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < points.length
      ? points[hoveredIdx]
      : null;

  return (
    <div className="relative w-full overflow-hidden select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto cursor-crosshair select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={marginLeft}
              y={marginTop}
              width={plotWidth}
              height={plotHeight}
            />
          </clipPath>
        </defs>

        {/* Líneas horizontales de guía (Gridlines) */}
        {ticks.map((t) => {
          const y = scaleY(t);
          const isZero = t === 0;
          return (
            <g key={t}>
              <line
                x1={marginLeft}
                y1={y}
                x2={marginLeft + plotWidth}
                y2={y}
                stroke="currentColor"
                strokeDasharray={isZero ? "4 3" : "2 2"}
                className={
                  isZero
                    ? "text-zinc-400 dark:text-zinc-500"
                    : "text-zinc-100 dark:text-zinc-800/80"
                }
                strokeWidth={isZero ? "1.5" : "1"}
              />
              <text
                x={marginLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                className={`text-[10px] font-mono ${
                  isZero
                    ? "font-bold fill-zinc-700 dark:fill-zinc-300"
                    : "fill-zinc-400 dark:fill-zinc-500"
                }`}
              >
                {formatMoneyShort(t)}
              </text>
            </g>
          );
        })}

        {/* Eje X: Etiquetas cronológicas */}
        {(() => {
          const numTicks = Math.min(6, points.length);
          const step = Math.max(
            1,
            Math.floor((points.length - 1) / (numTicks - 1 || 1))
          );
          const indices: number[] = [];
          for (let i = 0; i < points.length; i += step) {
            indices.push(i);
          }
          if (indices[indices.length - 1] !== points.length - 1) {
            indices.push(points.length - 1);
          }

          return indices.map((i) => {
            const p = points[i];
            const x = scaleX(i);
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={marginTop + plotHeight}
                  x2={x}
                  y2={marginTop + plotHeight + 4}
                  stroke="currentColor"
                  className="text-zinc-300 dark:text-zinc-700"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={marginTop + plotHeight + 16}
                  textAnchor="middle"
                  className="text-[9px] font-mono fill-zinc-400 dark:fill-zinc-500"
                >
                  {p.label}
                </text>
              </g>
            );
          });
        })()}

        {/* Trazados clipeados dentro del área gráfica */}
        <g clipPath={`url(#${clipId})`}>
          {traces.map((key) => {
            const conf = TRACE_CONFIG[key];
            const d = paths[key];
            if (!d) return null;
            const isTotal = key === "total";

            return (
              <path
                key={key}
                d={d}
                fill="none"
                stroke={conf.color}
                strokeWidth={isTotal ? 3.5 : isMultiTrace ? 2 : 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isTotal ? 1 : 0.9}
              />
            );
          })}
        </g>

        {/* Marcador vertical del cursor (crosshair) y puntos en hover */}
        {hoveredIdx !== null && currentPoint && (
          <g>
            <line
              x1={scaleX(hoveredIdx)}
              y1={marginTop}
              x2={scaleX(hoveredIdx)}
              y2={marginTop + plotHeight}
              stroke="currentColor"
              strokeDasharray="2 2"
              className="text-zinc-500"
              strokeWidth="1.2"
            />

            {traces.map((key) => {
              const conf = TRACE_CONFIG[key];
              const x = scaleX(hoveredIdx);
              const y = scaleY(currentPoint[key]);

              return (
                <circle
                  key={key}
                  cx={x}
                  cy={y}
                  r={key === "total" ? 5 : 4}
                  fill={conf.color}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="shadow-sm"
                />
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}
