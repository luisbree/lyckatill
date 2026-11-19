"use client";

import { useMemo, useState } from "react";
import { LOTERIAS_CONFIG } from "@/lib/quiniela/config";
import {
  calcularBalanceDetallado,
  type GrupoBalance,
} from "@/lib/quiniela/simStats";
import type {
  ResumenSimulaciones,
  SimulacionEvaluada,
} from "@/lib/quiniela/simulator";
import type { SeasonTheme } from "@/lib/theme/season";

interface SimuladorBalancePanelProps {
  simulaciones: SimulacionEvaluada[];
  resumen: ResumenSimulaciones;
  theme: SeasonTheme;
}

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

function BalanceMetricCard({
  titulo,
  subtitulo,
  grupo,
  theme,
}: {
  titulo: string;
  subtitulo: string;
  grupo: GrupoBalance;
  theme: SeasonTheme;
}) {
  const positivo = grupo.balance >= 0;
  return (
    <div
      className={`rounded-xl border ${theme.cardBorder} bg-white/90 dark:bg-zinc-950/90 p-3.5 space-y-1.5`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          {titulo}
        </span>
        <span className="text-[11px] text-zinc-400">
          {grupo.aciertos}/{grupo.jugadas} aciertos
        </span>
      </div>
      <div
        className={`font-mono text-lg font-bold ${
          grupo.jugadas === 0
            ? "text-zinc-400"
            : positivo
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {grupo.jugadas === 0 ? "—" : formatMoney(grupo.balance)}
      </div>
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>{subtitulo}</span>
        {grupo.retornoPorPeso !== null && (
          <span className="font-mono font-medium">
            ${grupo.retornoPorPeso.toFixed(2)} / $1
          </span>
        )}
      </div>
    </div>
  );
}

function CeldaBalance({ grupo }: { grupo: GrupoBalance }) {
  if (grupo.jugadas === 0) {
    return (
      <td className="px-3 py-2 text-right text-zinc-300 dark:text-zinc-700">
        —
      </td>
    );
  }

  return (
    <td className="px-3 py-2 text-right font-mono">
      <div
        className={`font-semibold ${
          grupo.balance >= 0
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {formatMoney(grupo.balance)}
      </div>
      <div className="text-[10px] text-zinc-400">
        {grupo.aciertos}/{grupo.jugadas}
        {grupo.retornoPorPeso !== null
          ? ` · $${grupo.retornoPorPeso.toFixed(2)}/$1`
          : ""}
      </div>
    </td>
  );
}

export function SimuladorBalancePanel({
  simulaciones,
  resumen,
  theme,
}: SimuladorBalancePanelProps) {
  const [openCards, setOpenCards] = useState(true);
  const [openTabla, setOpenTabla] = useState(true);

  const balance = useMemo(
    () => calcularBalanceDetallado(simulaciones),
    [simulaciones]
  );

  return (
    <div className="space-y-4">
      {/* 1. Los 8 rectángulos de plata apostada (colapsable) */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setOpenCards((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50"
        >
          <span>
            {openCards ? "▾" : "▸"} Resumen financiero (balance:{" "}
            <span
              className={`font-mono ${
                resumen.balanceNeto >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatMoney(resumen.balanceNeto)}
            </span>
            )
          </span>
          <span className="text-[11px] font-normal text-zinc-400">
            {openCards ? "Ocultar" : "Mostrar"}
          </span>
        </button>

        {openCards && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div
                className={`rounded-xl border ${theme.cardBorder} bg-white/90 dark:bg-zinc-950/90 p-3.5`}
              >
                <div className="text-[11px] text-zinc-500">
                  Gastos (apostado)
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {formatMoney(resumen.totalApostado, false)}
                </div>
              </div>
              <div
                className={`rounded-xl border ${theme.cardBorder} bg-white/90 dark:bg-zinc-950/90 p-3.5`}
              >
                <div className="text-[11px] text-zinc-500">Ganancias</div>
                <div className="mt-1 font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">
                  {formatMoney(resumen.totalGanado, false)}
                </div>
              </div>
              <div
                className={`rounded-xl border ${theme.cardBorder} bg-white/90 dark:bg-zinc-950/90 p-3.5`}
              >
                <div className="text-[11px] text-zinc-500">Balance neto</div>
                <div
                  className={`mt-1 font-mono text-lg font-bold ${
                    resumen.balanceNeto >= 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {formatMoney(resumen.balanceNeto)}
                </div>
              </div>
              <div
                className={`rounded-xl border ${theme.cardBorder} bg-white/90 dark:bg-zinc-950/90 p-3.5`}
              >
                <div className="text-[11px] text-zinc-500">Estado</div>
                <div className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {resumen.activas} activas · {resumen.acertadas} acertadas
                </div>
              </div>
            </div>

            {simulaciones.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <BalanceMetricCard
                  titulo="Candidatos"
                  subtitulo="Todas las loterías"
                  grupo={balance.global.candidatos}
                  theme={theme}
                />
                <BalanceMetricCard
                  titulo="Más atrasados"
                  subtitulo="Todas las loterías"
                  grupo={balance.global.atrasados}
                  theme={theme}
                />
                <BalanceMetricCard
                  titulo="Eco & Equilibrio"
                  subtitulo="Todas las loterías"
                  grupo={balance.global.eco}
                  theme={theme}
                />
                <BalanceMetricCard
                  titulo="3 cifras"
                  subtitulo="Todas las loterías"
                  grupo={balance.global.tresCifras}
                  theme={theme}
                />
                <BalanceMetricCard
                  titulo="2 cifras"
                  subtitulo="Todas las loterías"
                  grupo={balance.global.dosCifras}
                  theme={theme}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Desglose lotería por lotería (colapsable) */}
      {simulaciones.length > 0 && (
        <div
          className={`overflow-x-auto rounded-xl border ${theme.cardBorder} bg-white/95 dark:bg-zinc-950/95`}
        >
          <button
            type="button"
            onClick={() => setOpenTabla((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-left hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40"
          >
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              {openTabla ? "▾" : "▸"} Balance acumulado por lotería (todos los
              turnos)
            </span>
            <span className="text-[11px] text-zinc-400">
              {openTabla ? "Ocultar" : "Mostrar"}
            </span>
          </button>

          {openTabla && (
            <table className="w-full border-collapse border-t border-zinc-100 dark:border-zinc-800 text-left text-xs">
              <thead>
                <tr
                  className={`border-b ${theme.cardBorder} ${theme.tableHeader}`}
                >
                  <th className="px-3 py-2 font-semibold">Lotería</th>
                  <th className="px-3 py-2 font-semibold text-right">
                    Candidatos
                  </th>
                  <th className="px-3 py-2 font-semibold text-right">
                    Más atrasados
                  </th>
                  <th className="px-3 py-2 font-semibold text-right">
                    Eco &amp; Eq.
                  </th>
                  <th className="px-3 py-2 font-semibold text-right">
                    3 cifras
                  </th>
                  <th className="px-3 py-2 font-semibold text-right">
                    2 cifras
                  </th>
                  <th className="px-3 py-2 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {balance.porLoteria.map((row) => (
                  <tr key={row.loteria}>
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {LOTERIAS_CONFIG[row.loteria].nombre}
                    </td>
                    <CeldaBalance grupo={row.candidatos} />
                    <CeldaBalance grupo={row.atrasados} />
                    <CeldaBalance grupo={row.eco} />
                    <CeldaBalance grupo={row.tresCifras} />
                    <CeldaBalance grupo={row.dosCifras} />
                    <CeldaBalance grupo={row.total} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
