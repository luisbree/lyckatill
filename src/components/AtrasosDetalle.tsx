"use client";

import { useState } from "react";
import { LOTERIAS_CONFIG } from "@/lib/quiniela/config";
import type {
  AtrasosPorLoteria,
  DigitoAtraso,
  DigitoRetornoStats,
} from "@/lib/quiniela/stats";
import { LOTERIA_IDS, type LoteriaId } from "@/lib/quiniela/types";

interface AtrasosDetalleProps {
  atrasos: AtrasosPorLoteria | null;
}

function PosicionCard({
  titulo,
  masAtrasado,
  ranking,
}: {
  titulo: string;
  masAtrasado: DigitoAtraso;
  ranking: DigitoRetornoStats[];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {titulo}
        </h3>
        <span className="rounded-full bg-zinc-900 dark:bg-zinc-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-white dark:text-zinc-900">
          Más atrasado: {masAtrasado.digito} ({masAtrasado.atraso})
        </span>
      </div>

      <ol className="divide-y divide-zinc-100 dark:divide-zinc-900 text-xs">
        {ranking.map((item) => {
          const esMasAtrasado = item.digito === masAtrasado.digito;
          return (
            <li
              key={item.digito}
              className={`flex items-center justify-between py-1.5 px-1.5 rounded ${
                esMasAtrasado
                  ? "bg-amber-50 dark:bg-amber-950/40 font-medium"
                  : ""
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

export function AtrasosDetalle({ atrasos }: AtrasosDetalleProps) {
  const [selectedLoteria, setSelectedLoteria] = useState<LoteriaId>("ciudad");

  if (!atrasos) return null;

  const stat = atrasos[selectedLoteria];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Tiempo promedio de retorno por dígito
          </h2>
          <p className="text-xs text-zinc-500">
            Ordenado de menor a mayor promedio de sorteos entre apariciones (±
            desviación estándar).
          </p>
        </div>

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
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                {LOTERIAS_CONFIG[loteriaId].nombre}
              </button>
            );
          })}
        </div>
      </div>

      {!stat ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 text-center text-sm text-zinc-500">
          Todavía no hay sorteos publicados para{" "}
          {LOTERIAS_CONFIG[selectedLoteria].nombre}.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PosicionCard
            titulo="Unidad"
            masAtrasado={stat.unidad}
            ranking={stat.rankingUnidad}
          />
          <PosicionCard
            titulo="Decena"
            masAtrasado={stat.decena}
            ranking={stat.rankingDecena}
          />
          <PosicionCard
            titulo="Centena"
            masAtrasado={stat.centena}
            ranking={stat.rankingCentena}
          />
        </div>
      )}
    </section>
  );
}

