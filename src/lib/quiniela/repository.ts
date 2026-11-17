import { adminDb } from "@/lib/firebase/admin";
import { LOTERIAS_CONFIG } from "./config";
import type {
  ExtractoNormalizado,
  LoteriaId,
  RecoleccionLog,
  SorteoDocument,
  TurnoId,
} from "./schema";

export const SORTEOS_COLLECTION = "sorteos";
export const RECOLECCIONES_COLLECTION = "recolecciones";

/**
 * Devuelve la fecha actual en zona horaria de Argentina/Uruguay (UTC-3)
 * con formato YYYY-MM-DD.
 */
export function getFechaRioplatense(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Genera el ID determinístico de un sorteo en Firestore para evitar duplicados.
 */
export function buildSorteoDocId(
  fecha: string,
  loteria: LoteriaId,
  turno: TurnoId
): string {
  return `${fecha}_${loteria}_${turno}`;
}

/**
 * Guarda o actualiza el resultado de un sorteo en Firestore.
 * Si el sorteo ya estaba publicado, no lo pisa con un estado pendiente o error.
 */
export async function upsertSorteoResultado(params: {
  fecha: string;
  loteria: LoteriaId;
  turno: TurnoId;
  extracto?: ExtractoNormalizado;
  errorMensaje?: string;
}): Promise<SorteoDocument> {
  const { fecha, loteria, turno, extracto, errorMensaje } = params;
  const id = buildSorteoDocId(fecha, loteria, turno);
  const docRef = adminDb.collection(SORTEOS_COLLECTION).doc(id);
  const now = new Date().toISOString();
  const fuenteUrl = LOTERIAS_CONFIG[loteria].fuenteUrl;

  const existingSnap = await docRef.get();
  const existing = existingSnap.exists
    ? (existingSnap.data() as SorteoDocument)
    : null;

  // Si ya está publicado y esta corrida falló o vino vacía, preservamos el publicado.
  if (existing?.estado === "publicado" && !extracto?.publicado) {
    return existing;
  }

  const isPublicado = Boolean(extracto?.publicado && extracto.cabeza);

  const nextDoc: SorteoDocument = {
    id,
    fecha,
    loteria,
    turno,
    estado: errorMensaje
      ? "error"
      : isPublicado
        ? "publicado"
        : "pendiente",
    cabeza: isPublicado ? (extracto?.cabeza ?? null) : (existing?.cabeza ?? null),
    premios: isPublicado ? (extracto?.premios ?? []) : (existing?.premios ?? []),
    numeroSorteo:
      extracto?.numeroSorteo ?? existing?.numeroSorteo ?? null,
    fuenteUrl,
    intentos: (existing?.intentos ?? 0) + 1,
    errorMensaje: errorMensaje ?? null,
    creadoEn: existing?.creadoEn ?? now,
    actualizadoEn: now,
  };

  await docRef.set(nextDoc, { merge: true });
  return nextDoc;
}

/**
 * Obtiene todos los sorteos de una fecha (YYYY-MM-DD).
 */
export async function getSorteosPorFecha(
  fecha: string
): Promise<SorteoDocument[]> {
  const snapshot = await adminDb
    .collection(SORTEOS_COLLECTION)
    .where("fecha", "==", fecha)
    .get();

  return snapshot.docs.map((doc) => doc.data() as SorteoDocument);
}

/**
 * Obtiene sorteos pendientes o con error para reintentar en una fecha y turno.
 */
export async function getSorteosPendientes(
  fecha: string,
  turno?: TurnoId
): Promise<SorteoDocument[]> {
  let query = adminDb
    .collection(SORTEOS_COLLECTION)
    .where("fecha", "==", fecha)
    .where("estado", "in", ["pendiente", "error"]);

  if (turno) {
    query = query.where("turno", "==", turno);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => doc.data() as SorteoDocument);
}

/**
 * Registra el resumen de una ejecución del cron de recolección.
 */
export async function saveRecoleccionLog(log: RecoleccionLog): Promise<string> {
  const ref = await adminDb.collection(RECOLECCIONES_COLLECTION).add(log);
  return ref.id;
}

