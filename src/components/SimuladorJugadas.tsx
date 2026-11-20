"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { LOTERIA_IDS, TURNO_IDS, type TurnoId } from "@/lib/quiniela/types";
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

/**
 * Compara dígito a dígito desde la derecha (Unidad, Decena, Centena)
 * y resalta en color las coincidencias posicionales exactas.
 */
function DigitosResaltados({
  valor,
  referencia,
}: {
  valor: string;
  referencia: string | null;
}) {
  const chars = valor.split("");
  return (
    <span className="inline-flex items-center font-mono text-sm font-bold tracking-wider">
      {chars.map((ch, idx) => {
        const posDesdeDerecha = chars.length - 1 - idx;
        const refIdx = referencia ? referencia.length - 1 - posDesdeDerecha : -1;
        const coincide =
          referencia !== null &&
          refIdx >= 0 &&
          posDesdeDerecha < 3 &&
          referencia[refIdx] === ch;

        return (
          <span
            key={idx}
            className={
              coincide
                ? "rounded bg-emerald-500 px-0.5 text-white dark:bg-emerald-500 dark:text-zinc-950"
                : ""
            }
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

function getSiguienteTurno(
  fecha: string,
  turno: TurnoId
): { fecha: string; turno: TurnoId } {
  const idx = TURNO_IDS.indexOf(turno);
  if (idx >= 0 && idx < TURNO_IDS.length - 1) {
    return { fecha, turno: TURNO_IDS[idx + 1] };
  }

  // Después de Nocturna pasa a La Previa del próximo día hábil (saltando domingo)
  const date = new Date(`${fecha}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  if (date.getUTCDay() === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return { fecha: date.toISOString().slice(0, 10), turno: "previa" };
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
  const [apuestaPorSorteo, setApuestaPorSorteo] = useState<number>(150);
  const [multiplicador3C, setMultiplicador3C] = useState<number>(600);
  const [multiplicador2C, setMultiplicador2C] = useState<number>(70);
  const [usarCandidatos, setUsarCandidatos] = useState<boolean>(true);
  const [usarAtrasados, setUsarAtrasados] = useState<boolean>(true);
  const [usarEco, setUsarEco] = useState<boolean>(true);
  const [usarAmbosAtrasados, setUsarAmbosAtrasados] = useState<boolean>(false);
  const [modelosOpen, setModelosOpen] = useState<boolean>(false);
  const [usar3Cifras, setUsar3Cifras] = useState<boolean>(true);
  const [usar2Cifras, setUsar2Cifras] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [localTick, setLocalTick] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [openJugadas, setOpenJugadas] = useState<boolean>(true);
  const [verTodasJugadas, setVerTodasJugadas] = useState<boolean>(false);
  const [historialPageIdx, setHistorialPageIdx] = useState<number>(0);
  const fechaInicializadaRef = useRef<boolean>(false);
  const ultimoBatchAvanzadoRef = useRef<string | null>(null);

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
        const lista: SimulacionEvaluada[] = Array.isArray(data.simulaciones)
          ? data.simulaciones
          : [];
        setSimulaciones(lista);
        if (data.resumen) setResumen(data.resumen);

        // Si el último lote ya fue sorteado y cotejado por completo, avanzar al siguiente turno
        const ultimo = lista[0];
        if (ultimo) {
          const loteKey = `${ultimo.fechaInicio}_${ultimo.turnoInicio}`;
          const lote = lista.filter(
            (s) =>
              s.fechaInicio === ultimo.fechaInicio &&
              s.turnoInicio === ultimo.turnoInicio
          );
          const todoCotejado =
            lote.length > 0 && lote.every((s) => s.estado !== "activa");

          if (todoCotejado && ultimoBatchAvanzadoRef.current !== loteKey) {
            const siguiente = getSiguienteTurno(
              ultimo.fechaInicio,
              ultimo.turnoInicio
            );
            setFechaInicio(siguiente.fecha);
            setTurnoInicio(siguiente.turno);
            fechaInicializadaRef.current = true;
            ultimoBatchAvanzadoRef.current = loteKey;
          } else if (!fechaInicializadaRef.current) {
            setFechaInicio(ultimo.fechaInicio);
            setTurnoInicio(ultimo.turnoInicio);
            fechaInicializadaRef.current = true;
          }
        } else if (
          !fechaInicializadaRef.current &&
          typeof data.fechaMananaSugerida === "string"
        ) {
          setFechaInicio(data.fechaMananaSugerida);
          fechaInicializadaRef.current = true;
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
  }, [refreshTick, localTick]);

  const dayOfWeek = fechaInicio
    ? new Date(`${fechaInicio}T12:00:00-03:00`).getUTCDay()
    : undefined;
  const loteriasDelTurno = getLoteriasParaTurno(turnoInicio, dayOfWeek);

  const modelosDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        modelosDropdownRef.current &&
        !modelosDropdownRef.current.contains(e.target as Node)
      ) {
        setModelosOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleCrearSimulacion() {
    if (!atrasos) return;
    const hayEstrategiaEstandar = usarCandidatos || usarAtrasados || usarEco;
    const hayCifrasEstandar = usar3Cifras || usar2Cifras;
    if ((!hayEstrategiaEstandar || !hayCifrasEstandar) && !usarAmbosAtrasados) {
      return;
    }

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

      if (usarEco) {
        sets.push({
          estrategia: "eco",
          c: stat.ecoCentena[0]?.digito ?? "0",
          d: stat.ecoDecena[0]?.digito ?? "0",
          u: stat.ecoUnidad[0]?.digito ?? "0",
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

      // Nuevo modelo: 20 ambos (10 con unidad más atrasada + 10 con decena más atrasada), solo 2 cifras
      if (usarAmbosAtrasados) {
        const u = stat.unidad.digito;
        const d = stat.decena.digito;
        for (let i = 0; i <= 9; i++) {
          items.push({
            loteria: loteriaId,
            numero: `${i}${u}`,
            cifras: 2,
            estrategia: "ambos_atrasados",
            multiplicadorPremio: multiplicador2C,
          });
        }
        for (let i = 0; i <= 9; i++) {
          items.push({
            loteria: loteriaId,
            numero: `${d}${i}`,
            cifras: 2,
            estrategia: "ambos_atrasados",
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

  async function handleLimpiarLista() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/simulaciones", { method: "PATCH" });
      if (!res.ok) throw new Error("No se pudo limpiar la lista");
      setLocalTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al limpiar lista");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/simulaciones?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
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
  const modelosActivosCount =
    (usarCandidatos ? 1 : 0) +
    (usarAtrasados ? 1 : 0) +
    (usarEco ? 1 : 0) +
    (usarAmbosAtrasados ? 1 : 0);
  const totalJugadasPreview =
    cantidadLoteriasDisponibles *
      ((usarCandidatos ? 1 : 0) + (usarAtrasados ? 1 : 0) + (usarEco ? 1 : 0)) *
      ((usar3Cifras ? 1 : 0) + (usar2Cifras ? 1 : 0)) +
    (usarAmbosAtrasados ? cantidadLoteriasDisponibles * 20 : 0);

  const simulacionesActivasLista = simulaciones.filter((s) => !s.archivada);
  const ultimoTurnoJugado = simulacionesActivasLista[0]
    ? {
        fecha: simulacionesActivasLista[0].fechaInicio,
        turno: simulacionesActivasLista[0].turnoInicio,
      }
    : null;

  // Agrupamos todo el historial por jugada (fechaInicio + turnoInicio) para paginar
  const paginasHistorial: Array<{
    key: string;
    fecha: string;
    turno: TurnoId;
    items: SimulacionEvaluada[];
  }> = [];
  const paginaMap = new Map<string, number>();
  for (const s of simulaciones) {
    const key = `${s.fechaInicio}_${s.turnoInicio}`;
    const idx = paginaMap.get(key);
    if (idx === undefined) {
      paginaMap.set(key, paginasHistorial.length);
      paginasHistorial.push({
        key,
        fecha: s.fechaInicio,
        turno: s.turnoInicio,
        items: [s],
      });
    } else {
      paginasHistorial[idx].items.push(s);
    }
  }

  const safePageIdx =
    paginasHistorial.length > 0
      ? Math.min(historialPageIdx, paginasHistorial.length - 1)
      : 0;
  const paginaHistorialActual = paginasHistorial[safePageIdx] ?? null;

  const simulacionesVisibles = useMemo(() => {
    const raw = verTodasJugadas
      ? (paginaHistorialActual?.items ?? [])
      : ultimoTurnoJugado
        ? simulacionesActivasLista.filter(
            (s) =>
              s.fechaInicio === ultimoTurnoJugado.fecha &&
              s.turnoInicio === ultimoTurnoJugado.turno
          )
        : [];

    return [...raw].sort((a, b) => {
      const lotDiff =
        LOTERIA_IDS.indexOf(a.loteria) - LOTERIA_IDS.indexOf(b.loteria);
      if (lotDiff !== 0) return lotDiff;

      const numDiff = Number(a.numero) - Number(b.numero);
      if (numDiff !== 0) return numDiff;

      return a.numero.localeCompare(b.numero);
    });
  }, [
    verTodasJugadas,
    paginaHistorialActual,
    ultimoTurnoJugado,
    simulacionesActivasLista,
  ]);

  return (
    <section
      className={`rounded-2xl border-2 ${theme.cardBorder} bg-white/75 dark:bg-zinc-950/75 p-5 sm:p-6 shadow-md space-y-5`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 dark:border-zinc-800 pb-3">
        <div>
          <span
            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider mb-1 ${theme.badge}`}
          >
            Sección 2
          </span>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Simulador de jugadas
          </h2>
          <p className="text-xs text-zinc-500">
            Jugadas por turno (2 cifras D·U o 3 cifras C·D·U) con balance
            acumulado en Firestore.
          </p>
        </div>
      </div>

      <SimuladorBalancePanel
        simulaciones={simulaciones}
        resumen={resumen}
        theme={theme}
      />

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
              min={150}
              value={apuestaPorSorteo}
              onChange={(e) =>
                setApuestaPorSorteo(
                  Math.max(150, Number(e.target.value) || 150)
                )
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
            <div ref={modelosDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setModelosOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <span>Modelos ({modelosActivosCount}/4)</span>
                <span className="text-[10px] text-zinc-400">
                  {modelosOpen ? "▴" : "▾"}
                </span>
              </button>

              {modelosOpen && (
                <div className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 shadow-lg space-y-2">
                  <label className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usarCandidatos}
                      onChange={(e) => setUsarCandidatos(e.target.checked)}
                      className="rounded border-zinc-300"
                    />
                    <span>Candidatos</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usarAtrasados}
                      onChange={(e) => setUsarAtrasados(e.target.checked)}
                      className="rounded border-zinc-300"
                    />
                    <span>Más atrasados</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usarEco}
                      onChange={(e) => setUsarEco(e.target.checked)}
                      className="rounded border-zinc-300"
                    />
                    <span>Eco &amp; Equilibrio</span>
                  </label>
                  <label className="flex items-start gap-2 rounded-md px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer border-t border-zinc-100 dark:border-zinc-800 pt-2">
                    <input
                      type="checkbox"
                      checked={usarAmbosAtrasados}
                      onChange={(e) => setUsarAmbosAtrasados(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300"
                    />
                    <span>
                      <span className="block font-medium">Ambos atrasados</span>
                      <span className="block text-[10px] text-zinc-400">
                        20 números/lotería · solo 2 cifras
                      </span>
                    </span>
                  </label>
                </div>
              )}
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
            {simulacionesActivasLista.length > 0 && (
              <button
                type="button"
                onClick={() => void handleLimpiarLista()}
                disabled={busy}
                title="Oculta las jugadas actuales de la lista sin borrar el balance acumulado"
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

      {(simulacionesVisibles.length > 0 || simulaciones.length > 0) && (
        <div
          className={`overflow-x-auto rounded-xl border ${theme.cardBorder} bg-white/95 dark:bg-zinc-950/95`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
            <button
              type="button"
              onClick={() => setOpenJugadas((v) => !v)}
              className="flex items-center gap-2 text-left text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-50"
            >
              <span>
                {openJugadas ? "▾" : "▸"} Apuestas{" "}
                {verTodasJugadas && paginaHistorialActual
                  ? `(${paginaHistorialActual.fecha} · ${
                      TURNOS_CONFIG[paginaHistorialActual.turno].nombre
                    } · ${paginaHistorialActual.items.length})`
                  : ultimoTurnoJugado
                    ? `(${ultimoTurnoJugado.fecha} · ${
                        TURNOS_CONFIG[ultimoTurnoJugado.turno].nombre
                      } · ${simulacionesVisibles.length})`
                    : "(0)"}
              </span>
            </button>

            <div className="flex items-center gap-3">
              {paginasHistorial.length > 1 ||
              (simulaciones.length > simulacionesVisibles.length) ||
              verTodasJugadas ? (
                <button
                  type="button"
                  onClick={() => {
                    setHistorialPageIdx(0);
                    setVerTodasJugadas((v) => !v);
                  }}
                  className="text-[11px] font-medium text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  {verTodasJugadas
                    ? "Solo última jugada"
                    : `Ver historial (${paginasHistorial.length} jugadas)`}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpenJugadas((v) => !v)}
                className="text-[11px] text-zinc-400"
              >
                {openJugadas ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {openJugadas && verTodasJugadas && paginasHistorial.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 px-3.5 py-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  setHistorialPageIdx((i) => Math.max(0, i - 1))
                }
                disabled={safePageIdx === 0}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40"
              >
                ← Más reciente
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">
                  Jugada {safePageIdx + 1} de {paginasHistorial.length}:
                </span>
                <select
                  value={safePageIdx}
                  onChange={(e) => setHistorialPageIdx(Number(e.target.value))}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-[11px] font-medium text-zinc-800 dark:text-zinc-200"
                >
                  {paginasHistorial.map((p, idx) => (
                    <option key={p.key} value={idx}>
                      {p.fecha} · {TURNOS_CONFIG[p.turno].nombre} (
                      {p.items.length})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() =>
                  setHistorialPageIdx((i) =>
                    Math.min(paginasHistorial.length - 1, i + 1)
                  )
                }
                disabled={safePageIdx >= paginasHistorial.length - 1}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40"
              >
                Anterior →
              </button>
            </div>
          )}

          {openJugadas && (
          <table className="w-full border-collapse border-t border-zinc-100 dark:border-zinc-800 text-left text-xs">
            <thead>
              <tr className={`border-b ${theme.cardBorder} ${theme.tableHeader}`}>
                <th className="px-3 py-2.5 font-semibold">Lotería</th>
                <th className="px-3 py-2.5 font-semibold text-center">
                  Apostado
                </th>
                <th className="px-3 py-2.5 font-semibold text-center">
                  Salió
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
              {simulacionesVisibles.map((sim) => (
                <tr key={sim.id}>
                  <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                    {LOTERIAS_CONFIG[sim.loteria].nombre}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-0.5">
                        <DigitosResaltados
                          valor={sim.numero}
                          referencia={sim.numeroSorteado}
                        />
                      </span>
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                        {sim.cifras ?? sim.numero.length}C · {sim.multiplicadorPremio}x
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          sim.estrategia === "atrasados"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
                            : sim.estrategia === "eco"
                              ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200"
                              : sim.estrategia === "ambos_atrasados"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                                : "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
                        }`}
                      >
                        {sim.estrategia === "atrasados"
                          ? "Atrasado"
                          : sim.estrategia === "eco"
                            ? "Eco & Eq."
                            : sim.estrategia === "ambos_atrasados"
                              ? "Ambos Atr."
                              : "Candidato"}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {sim.numeroSorteado ? (
                      <span className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2 py-0.5">
                        <DigitosResaltados
                          valor={sim.numeroSorteado}
                          referencia={sim.numero}
                        />
                      </span>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-700">—</span>
                    )}
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
          )}
        </div>
      )}
    </section>
  );
}
