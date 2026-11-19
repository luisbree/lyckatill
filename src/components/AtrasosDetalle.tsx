"use client";

import { useState } from "react";
import { LOTERIAS_CONFIG } from "@/lib/quiniela/config";
import type {
  AtrasosPorLoteria,
  CandidatoDigito,
  DigitoAtraso,
  DigitoRetornoStats,
  EcoDigito,
} from "@/lib/quiniela/stats";
import { LOTERIA_IDS, type LoteriaId } from "@/lib/quiniela/types";
import type { SeasonTheme } from "@/lib/theme/season";

interface AtrasosDetalleProps {
  atrasos: AtrasosPorLoteria | null;
  theme: SeasonTheme;
}

function PosicionCard({
  titulo,
  masAtrasado,
  ranking,
  candidatos,
  ecos,
  theme,
}: {
  titulo: string;
  masAtrasado: DigitoAtraso;
  ranking: DigitoRetornoStats[];
  candidatos: CandidatoDigito[];
  ecos: EcoDigito[];
  theme: SeasonTheme;
}) {
  const top3 = candidatos.slice(0, 3);
  const top3Eco = ecos.slice(0, 3);
  return (
    <div
      className={`rounded-xl border ${theme.cardBorder} bg-white/90 dark:bg-zinc-950/90 p-4 space-y-3 shadow-sm`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {titulo}
        </h3>
        <span
          className={`rounded-full px-3 py-1 font-mono text-xs font-bold tracking-wide ${theme.atrasadoPill}`}
        >
          Más atrasado: {masAtrasado.digito} ({masAtrasado.atraso})
        </span>
      </div>

      {/* Top 3 candidatos del modelo ponderado */}
      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/70 p-2.5 space-y-1.5">
        <div className="text-[11px] font-medium text-zinc-500">
          Candidatos (35% atraso · 30% Markov · 20% freq · 15% rec.)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {top3.map((c, idx) => (
            <span
              key={c.digito}
              title={`Score: ${c.score} · z=${c.zAtraso} · Markov=${(
                c.markovProb * 100
              ).toFixed(1)}% · Freq=${(c.freqGlobal * 100).toFixed(
                1
              )}% · Rec=${(c.freqReciente * 100).toFixed(1)}%`}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs ${
                idx === 0
                  ? `${theme.candidatoBadge} font-bold`
                  : "border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <span>{c.digito}</span>
              <span className="text-[10px] opacity-80">{c.score}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Top 3 Eco & Equilibrio */}
      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/70 p-2.5 space-y-1.5">
        <div className="text-[11px] font-medium text-zinc-500">
          Eco &amp; Equilibrio (35% M2 · 30% déf50 · 20% par · 15% modal)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {top3Eco.map((c, idx) => (
            <span
              key={c.digito}
              title={`Score: ${c.score} · M2=${(c.markov2Prob * 100).toFixed(
                1
              )}% · Déf50=${c.deficit50} · Par/R=${(
                c.paridadRangoProb * 100
              ).toFixed(1)}% · Modal=${(c.ecoModalProb * 100).toFixed(1)}%`}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs ${
                idx === 0
                  ? `${theme.ecoBadge} font-bold`
                  : "border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <span>{c.digito}</span>
              <span className="text-[10px] opacity-80">{c.score}</span>
            </span>
          ))}
        </div>
      </div>

      <ol className="divide-y divide-zinc-100 dark:divide-zinc-900 text-xs">
        {ranking.map((item) => {
          const esMasAtrasado = item.digito === masAtrasado.digito;
          return (
            <li
              key={item.digito}
              className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors ${
                esMasAtrasado ? `${theme.atrasadoCardHighlight} font-semibold my-0.5` : ""
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {item.digito}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {item.promedio !== null ? (
                    <>
                      <span className="font-mono font-semibold">
                        {item.promedio}
                      </span>{" "}
                      sorteos{" "}
                      <span className="text-zinc-500">
                        ± {item.desviacion}
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-400">
                      Sin intervalos ({item.apariciones} ap.)
                    </span>
                  )}
                </span>
              </div>

              <span className="text-[11px] text-zinc-400 tabular-nums">
                atraso: {item.atrasoActual}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function AtrasosDetalle({ atrasos, theme }: AtrasosDetalleProps) {
  const [selectedLoteria, setSelectedLoteria] = useState<LoteriaId>("ciudad");
  const [open, setOpen] = useState<boolean>(true);

  if (!atrasos) return null;

  const stat = atrasos[selectedLoteria];

  return (
    <section
      className={`rounded-2xl border-2 ${theme.cardBorder} bg-white/75 dark:bg-zinc-950/75 p-5 sm:p-6 shadow-md space-y-5`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 dark:border-zinc-800 pb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-left group"
        >
          <span
            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider mb-1 ${theme.badge}`}
          >
            Sección 3
          </span>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:opacity-80">
            {open ? "▾" : "▸"} Tiempo promedio de retorno por dígito
          </h2>
          <p className="text-xs text-zinc-500">
            Ordenado de menor a mayor promedio de sorteos entre apariciones (±
            desviación estándar).
          </p>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {open && (
            <div className="flex flex-wrap gap-1.5">
              {LOTERIA_IDS.map((loteriaId) => {
                const active = loteriaId === selectedLoteria;
                return (
                  <button
                    key={loteriaId}
                    type="button"
                    onClick={() => setSelectedLoteria(loteriaId)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? theme.primaryButton
                        : "border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {LOTERIAS_CONFIG[loteriaId].nombre}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950 px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {open ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      {open &&
        (!stat ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 text-center text-sm text-zinc-500">
            Todavía no hay sorteos publicados para{" "}
            {LOTERIAS_CONFIG[selectedLoteria].nombre}.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <PosicionCard
              titulo="Centena"
              masAtrasado={stat.centena}
              ranking={stat.rankingCentena}
              candidatos={stat.candidatoCentena}
              ecos={stat.ecoCentena}
              theme={theme}
            />
            <PosicionCard
              titulo="Decena"
              masAtrasado={stat.decena}
              ranking={stat.rankingDecena}
              candidatos={stat.candidatoDecena}
              ecos={stat.ecoDecena}
              theme={theme}
            />
            <PosicionCard
              titulo="Unidad"
              masAtrasado={stat.unidad}
              ranking={stat.rankingUnidad}
              candidatos={stat.candidatoUnidad}
              ecos={stat.ecoUnidad}
              theme={theme}
            />
          </div>
        ))}
    </section>
  );
}

