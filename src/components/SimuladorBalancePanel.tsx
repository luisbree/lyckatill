"use client";

import { useMemo } from "react";
import { LOTERIAS_CONFIG } from "@/lib/quiniela/config";
import {
  calcularBalanceDetallado,
  type GrupoBalance,
} from "@/lib/quiniela/simStats";
import type { SimulacionEvaluada } from "@/lib/quiniela/simulator";
import type { SeasonTheme } from "@/lib/theme/season";

interface SimuladorBalancePanelProps {
  simulaciones: SimulacionEvaluada[];
  theme: SeasonTheme;
}

function formatMoney(n: number): string {
  const formatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
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
    return <td className="px-3 py-2 text-right text-zinc-300 dark:text-zinc-700">—</td>;
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
  theme,
}: SimuladorBalancePanelProps) {
  const balance = useMemo(
    () => calcularBalanceDetallado(simulaciones),
    [simulaciones]
  );

  if (simulaciones.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Comparación global por estrategia y por cifras */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Desglose lotería por lotería */}
      <div
        className={`overflow-x-auto rounded-xl border ${theme.cardBorder} bg-white/95 dark:bg-zinc-950/95`}
      >
        <div className="border-b border-zinc-100 dark:border-zinc-800 px-3.5 py-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            Balance acumulado por lotería (todos los turnos)
          </span>
          <span className="text-[11px] text-zinc-400">
            Neto · aciertos/jugadas · retorno por $1
          </span>
        </div>
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className={`border-b ${theme.cardBorder} ${theme.tableHeader}`}>
              <th className="px-3 py-2 font-semibold">Lotería</th>
              <th className="px-3 py-2 font-semibold text-right">Candidatos</th>
              <th className="px-3 py-2 font-semibold text-right">
                Más atrasados
              </th>
              <th className="px-3 py-2 font-semibold text-right">3 cifras</th>
              <th className="px-3 py-2 font-semibold text-right">2 cifras</th>
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
                <CeldaBalance grupo={row.tresCifras} />
                <CeldaBalance grupo={row.dosCifras} />
                <CeldaBalance grupo={row.total} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

