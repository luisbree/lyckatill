import type { LoteriaId, TurnoId } from "./types";

export interface LoteriaConfig {
  id: LoteriaId;
  nombre: string;
  pais: "AR" | "UY";
  fuenteUrl: string;
  turnos: readonly TurnoId[];
}

export const LOTERIAS_CONFIG: Record<LoteriaId, LoteriaConfig> = {
  ciudad: {
    id: "ciudad",
    nombre: "Ciudad",
    pais: "AR",
    fuenteUrl: "https://quiniela.loteriadelaciudad.gob.ar/",
    turnos: ["previa", "primera", "matutina", "vespertina", "nocturna"],
  },
  provincia: {
    id: "provincia",
    nombre: "Provincia",
    pais: "AR",
    fuenteUrl: "https://loteria.gba.gob.ar/resultados",
    turnos: ["previa", "primera", "matutina", "vespertina", "nocturna"],
  },
  cordoba: {
    id: "cordoba",
    nombre: "Córdoba",
    pais: "AR",
    fuenteUrl:
      "https://www.loteriadecordoba.com.ar/juegos/agencias/quiniela/resultados",
    turnos: ["previa", "primera", "matutina", "vespertina", "nocturna"],
  },
  santa_fe: {
    id: "santa_fe",
    nombre: "Santa Fe",
    pais: "AR",
    fuenteUrl: "https://www.loteriasantafe.gov.ar/acceso-extractos/",
    turnos: ["previa", "primera", "matutina", "vespertina", "nocturna"],
  },
  mendoza: {
    id: "mendoza",
    nombre: "Mendoza",
    pais: "AR",
    fuenteUrl: "https://quinielaoficialmendoza.com.ar/",
    turnos: ["previa", "primera", "matutina", "vespertina", "nocturna"],
  },
  entre_rios: {
    id: "entre_rios",
    nombre: "Entre Ríos",
    pais: "AR",
    fuenteUrl: "https://www.iafas.gov.ar/insumo-medios/extractos",
    turnos: ["previa", "primera", "matutina", "vespertina", "nocturna"],
  },
  uruguay: {
    id: "uruguay",
    nombre: "Uruguay",
    pais: "UY",
    fuenteUrl: "https://www.loteria.gub.uy/ver_resultados.php",
    turnos: ["vespertina", "nocturna"],
  },
};

export interface TurnoConfig {
  id: TurnoId;
  nombre: string;
  horaSorteoReferencia: string;
  horaRecoleccionSugerida: string;
}

export const TURNOS_CONFIG: Record<TurnoId, TurnoConfig> = {
  previa: {
    id: "previa",
    nombre: "La Previa",
    horaSorteoReferencia: "10:15",
    horaRecoleccionSugerida: "10:55",
  },
  primera: {
    id: "primera",
    nombre: "La Primera",
    horaSorteoReferencia: "12:00",
    horaRecoleccionSugerida: "12:40",
  },
  matutina: {
    id: "matutina",
    nombre: "Matutina",
    horaSorteoReferencia: "14:00 / 15:00",
    horaRecoleccionSugerida: "15:40",
  },
  vespertina: {
    id: "vespertina",
    nombre: "Vespertina",
    horaSorteoReferencia: "17:30 / 18:00 (UY 15:00)",
    horaRecoleccionSugerida: "18:40",
  },
  nocturna: {
    id: "nocturna",
    nombre: "Nocturna",
    horaSorteoReferencia: "21:00",
    horaRecoleccionSugerida: "21:45",
  },
};

/**
 * Devuelve las loterías que participan en un turno dado.
 * En Uruguay el sorteo vespertino es solo lunes a viernes (0=dom, 6=sab).
 */
export function getLoteriasParaTurno(
  turno: TurnoId,
  dayOfWeek?: number
): LoteriaConfig[] {
  return Object.values(LOTERIAS_CONFIG).filter((loteria) => {
    if (!loteria.turnos.includes(turno)) return false;
    if (loteria.id === "uruguay" && turno === "vespertina" && dayOfWeek === 6) {
      return false;
    }
    return true;
  });
}

