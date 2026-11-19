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

export interface EcoDigito {
  digito: string;
  score: number; // 0..100
  markov2Prob: number;
  deficit50: number;
  paridadRangoProb: number;
  ecoModalProb: number;
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
  ecoCentena: EcoDigito[];
  ecoDecena: EcoDigito[];
  ecoUnidad: EcoDigito[];
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
 * Modelo B ("Eco & Equilibrio"):
 * 35% Markov orden 2 (bigrama) · 30% Déficit en ventana de 50 ·
 * 20% Dinámica Par/Impar y Bajo/Alto · 15% Eco de distancia modal.
 */
function calcularEcoEquilibrio(digitosEnOrdenAsc: string[]): EcoDigito[] {
  const total = digitosEnOrdenAsc.length;
  const ultimo = digitosEnOrdenAsc[total - 1];
  const anteultimo = total >= 2 ? digitosEnOrdenAsc[total - 2] : ultimo;

  // 1. Markov orden 2 (bigrama: anteultimo + ultimo -> siguiente)
  const bigramCounts = new Map<string, number>();
  let bigramTotal = 0;
  for (let i = 0; i < total - 2; i++) {
    if (
      digitosEnOrdenAsc[i] === anteultimo &&
      digitosEnOrdenAsc[i + 1] === ultimo
    ) {
      const next = digitosEnOrdenAsc[i + 2];
      bigramCounts.set(next, (bigramCounts.get(next) ?? 0) + 1);
      bigramTotal++;
    }
  }

  // 2. Ventana mediana de 50 sorteos para déficit
  const ventana50 = digitosEnOrdenAsc.slice(-50);
  const esperado50 = ventana50.length * 0.1;

  // 3. Dinámica Par/Impar y Bajo(0-4)/Alto(5-9)
  const ultimoEsPar = Number(ultimo) % 2 === 0;
  const ultimoEsAlto = Number(ultimo) >= 5;
  let parSameCount = 0;
  let parSameTotal = 0;
  let altoSameCount = 0;
  let altoSameTotal = 0;

  for (let i = 0; i < total - 1; i++) {
    const curPar = Number(digitosEnOrdenAsc[i]) % 2 === 0;
    const nextPar = Number(digitosEnOrdenAsc[i + 1]) % 2 === 0;
    if (curPar === ultimoEsPar) {
      parSameTotal++;
      if (nextPar === curPar) parSameCount++;
    }

    const curAlto = Number(digitosEnOrdenAsc[i]) >= 5;
    const nextAlto = Number(digitosEnOrdenAsc[i + 1]) >= 5;
    if (curAlto === ultimoEsAlto) {
      altoSameTotal++;
      if (nextAlto === curAlto) altoSameCount++;
    }
  }

  const probMantieneParidad = (parSameCount + 1) / (parSameTotal + 2);
  const probMantieneRango = (altoSameCount + 1) / (altoSameTotal + 2);

  // 4. Eco de distancia modal (índices por dígito)
  const indicesPorDigito = new Map<string, number[]>();
  for (let n = 0; n <= 9; n++) indicesPorDigito.set(String(n), []);
  for (let i = 0; i < total; i++) {
    indicesPorDigito.get(digitosEnOrdenAsc[i])?.push(i);
  }

  const rawMarkov2: number[] = [];
  const rawDeficit: number[] = [];
  const rawParRango: number[] = [];
  const rawEcoModal: number[] = [];

  for (let n = 0; n <= 9; n++) {
    const d = String(n);
    const markov2 = ((bigramCounts.get(d) ?? 0) + 1) / (bigramTotal + 10);

    const count50 = ventana50.filter((x) => x === d).length;
    const deficit = esperado50 - count50;

    const dEsPar = n % 2 === 0;
    const dEsAlto = n >= 5;
    const pPar =
      dEsPar === ultimoEsPar ? probMantieneParidad : 1 - probMantieneParidad;
    const pRango =
      dEsAlto === ultimoEsAlto ? probMantieneRango : 1 - probMantieneRango;
    const parRango = (pPar + pRango) / 2;

    const idxs = indicesPorDigito.get(d) ?? [];
    let ecoModal = 0;
    if (idxs.length >= 2) {
      const targetGap = total - idxs[idxs.length - 1]; // distancia si sale en el próximo
      let hits = 0;
      const totalGaps = idxs.length - 1;
      for (let j = 1; j < idxs.length; j++) {
        const gap = idxs[j] - idxs[j - 1];
        if (Math.abs(gap - targetGap) <= 1) {
          hits++;
        }
      }
      ecoModal = hits / totalGaps;
    }

    rawMarkov2.push(markov2);
    rawDeficit.push(deficit);
    rawParRango.push(parRango);
    rawEcoModal.push(ecoModal);
  }

  const normMarkov2 = minMaxNormalize(rawMarkov2);
  const normDeficit = minMaxNormalize(rawDeficit);
  const normParRango = minMaxNormalize(rawParRango);
  const normEcoModal = minMaxNormalize(rawEcoModal);

  const resultados: EcoDigito[] = [];
  for (let n = 0; n <= 9; n++) {
    const score =
      (0.35 * normMarkov2[n] +
        0.3 * normDeficit[n] +
        0.2 * normParRango[n] +
        0.15 * normEcoModal[n]) *
      100;

    resultados.push({
      digito: String(n),
      score: Number(score.toFixed(1)),
      markov2Prob: Number(rawMarkov2[n].toFixed(3)),
      deficit50: Number(rawDeficit[n].toFixed(1)),
      paridadRangoProb: Number(rawParRango[n].toFixed(3)),
      ecoModalProb: Number(rawEcoModal[n].toFixed(3)),
    });
  }

  resultados.sort((a, b) => b.score - a.score);
  return resultados;
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
      ecoCentena: calcularEcoEquilibrio(centenasAsc),
      ecoDecena: calcularEcoEquilibrio(decenasAsc),
      ecoUnidad: calcularEcoEquilibrio(unidadesAsc),
    };
  }

  return resultado;
}
