import { z } from "zod";
import {
  ESTADO_SORTEO_VALUES,
  LOTERIA_IDS,
  TURNO_IDS,
} from "./types";

export {
  ESTADO_SORTEO_VALUES,
  LOTERIA_IDS,
  TURNO_IDS,
  type EstadoSorteo,
  type ExtractoNormalizado,
  type LoteriaId,
  type RecoleccionLog,
  type SorteoDocument,
  type TurnoId,
} from "./types";

export const LoteriaIdSchema = z.enum(LOTERIA_IDS);
export const TurnoIdSchema = z.enum(TURNO_IDS);
export const EstadoSorteoSchema = z.enum(ESTADO_SORTEO_VALUES);

/**
 * Un número de premio de quiniela:
 * - Argentina: 4 dígitos ("0000" a "9999")
 * - Uruguay: 3 dígitos ("000" a "999")
 */
export const PremioSchema = z
  .string()
  .trim()
  .regex(/^\d{3,4}$/, "El premio debe tener 3 o 4 dígitos");

/**
 * Salida normalizada que debe producir cualquier extractor o flow de Genkit.
 */
export const ExtractoNormalizadoSchema = z.object({
  publicado: z.boolean(),
  cabeza: PremioSchema.nullable(),
  premios: z.array(PremioSchema).max(20),
  numeroSorteo: z.string().trim().nullable().optional(),
});

/**
 * Documento almacenado en Firestore en la colección `sorteos`.
 * ID determinístico: `${fecha}_${loteria}_${turno}` (ej. `2026-11-16_ciudad_previa`).
 */
export const SorteoDocumentSchema = z.object({
  id: z.string(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  loteria: LoteriaIdSchema,
  turno: TurnoIdSchema,
  estado: EstadoSorteoSchema,
  cabeza: PremioSchema.nullable(),
  premios: z.array(PremioSchema),
  numeroSorteo: z.string().nullable(),
  fuenteUrl: z.string().url(),
  intentos: z.number().int().nonnegative(),
  errorMensaje: z.string().nullable(),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});

/**
 * Log de cada corrida programada en la colección `recolecciones`.
 */
export const RecoleccionLogSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turno: TurnoIdSchema,
  iniciadoEn: z.string(),
  finalizadoEn: z.string(),
  total: z.number().int().nonnegative(),
  publicados: z.number().int().nonnegative(),
  pendientes: z.number().int().nonnegative(),
  errores: z.number().int().nonnegative(),
  detalles: z.array(
    z.object({
      loteria: LoteriaIdSchema,
      estado: EstadoSorteoSchema,
      mensaje: z.string().optional(),
    })
  ),
});

