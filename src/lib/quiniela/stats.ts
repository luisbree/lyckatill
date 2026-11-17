import { LOTERIA_IDS, type LoteriaId, type SorteoDocument, type TurnoId } from "./types";

const TURNO_ORDER: Record<TurnoId, number> = {
  previa: 1,
  primera: 2,
  matutina: 3,
  vespertina: 4,
  nocturna: 5,
};

export interface DigitoAtraso {
  digito: string;
  atraso: number;
  nuncaSalio: boolean;
}

export interface DigitoRetornoStats {
  digito: string;
  apariciones: number;
  intervalos: number;
  atrasoActual: number;
  promedio: number | null;
  desviacion: number | null;
}

export interface LoteriaAtrasos {
  totalSorteos: number;
  centena: DigitoAtraso;
  decena: DigitoAtraso;
  unidad: DigitoAtraso;
  rankingCentena: DigitoRetornoStats[];
  rankingDecena: DigitoRetornoStats[];
  rankingUnidad: DigitoRetornoStats[];
}

export type AtrasosPorLoteria = Record<LoteriaId, LoteriaAtrasos | null>;

export interface SorteoResumen {
  fecha: string;
  loteria: LoteriaId;
  turno: TurnoId;
  cabeza: string | null;
  estado: SorteoDocument["estado"];
}

function findMasAtrasado(digitosEnOrdenDesc: string[]): DigitoAtraso {
  const ultimoIndice = new Map<string, number>();

  for (let i = 0; i < digitosEnOrdenDesc.length; i++) {
    const d = digitosEnOrdenDesc[i];
    if (!ultimoIndice.has(d)) {
      ultimoIndice.set(d, i);
    }
  }

  let mejorDigito = "0";
  let mayorAtraso = -1;
  let nuncaSalio = false;

  for (let n = 0; n <= 9; n++) {
    const d = String(n);
    const idx = ultimoIndice.get(d);
    const atraso = idx === undefined ? digitosEnOrdenDesc.length : idx;
    const sinSalir = idx === undefined;

    if (atraso > mayorAtraso) {
      mayorAtraso = atraso;
      mejorDigito = d;
      nuncaSalio = sinSalir;
    }
  }

  return {
    digito: mejorDigito,
    atraso: mayorAtraso,
    nuncaSalio,
  };
}

/**
 * Calcula para los 10 dígitos (0-9) el promedio y desviación estándar
 * de sorteos que tarda cada dígito en volver a salir, ordenado de menor a mayor promedio.
 * Recibe `digitosEnOrdenAsc` (del más antiguo al más reciente).
 */
function calcularRankingRetorno(
  digitosEnOrdenAsc: string[]
): DigitoRetornoStats[] {
  const total = digitosEnOrdenAsc.length;
  const indicesPorDigito = new Map<string, number[]>();

  for (let n = 0; n <= 9; n++) {
    indicesPorDigito.set(String(n), []);
  }

  for (let i = 0; i < total; i++) {
    const d = digitosEnOrdenAsc[i];
    indicesPorDigito.get(d)?.push(i);
  }

  const stats: DigitoRetornoStats[] = [];

  for (let n = 0; n <= 9; n++) {
    const d = String(n);
    const idxs = indicesPorDigito.get(d) ?? [];
    const apariciones = idxs.length;
    const atrasoActual =
      apariciones > 0 ? total - 1 - idxs[apariciones - 1] : total;

    if (apariciones < 2) {
      stats.push({
        digito: d,
        apariciones,
        intervalos: 0,
        atrasoActual,
        promedio: null,
        desviacion: null,
      });
      continue;
    }

    const gaps: number[] = [];
    for (let j = 1; j < idxs.length; j++) {
      gaps.push(idxs[j] - idxs[j - 1]);
    }

    const sum = gaps.reduce((acc, g) => acc + g, 0);
    const mean = sum / gaps.length;
    const variance =
      gaps.reduce((acc, g) => acc + (g - mean) ** 2, 0) / gaps.length;
    const std = Math.sqrt(variance);

    stats.push({
      digito: d,
      apariciones,
      intervalos: gaps.length,
      atrasoActual,
      promedio: Number(mean.toFixed(1)),
      desviacion: Number(std.toFixed(1)),
    });
  }

  stats.sort((a, b) => {
    if (a.promedio === null && b.promedio === null) {
      return b.apariciones - a.apariciones;
    }
    if (a.promedio === null) return 1;
    if (b.promedio === null) return -1;
    if (a.promedio !== b.promedio) return a.promedio - b.promedio;
    return (a.desviacion ?? 0) - (b.desviacion ?? 0);
  });

  return stats;
}

/**
 * Calcula, para cada lotería y sin discriminar por horario, el dígito decimal (0-9)
 * más atrasado y el ranking de tiempo promedio de retorno (± desviación estándar)
 * en centena, decena y unidad de la cabeza.
 */
export function calcularAtrasosPorLoteria(
  sorteos: SorteoResumen[]
): AtrasosPorLoteria {
  const porLoteria = new Map<LoteriaId, SorteoResumen[]>();

  for (const s of sorteos) {
    if (s.estado !== "publicado" || !s.cabeza || s.cabeza.length < 3) {
      continue;
    }
    const list = porLoteria.get(s.loteria) ?? [];
    list.push(s);
    porLoteria.set(s.loteria, list);
  }

  const resultado = {} as AtrasosPorLoteria;

  for (const loteriaId of LOTERIA_IDS) {
    const lista = porLoteria.get(loteriaId);
    if (!lista || lista.length === 0) {
      resultado[loteriaId] = null;
      continue;
    }

    // Orden cronológico descendente: más reciente primero
    lista.sort((a, b) => {
      if (a.fecha !== b.fecha) {
        return b.fecha.localeCompare(a.fecha);
      }
      return TURNO_ORDER[b.turno] - TURNO_ORDER[a.turno];
    });

    const centenasDesc: string[] = [];
    const decenasDesc: string[] = [];
    const unidadesDesc: string[] = [];

    for (const s of lista) {
      const cab = s.cabeza!;
      const len = cab.length;
      centenasDesc.push(cab[len - 3]);
      decenasDesc.push(cab[len - 2]);
      unidadesDesc.push(cab[len - 1]);
    }

    const centenasAsc = centenasDesc.slice().reverse();
    const decenasAsc = decenasDesc.slice().reverse();
    const unidadesAsc = unidadesDesc.slice().reverse();

    resultado[loteriaId] = {
      totalSorteos: lista.length,
      centena: findMasAtrasado(centenasDesc),
      decena: findMasAtrasado(decenasDesc),
      unidad: findMasAtrasado(unidadesDesc),
      rankingCentena: calcularRankingRetorno(centenasAsc),
      rankingDecena: calcularRankingRetorno(decenasAsc),
      rankingUnidad: calcularRankingRetorno(unidadesAsc),
    };
  }

  return resultado;
}
