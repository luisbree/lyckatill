"use client";

import { useEffect, useState } from "react";
import {
  getLoteriasParaTurno,
  LOTERIAS_CONFIG,
  TURNOS_CONFIG,
} from "@/lib/quiniela/config";
import type {
  EstrategiaSimulacion,
  ResumenSimulaciones,
  SimulacionEvaluada,
} from "@/lib/quiniela/simulator";
import type { AtrasosPorLoteria } from "@/lib/quiniela/stats";
import { TURNO_IDS, type TurnoId } from "@/lib/quiniela/types";
import type { SeasonTheme } from "@/lib/theme/season";
import { SimuladorBalancePanel } from "./SimuladorBalancePanel";

interface SimuladorJugadasProps {
  atrasos: AtrasosPorLoteria | null;
  theme: SeasonTheme;
  refreshTick: number;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export function SimuladorJugadas({
  atrasos,
  theme,
  refreshTick,
}: SimuladorJugadasProps) {
  const [simulaciones, setSimulaciones] = useState<SimulacionEvaluada[]>([]);
  const [resumen, setResumen] = useState<ResumenSimulaciones>({
    totalApostado: 0,
    totalGanado: 0,
    balanceNeto: 0,
    activas: 0,
    acertadas: 0,
  });
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [turnoInicio, setTurnoInicio] = useState<TurnoId>("previa");
  const [apuestaPorSorteo, setApuestaPorSorteo] = useState<number>(100);
  const [multiplicador3C, setMultiplicador3C] = useState<number>(600);
  const [multiplicador2C, setMultiplicador2C] = useState<number>(70);
  const [usarCandidatos, setUsarCandidatos] = useState<boolean>(true);
  const [usarAtrasados, setUsarAtrasados] = useState<boolean>(false);
  const [usar3Cifras, setUsar3Cifras] = useState<boolean>(true);
  const [usar2Cifras, setUsar2Cifras] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [localTick, setLocalTick] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/simulaciones", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar simulaciones");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setSimulaciones(
          Array.isArray(data.simulaciones) ? data.simulaciones : []
        );
        if (data.resumen) setResumen(data.resumen);
        if (!fechaInicio && typeof data.fechaMananaSugerida === "string") {
          setFechaInicio(data.fechaMananaSugerida);
        }
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Error en simulador"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshTick, localTick, fechaInicio]);

  const dayOfWeek = fechaInicio
    ? new Date(`${fechaInicio}T12:00:00-03:00`).getUTCDay()
    : undefined;
  const loteriasDelTurno = getLoteriasParaTurno(turnoInicio, dayOfWeek);

