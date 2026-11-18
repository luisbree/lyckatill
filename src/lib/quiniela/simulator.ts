import { adminDb } from "@/lib/firebase/admin";
import { getFechaRioplatense } from "./repository";
import { TURNO_ORDER, type SorteoResumen } from "./stats";
import { LOTERIA_IDS, type LoteriaId, type TurnoId } from "./types";

export const SIMULACIONES_COLLECTION = "simulaciones";

export type EstadoSimulacion = "activa" | "acertada" | "cerrada";
export type EstrategiaSimulacion = "candidatos" | "atrasados";

export interface SimulacionDocument {
  id: string;
  loteria: LoteriaId;
  numero: string; // 2 o 3 dígitos (D·U o C·D·U)
  cifras?: 2 | 3;
  estrategia?: EstrategiaSimulacion;
  archivada?: boolean;
  apuestaPorSorteo: number;
  multiplicadorPremio: number;
  fechaInicio: string; // YYYY-MM-DD
  turnoInicio: TurnoId;
  estado: EstadoSimulacion;
  creadoEn: string;
}

export interface SimulacionEvaluada extends SimulacionDocument {
  sorteosJugados: number;
  gastoTotal: number;
  gananciaBruta: number;
  balance: number;
  numeroSorteado: string | null;
  acierto: {
    fecha: string;
    turno: TurnoId;
    cabeza: string;
  } | null;
}

export interface ResumenSimulaciones {
  totalApostado: number;
  totalGanado: number;
  balanceNeto: number;
  activas: number;
  acertadas: number;
}

/**
 * Devuelve la fecha de mañana (YYYY-MM-DD) en America/Argentina/Buenos_Aires.
 */
export function getFechaMananaRioplatense(): string {
  const hoy = getFechaRioplatense();
  const date = new Date(`${hoy}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function listSimulaciones(): Promise<SimulacionDocument[]> {
  const snapshot = await adminDb
    .collection(SIMULACIONES_COLLECTION)
    .orderBy("creadoEn", "desc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<SimulacionDocument, "id">),
  }));
}

export async function createSimulacionesBatch(
  items: Array<Omit<SimulacionDocument, "id" | "creadoEn" | "estado">>
): Promise<SimulacionDocument[]> {
  const now = new Date().toISOString();
  const batch = adminDb.batch();
  const created: SimulacionDocument[] = [];

  for (const item of items) {
    const ref = adminDb.collection(SIMULACIONES_COLLECTION).doc();
    const docData: Omit<SimulacionDocument, "id"> = {
      ...item,
      estado: "activa",
      creadoEn: now,
    };
    batch.set(ref, docData);
    created.push({ id: ref.id, ...docData });
  }

  await batch.commit();
  return created;
}

export async function deleteSimulacion(id: string): Promise<void> {
  await adminDb.collection(SIMULACIONES_COLLECTION).doc(id).delete();
}

export async function deleteAllSimulaciones(): Promise<void> {
  const snapshot = await adminDb.collection(SIMULACIONES_COLLECTION).get();
  if (snapshot.empty) return;
  const batch = adminDb.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}

/**
 * Deshace las jugadas pendientes ("activa", aún no sorteadas) eliminándolas
 * para revertir su gasto, y archiva las jugadas ya sorteadas para conservar
 * sus ganancias/pérdidas en el balance acumulado.
 */
export async function limpiarListaSimulaciones(
  sorteosPublicados: SorteoResumen[]
): Promise<{ eliminadas: number; archivadas: number }> {
  const sims = await listSimulaciones();
  if (sims.length === 0) return { eliminadas: 0, archivadas: 0 };

  const { simulaciones: evaluadas } = evaluarSimulaciones(
    sims,
    sorteosPublicados
  );

  const batch = adminDb.batch();
  let eliminadas = 0;
  let archivadas = 0;

  for (const sim of evaluadas) {
    if (sim.archivada) continue;
    const ref = adminDb.collection(SIMULACIONES_COLLECTION).doc(sim.id);

    if (sim.estado === "activa") {
      batch.delete(ref);
      eliminadas++;
    } else {
      batch.update(ref, { archivada: true });
      archivadas++;
    }
  }

  if (eliminadas > 0 || archivadas > 0) {
    await batch.commit();
  }

  return { eliminadas, archivadas };
}

/**
 * Evalúa cada jugada simulada para su turno puntual (fechaInicio + turnoInicio).
 * El gasto se computa desde el momento en que se carga la jugada.
 */
export function evaluarSimulaciones(
  simulaciones: SimulacionDocument[],
  sorteosPublicados: SorteoResumen[]
): {
  simulaciones: SimulacionEvaluada[];
  resumen: ResumenSimulaciones;
} {
  const sorteoPorClave = new Map<string, SorteoResumen>();

  for (const s of sorteosPublicados) {
    if (s.estado !== "publicado" || !s.cabeza || s.cabeza.length < 3) continue;
    sorteoPorClave.set(`${s.loteria}_${s.fecha}_${s.turno}`, s);
  }

  let totalApostado = 0;
  let totalGanado = 0;
  let activas = 0;
  let acertadas = 0;

  const evaluadas: SimulacionEvaluada[] = simulaciones.map((sim) => {
    const sorteo = sorteoPorClave.get(
      `${sim.loteria}_${sim.fechaInicio}_${sim.turnoInicio}`
    );

    let acierto: SimulacionEvaluada["acierto"] = null;
    if (sorteo?.cabeza) {
      const ultimas = sorteo.cabeza.slice(-sim.numero.length);
      if (ultimas === sim.numero) {
        acierto = {
          fecha: sorteo.fecha,
          turno: sorteo.turno,
          cabeza: sorteo.cabeza,
        };
      }
    }

    const sorteosJugados = sorteo ? 1 : 0;
    const gastoTotal = sim.apuestaPorSorteo;
    const gananciaBruta = acierto
      ? sim.apuestaPorSorteo * sim.multiplicadorPremio
      : 0;
    const balance = gananciaBruta - gastoTotal;

    totalApostado += gastoTotal;
    totalGanado += gananciaBruta;

    if (acierto) {
      acertadas++;
    } else if (!sorteo) {
      activas++;
    }

    const estado = acierto ? "acertada" : sorteo ? "cerrada" : "activa";

    return {
      ...sim,
      estado,
      sorteosJugados,
      gastoTotal,
      gananciaBruta,
      balance,
      numeroSorteado: sorteo?.cabeza ?? null,
      acierto,
    };
  });

  // Ordenar: fecha desc, turno desc, lotería en orden de tabla principal, estrategia, cifras
  evaluadas.sort((a, b) => {
    if (a.fechaInicio !== b.fechaInicio) {
      return b.fechaInicio.localeCompare(a.fechaInicio);
    }
    const turnoDiff = TURNO_ORDER[b.turnoInicio] - TURNO_ORDER[a.turnoInicio];
    if (turnoDiff !== 0) return turnoDiff;

    const lotDiff =
      LOTERIA_IDS.indexOf(a.loteria) - LOTERIA_IDS.indexOf(b.loteria);
    if (lotDiff !== 0) return lotDiff;

    if (a.estrategia !== b.estrategia) {
      return a.estrategia === "candidatos" ? -1 : 1;
    }
    return (b.cifras ?? b.numero.length) - (a.cifras ?? a.numero.length);
  });

  return {
    simulaciones: evaluadas,
    resumen: {
      totalApostado,
      totalGanado,
      balanceNeto: totalGanado - totalApostado,
      activas,
      acertadas,
    },
  };
}
