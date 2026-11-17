"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LOTERIAS_CONFIG, TURNOS_CONFIG } from "@/lib/quiniela/config";
import {
  LOTERIA_IDS,
  TURNO_IDS,
  type LoteriaId,
  type SorteoDocument,
  type TurnoId,
} from "@/lib/quiniela/types";

export function ResultadosBoard() {
  const [fecha, setFecha] = useState<string>("");
  const [sorteos, setSorteos] = useState<SorteoDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SorteoDocument | null>(null);
  const [collectingTurno, setCollectingTurno] = useState<TurnoId | null>(null);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);

  const [refreshTick, setRefreshTick] = useState<number>(0);

  const loadSorteos = useCallback(async (targetFecha: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = targetFecha ? `?fecha=${targetFecha}` : "";
      const res = await fetch(`/api/sorteos${qs}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudieron cargar los resultados");
      }
      if (!targetFecha && typeof data.fecha === "string") {
        setFecha(data.fecha);
      }
      setSorteos(Array.isArray(data.sorteos) ? data.sorteos : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al consultar resultados"
      );
      setSorteos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs = fecha ? `?fecha=${fecha}` : "";
    fetch(`/api/sorteos${qs}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "No se pudieron cargar los resultados");
        }
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setError(null);
          if (!fecha && typeof data.fecha === "string") {
            setFecha(data.fecha);
          }
          setSorteos(Array.isArray(data.sorteos) ? data.sorteos : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Error al consultar resultados"
          );
          setSorteos([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fecha, refreshTick]);

  const byKey = useMemo(() => {
    const map = new Map<string, SorteoDocument>();
    for (const s of sorteos) {
      map.set(`${s.loteria}_${s.turno}`, s);
    }
    return map;
  }, [sorteos]);

  async function handleCollectTurno(turno: TurnoId) {
    setCollectingTurno(turno);
    setCollectMsg(null);
    try {
      const res = await fetch("/api/cron/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turno, fecha }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Error al ejecutar recolección");
      }
      const { publicados, pendientes, errores } = data.log;
      setCollectMsg(
        `${TURNOS_CONFIG[turno].nombre}: ${publicados} publicados, ${pendientes} pendientes, ${errores} errores.`
      );
      await loadSorteos(fecha);
    } catch (err) {
      setCollectMsg(
        err instanceof Error ? err.message : "Error al recolectar"
      );
    } finally {
      setCollectingTurno(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra superior: selector de fecha y recarga */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
        <div className="flex items-center gap-3">
          <label
            htmlFor="fecha-sorteos"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Fecha:
          </label>
          <input
            id="fecha-sorteos"
            type="date"
            value={fecha}
            onChange={(e) => {
              setLoading(true);
              setFecha(e.target.value);
            }}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setRefreshTick((t) => t + 1);
            }}
            disabled={loading}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        <div className="text-xs text-zinc-500">
          Tocá cualquier cabeza publicada para ver los 20 premios
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {collectMsg && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-3 text-xs text-zinc-700 dark:text-zinc-300">
          {collectMsg}
        </div>
      )}

      {/* Grilla principal: Turnos x Loterías */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
              <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">
                Turno
              </th>
              {LOTERIA_IDS.map((loteriaId: LoteriaId) => (
                <th
                  key={loteriaId}
                  className="px-4 py-3 text-center font-semibold text-zinc-700 dark:text-zinc-200"
                >
                  <div>{LOTERIAS_CONFIG[loteriaId].nombre}</div>
                  <div className="text-[11px] font-normal text-zinc-400">
                    {LOTERIAS_CONFIG[loteriaId].pais}
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium text-zinc-500">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {TURNO_IDS.map((turnoId: TurnoId) => {
              const turnoCfg = TURNOS_CONFIG[turnoId];
              return (
                <tr
                  key={turnoId}
                  className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40"
                >
                  <td className="px-4 py-3.5 align-middle">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {turnoCfg.nombre}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {turnoCfg.horaSorteoReferencia}
                    </div>
                  </td>

                  {LOTERIA_IDS.map((loteriaId: LoteriaId) => {
                    const participa =
                      LOTERIAS_CONFIG[loteriaId].turnos.includes(turnoId);
                    if (!participa) {
                      return (
                        <td
                          key={loteriaId}
                          className="px-4 py-3.5 text-center text-zinc-300 dark:text-zinc-700"
                        >
                          —
                        </td>
                      );
                    }

                    const doc = byKey.get(`${loteriaId}_${turnoId}`);
                    if (!doc) {
                      return (
                        <td
                          key={loteriaId}
                          className="px-4 py-3.5 text-center text-xs text-zinc-400"
                        >
                          Sin datos
                        </td>
                      );
                    }

                    if (doc.estado === "publicado" && doc.cabeza) {
                      return (
                        <td key={loteriaId} className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => setSelected(doc)}
                            className="inline-flex min-w-[68px] items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 font-mono text-base font-bold tracking-wider text-white dark:text-zinc-900 transition-transform hover:scale-105"
                            title="Ver los 20 premios"
                          >
                            {doc.cabeza}
                          </button>
                        </td>
                      );
                    }

                    if (doc.estado === "error") {
                      return (
                        <td key={loteriaId} className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => setSelected(doc)}
                            className="inline-flex rounded-full bg-red-100 dark:bg-red-950 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-300"
                            title={doc.errorMensaje || "Error"}
                          >
                            Error
                          </button>
                        </td>
                      );
                    }

                    return (
                      <td key={loteriaId} className="px-4 py-3.5 text-center">
                        <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                          Pendiente
                        </span>
                      </td>
                    );
                  })}

                  <td className="px-3 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => void handleCollectTurno(turnoId)}
                      disabled={collectingTurno !== null}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40"
                    >
                      {collectingTurno === turnoId ? "..." : "Recolectar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal con los 20 premios o detalle de error */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {LOTERIAS_CONFIG[selected.loteria].nombre} —{" "}
                  {TURNOS_CONFIG[selected.turno].nombre}
                </h2>
                <p className="text-xs text-zinc-500">
                  Fecha: {selected.fecha}
                  {selected.numeroSorteo
                    ? ` · Sorteo N° ${selected.numeroSorteo}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                ✕
              </button>
            </div>

            {selected.estado === "error" ? (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
                {selected.errorMensaje || "Error desconocido"}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {selected.premios.map((num, idx) => (
                  <div
                    key={`${idx}-${num}`}
                    className={`flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm ${
                      idx === 0
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    <span className="text-xs opacity-70">{idx + 1}°</span>
                    <span className="font-mono tracking-wider">{num}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 text-xs text-zinc-400">
              <a
                href={selected.fuenteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                Fuente oficial ↗
              </a>
              <span>Intentos: {selected.intentos}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