  async function handleCrearSimulacion() {
    if (!atrasos) return;
    if (!usarCandidatos && !usarAtrasados) return;
    if (!usar3Cifras && !usar2Cifras) return;

    const jugadas = loteriasDelTurno.flatMap((loteriaCfg) => {
      const loteriaId = loteriaCfg.id;
      const stat = atrasos[loteriaId];
      if (!stat) return [];

      const items: Array<{
        loteria: typeof loteriaId;
        numero: string;
        cifras: 2 | 3;
        estrategia: EstrategiaSimulacion;
        multiplicadorPremio: number;
      }> = [];

      const sets: Array<{
        estrategia: EstrategiaSimulacion;
        c: string;
        d: string;
        u: string;
      }> = [];

      if (usarCandidatos) {
        sets.push({
          estrategia: "candidatos",
          c: stat.candidatoCentena[0]?.digito ?? "0",
          d: stat.candidatoDecena[0]?.digito ?? "0",
          u: stat.candidatoUnidad[0]?.digito ?? "0",
        });
      }

      if (usarAtrasados) {
        sets.push({
          estrategia: "atrasados",
          c: stat.centena.digito,
          d: stat.decena.digito,
          u: stat.unidad.digito,
        });
      }

      for (const s of sets) {
        if (usar3Cifras) {
          items.push({
            loteria: loteriaId,
            numero: `${s.c}${s.d}${s.u}`,
            cifras: 3,
            estrategia: s.estrategia,
            multiplicadorPremio: multiplicador3C,
          });
        }
        if (usar2Cifras) {
          items.push({
            loteria: loteriaId,
            numero: `${s.d}${s.u}`,
            cifras: 2,
            estrategia: s.estrategia,
            multiplicadorPremio: multiplicador2C,
          });
        }
      }

      return items;
    });

    if (jugadas.length === 0) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/simulaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jugadas,
          apuestaPorSorteo,
          multiplicadorPremio: multiplicador3C,
          ...(fechaInicio ? { fechaInicio } : {}),
          turnoInicio,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear la jugada");
      setLocalTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear jugadas");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id?: string) {
    setBusy(true);
    setError(null);
    try {
      const qs = id ? `?id=${encodeURIComponent(id)}` : "?all=true";
      const res = await fetch(`/api/simulaciones${qs}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar");
      setLocalTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setBusy(false);
    }
  }

  const cantidadLoteriasDisponibles = atrasos
    ? loteriasDelTurno.filter((cfg) => Boolean(atrasos[cfg.id])).length
    : 0;
  const totalJugadasPreview =
    cantidadLoteriasDisponibles *
    ((usarCandidatos ? 1 : 0) + (usarAtrasados ? 1 : 0)) *
    ((usar3Cifras ? 1 : 0) + (usar2Cifras ? 1 : 0));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Simulador de jugadas
          </h2>
          <p className="text-xs text-zinc-500">
            Jugadas por turno (2 cifras D·U o 3 cifras C·D·U) con balance
            acumulado en Firestore.
          </p>
        </div>
      </div>

      {/* Tarjetas de balance */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          className={`rounded-xl border ${theme.cardBorder} bg-white/90 dark:bg-zinc-950/90 p-3.5`}
        >
          <div className="text-[11px] text-zinc-500">Gastos (apostado)</div>
          <div className="mt-1 font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {formatMoney(resumen.totalApostado)}
          </div>
        </div>
        <div
          className={`rounded-xl border ${theme.cardBorder} bg-white/90 dark:bg-zinc-950/90 p-3.5`}
        >
          <div className="text-[11px] text-zinc-500">Ganancias</div>
          <div className="mt-1 font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">
            {formatMoney(resumen.totalGanado)}
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

      <SimuladorBalancePanel simulaciones={simulaciones} theme={theme} />

      {/* Controles para lanzar jugadas simuladas */}
      <div
        className={`space-y-4 rounded-xl border ${theme.cardBorder} bg-white/90 dark:bg-zinc-950/90 p-4`}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="sim-fecha"
              className="block text-[11px] font-medium text-zinc-500 mb-1"
            >
              Fecha del turno
            </label>
            <input
              id="sim-fecha"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label
              htmlFor="sim-turno"
              className="block text-[11px] font-medium text-zinc-500 mb-1"
            >
              Turno
            </label>
            <select
              id="sim-turno"
              value={turnoInicio}
              onChange={(e) => setTurnoInicio(e.target.value as TurnoId)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100"
            >
              {TURNO_IDS.map((t) => (
                <option key={t} value={t}>
                  {TURNOS_CONFIG[t].nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="sim-apuesta"
              className="block text-[11px] font-medium text-zinc-500 mb-1"
            >
              Apuesta / sorteo ($)
            </label>
            <input
              id="sim-apuesta"
              type="number"
              min={1}
              value={apuestaPorSorteo}
              onChange={(e) =>
                setApuestaPorSorteo(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-28 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label
              htmlFor="sim-mult3"
              className="block text-[11px] font-medium text-zinc-500 mb-1"
            >
              Pago 3 cifras (x)
            </label>
            <input
              id="sim-mult3"
              type="number"
              min={1}
              value={multiplicador3C}
              onChange={(e) =>
                setMultiplicador3C(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-24 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label
              htmlFor="sim-mult2"
              className="block text-[11px] font-medium text-zinc-500 mb-1"
            >
              Pago 2 cifras (x)
            </label>
            <input
              id="sim-mult2"
              type="number"
              min={1}
              value={multiplicador2C}
              onChange={(e) =>
                setMultiplicador2C(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-24 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-700 dark:text-zinc-300">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-zinc-500">Set:</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usarCandidatos}
                  onChange={(e) => setUsarCandidatos(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                <span>Candidatos</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usarAtrasados}
                  onChange={(e) => setUsarAtrasados(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                <span>Más atrasados</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-zinc-500">Cifras:</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usar3Cifras}
                  onChange={(e) => setUsar3Cifras(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                <span>3 cifras ({multiplicador3C}x)</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usar2Cifras}
                  onChange={(e) => setUsar2Cifras(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                <span>2 cifras ({multiplicador2C}x)</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCrearSimulacion()}
              disabled={busy || totalJugadasPreview === 0}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${theme.primaryButton}`}
            >
              {busy
                ? "Guardando..."
                : `Simular (${totalJugadasPreview} jugadas)`}
            </button>
            {simulaciones.length > 0 && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={busy}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
              >
                Limpiar todo
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {simulaciones.length > 0 && (
        <div
          className={`overflow-x-auto rounded-xl border ${theme.cardBorder} bg-white/95 dark:bg-zinc-950/95`}
        >
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className={`border-b ${theme.cardBorder} ${theme.tableHeader}`}>
                <th className="px-3 py-2.5 font-semibold">Lotería</th>
                <th className="px-3 py-2.5 font-semibold text-center">
                  Número
                </th>
                <th className="px-3 py-2.5 font-semibold">Fecha · Turno</th>
                <th className="px-3 py-2.5 font-semibold text-right">
                  Sorteos
                </th>
                <th className="px-3 py-2.5 font-semibold text-right">Gasto</th>
                <th className="px-3 py-2.5 font-semibold text-right">
                  Ganancia
                </th>
                <th className="px-3 py-2.5 font-semibold text-right">
                  Balance
                </th>
                <th className="px-3 py-2.5 font-semibold">Estado</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {simulaciones.map((sim) => (
                <tr key={sim.id}>
                  <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                    {LOTERIAS_CONFIG[sim.loteria].nombre}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 font-mono text-sm font-bold tracking-wider">
                        {sim.numero}
                      </span>
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                        {sim.cifras ?? sim.numero.length}C · {sim.multiplicadorPremio}x
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          sim.estrategia === "atrasados"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
                            : "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
                        }`}
                      >
                        {sim.estrategia === "atrasados" ? "Atrasado" : "Candidato"}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500">
                    {sim.fechaInicio} · {TURNOS_CONFIG[sim.turnoInicio].nombre}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {sim.sorteosJugados}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {formatMoney(sim.gastoTotal)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                    {formatMoney(sim.gananciaBruta)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono font-semibold ${
                      sim.balance >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {formatMoney(sim.balance)}
                  </td>
                  <td className="px-3 py-2.5">
                    {sim.acierto ? (
                      <span className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                        Salió {sim.acierto.cabeza}
                      </span>
                    ) : sim.estado === "cerrada" ? (
                      <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                        No salió
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                        Esperando sorteo
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDelete(sim.id)}
                      disabled={busy}
                      className="text-zinc-400 hover:text-rose-600 px-1.5 py-0.5"
                      title="Eliminar jugada"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
