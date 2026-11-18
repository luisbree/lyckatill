import {
  LOTERIA_IDS,
  type LoteriaId,
  type SorteoDocument,
  type TurnoId,
} from "./types";

export const TURNO_ORDER: Record<TurnoId, number> = {
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

export interface CandidatoDigito {
  digito: string;
  score: number; // 0..100
  zAtraso: number;
  markovProb: number; // 0..1
  freqGlobal: number; // 0..1
  freqReciente: number; // 0..1
}

export interface LoteriaAtrasos {
  totalSorteos: number;
  centena: DigitoAtraso;
  decena: DigitoAtraso;
  unidad: DigitoAtraso;
  rankingCentena: DigitoRetornoStats[];
  rankingDecena: DigitoRetornoStats[];
  rankingUnidad: DigitoRetornoStats[];
  candidatoCentena: CandidatoDigito[];
  candidatoDecena: CandidatoDigito[];
  candidatoUnidad: CandidatoDigito[];
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

function minMaxNormalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return values.map(() => 0.5);
  }
  return values.map((v) => (v - min) / (max - min));
}

/**
 * Calcula el Índice Compuesto de Candidato (35% Z-score atraso, 30% Markov,
 * 20% Frecuencia global, 15% Momentum últimos 30 sorteos).
 */
function calcularCandidatos(
  digitosEnOrdenAsc: string[],
  ranking: DigitoRetornoStats[]
): CandidatoDigito[] {
  const total = digitosEnOrdenAsc.length;
  const ultimo = digitosEnOrdenAsc[total - 1];
  const ventanaReciente = digitosEnOrdenAsc.slice(-30);

  const rankingPorDigito = new Map(ranking.map((r) => [r.digito, r]));

  // Transiciones desde `ultimo` (Markov orden 1 con suavizado de Laplace +1)
  const transiciones = new Map<string, number>();
  let totalTransiciones = 0;
  for (let i = 0; i < total - 1; i++) {
    if (digitosEnOrdenAsc[i] === ultimo) {
      const next = digitosEnOrdenAsc[i + 1];
      transiciones.set(next, (transiciones.get(next) ?? 0) + 1);
      totalTransiciones++;
    }
  }

  const rawZ: number[] = [];
  const rawMarkov: number[] = [];
  const rawFreqGlobal: number[] = [];
  const rawFreqReciente: number[] = [];

  for (let n = 0; n <= 9; n++) {
    const d = String(n);
    const stat = rankingPorDigito.get(d);
    const z =
      stat && stat.promedio !== null
        ? (stat.atrasoActual - stat.promedio) / Math.max(stat.desviacion ?? 1, 1)
        : 0;

    const markov = ((transiciones.get(d) ?? 0) + 1) / (totalTransiciones + 10);
    const freqGlobal = total > 0 ? (stat?.apariciones ?? 0) / total : 0.1;
    const countReciente = ventanaReciente.filter((x) => x === d).length;
    const freqReciente =
      ventanaReciente.length > 0 ? countReciente / ventanaReciente.length : 0.1;

    rawZ.push(z);
    rawMarkov.push(markov);
    rawFreqGlobal.push(freqGlobal);
    rawFreqReciente.push(freqReciente);
  }

  const normZ = minMaxNormalize(rawZ);
  const normMarkov = minMaxNormalize(rawMarkov);
  const normFreq = minMaxNormalize(rawFreqGlobal);
  const normMomentum = minMaxNormalize(rawFreqReciente);

  const candidatos: CandidatoDigito[] = [];
  for (let n = 0; n <= 9; n++) {
    const score =
      (0.35 * normZ[n] +
        0.3 * normMarkov[n] +
        0.2 * normFreq[n] +
        0.15 * normMomentum[n]) *
      100;

    candidatos.push({
      digito: String(n),
      score: Number(score.toFixed(1)),
      zAtraso: Number(rawZ[n].toFixed(2)),
      markovProb: Number(rawMarkov[n].toFixed(3)),
      freqGlobal: Number(rawFreqGlobal[n].toFixed(3)),
      freqReciente: Number(rawFreqReciente[n].toFixed(3)),
    });
  }

  candidatos.sort((a, b) => b.score - a.score);
  return candidatos;
}

/**
 * Calcula, para cada lotería y sin discriminar por horario, el dígito decimal (0-9)
 * más atrasado, el ranking de tiempo promedio de retorno y los candidatos ponderados.
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

    const rankingCentena = calcularRankingRetorno(centenasAsc);
    const rankingDecena = calcularRankingRetorno(decenasAsc);
    const rankingUnidad = calcularRankingRetorno(unidadesAsc);

    resultado[loteriaId] = {
      totalSorteos: lista.length,
      centena: findMasAtrasado(centenasDesc),
      decena: findMasAtrasado(decenasDesc),
      unidad: findMasAtrasado(unidadesDesc),
      rankingCentena,
      rankingDecena,
      rankingUnidad,
      candidatoCentena: calcularCandidatos(centenasAsc, rankingCentena),
      candidatoDecena: calcularCandidatos(decenasAsc, rankingDecena),
      candidatoUnidad: calcularCandidatos(unidadesAsc, rankingUnidad),
    };
  }

  return resultado;
}
