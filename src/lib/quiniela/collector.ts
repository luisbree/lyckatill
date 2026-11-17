import { getLoteriasParaTurno } from "./config";
import { fetchLoteriaSetFromCordobaApi } from "./extractors/cordobaApi";
import { fetchMendozaExtracto } from "./extractors/mendoza";
import { fetchUruguayExtracto } from "./extractors/uruguay";
import {
  getFechaRioplatense,
  getSorteosPorFecha,
  saveRecoleccionLog,
  upsertSorteoResultado,
} from "./repository";
import type {
  EstadoSorteo,
  ExtractoNormalizado,
  LoteriaId,
  RecoleccionLog,
  TurnoId,
} from "./types";

export interface CollectTurnoOptions {
  turno: TurnoId;
  fecha?: string;
  onlyPending?: boolean;
}

const CORDOBA_API_LOTERIAS = new Set<LoteriaId>([
  "ciudad",
  "provincia",
  "cordoba",
  "santa_fe",
  "entre_rios",
]);

function getDayOfWeekFromFecha(fecha: string): number {
  const date = new Date(`${fecha}T12:00:00-03:00`);
  return date.getUTCDay();
}

/**
 * Ejecuta la recolección determinística (sin IA) de todas las loterías
 * correspondientes a un turno y guarda los resultados en Firestore.
 */
export async function collectTurno({
  turno,
  fecha = getFechaRioplatense(),
  onlyPending = false,
}: CollectTurnoOptions): Promise<RecoleccionLog> {
  const iniciadoEn = new Date().toISOString();
  const dayOfWeek = getDayOfWeekFromFecha(fecha);
  let loterias = getLoteriasParaTurno(turno, dayOfWeek);

  if (onlyPending) {
    const existentes = await getSorteosPorFecha(fecha);
    const publicados = new Set(
      existentes
        .filter((s) => s.turno === turno && s.estado === "publicado")
        .map((s) => s.loteria)
    );
    loterias = loterias.filter((l) => !publicados.has(l.id));
  }

  const detalles: Array<{
    loteria: LoteriaId;
    estado: EstadoSorteo;
    mensaje?: string;
  }> = [];

  const cbaLoterias = loterias
    .map((l) => l.id)
    .filter((id) => CORDOBA_API_LOTERIAS.has(id));
  const otrasLoterias = loterias
    .map((l) => l.id)
    .filter((id) => !CORDOBA_API_LOTERIAS.has(id));

  // 1. Loterías cubiertas en bloque por la API JSON oficial de Córdoba
  if (cbaLoterias.length > 0) {
    try {
      const resultados = await fetchLoteriaSetFromCordobaApi(
        turno,
        fecha,
        cbaLoterias
      );

      await Promise.all(
        cbaLoterias.map(async (loteria) => {
          const extracto: ExtractoNormalizado = resultados[loteria] ?? {
            publicado: false,
            cabeza: null,
            premios: [],
            numeroSorteo: null,
          };

          const doc = await upsertSorteoResultado({
            fecha,
            loteria,
            turno,
            extracto,
          });

          detalles.push({
            loteria,
            estado: doc.estado,
            mensaje:
              doc.estado === "publicado"
                ? `Cabeza: ${doc.cabeza}`
                : "Aún no publicado",
          });
        })
      );
    } catch (err) {
      const errorMensaje =
        err instanceof Error
          ? err.message
          : "Error al consultar API de Córdoba";

      await Promise.all(
        cbaLoterias.map(async (loteria) => {
          const doc = await upsertSorteoResultado({
            fecha,
            loteria,
            turno,
            errorMensaje,
          });
          detalles.push({
            loteria,
            estado: doc.estado,
            mensaje: errorMensaje,
          });
        })
      );
    }
  }

  // 2. Resto de loterías (Uruguay, Mendoza)
  await Promise.all(
    otrasLoterias.map(async (loteria) => {
      try {
        const extracto =
          loteria === "uruguay"
            ? await fetchUruguayExtracto(turno, fecha)
            : await fetchMendozaExtracto(turno, fecha);

        const doc = await upsertSorteoResultado({
          fecha,
          loteria,
          turno,
          extracto,
        });

        detalles.push({
          loteria,
          estado: doc.estado,
          mensaje:
            doc.estado === "publicado"
              ? `Cabeza: ${doc.cabeza}`
              : "Aún no publicado",
        });
      } catch (err) {
        const errorMensaje =
          err instanceof Error
            ? err.message
            : "Error desconocido al recolectar";

        const doc = await upsertSorteoResultado({
          fecha,
          loteria,
          turno,
          errorMensaje,
        });

        detalles.push({
          loteria,
          estado: doc.estado,
          mensaje: errorMensaje,
        });
      }
    })
  );

  const finalizadoEn = new Date().toISOString();
  const log: RecoleccionLog = {
    fecha,
    turno,
    iniciadoEn,
    finalizadoEn,
    total: detalles.length,
    publicados: detalles.filter((d) => d.estado === "publicado").length,
    pendientes: detalles.filter((d) => d.estado === "pendiente").length,
    errores: detalles.filter((d) => d.estado === "error").length,
    detalles,
  };

  await saveRecoleccionLog(log);
  return log;
}
