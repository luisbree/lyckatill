export const LOTERIA_IDS = [
  "ciudad",
  "provincia",
  "cordoba",
  "santa_fe",
  "mendoza",
  "entre_rios",
  "uruguay",
] as const;

export const TURNO_IDS = [
  "previa",
  "primera",
  "matutina",
  "vespertina",
  "nocturna",
] as const;

export const ESTADO_SORTEO_VALUES = [
  "pendiente",
  "publicado",
  "error",
] as const;

export type LoteriaId = (typeof LOTERIA_IDS)[number];
export type TurnoId = (typeof TURNO_IDS)[number];
export type EstadoSorteo = (typeof ESTADO_SORTEO_VALUES)[number];

export interface ExtractoNormalizado {
  publicado: boolean;
  cabeza: string | null;
  premios: string[];
  numeroSorteo?: string | null;
}

export interface SorteoDocument {
  id: string;
  fecha: string;
  loteria: LoteriaId;
  turno: TurnoId;
  estado: EstadoSorteo;
  cabeza: string | null;
  premios: string[];
  numeroSorteo: string | null;
  fuenteUrl: string;
  intentos: number;
  errorMensaje: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface RecoleccionLog {
  fecha: string;
  turno: TurnoId;
  iniciadoEn: string;
  finalizadoEn: string;
  total: number;
  publicados: number;
  pendientes: number;
  errores: number;
  detalles: Array<{
    loteria: LoteriaId;
    estado: EstadoSorteo;
    mensaje?: string;
  }>;
}

