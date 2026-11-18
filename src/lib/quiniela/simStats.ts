import type { SimulacionEvaluada } from "./simulator";
import { LOTERIA_IDS, type LoteriaId } from "./types";

export interface GrupoBalance {
  jugadas: number;
  aciertos: number;
  gasto: number;
  ganancia: number;
  balance: number;
  retornoPorPeso: number | null; // ganancia / gasto (ej. 1.25 = $1.25 recuperado por $1 apostado)
}

export interface LoteriaBalanceRow {
  loteria: LoteriaId;
  total: GrupoBalance;
  candidatos: GrupoBalance;
  atrasados: GrupoBalance;
  tresCifras: GrupoBalance;
  dosCifras: GrupoBalance;
}

export interface BalanceDetallado {
  global: {
    candidatos: GrupoBalance;
    atrasados: GrupoBalance;
    tresCifras: GrupoBalance;
    dosCifras: GrupoBalance;
  };
  porLoteria: LoteriaBalanceRow[];
}

function sumarGrupo(sims: SimulacionEvaluada[]): GrupoBalance {
  let jugadas = 0;
  let aciertos = 0;
  let gasto = 0;
  let ganancia = 0;

  for (const s of sims) {
    jugadas++;
    if (s.acierto) aciertos++;
    gasto += s.gastoTotal;
    ganancia += s.gananciaBruta;
  }

  const balance = ganancia - gasto;
  const retornoPorPeso = gasto > 0 ? Number((ganancia / gasto).toFixed(2)) : null;

  return {
    jugadas,
    aciertos,
    gasto,
    ganancia,
    balance,
    retornoPorPeso,
  };
}

/**
 * Calcula el rendimiento acumulado (pesos netos y retorno por cada $1 apostado)
 * discriminado por estrategia (Candidatos vs Más atrasados) y cifras (3 vs 2),
 * tanto global como lotería por lotería (sin discriminar por turno).
 */
export function calcularBalanceDetallado(
  simulaciones: SimulacionEvaluada[]
): BalanceDetallado {
  const esCandidato = (s: SimulacionEvaluada) =>
    (s.estrategia ?? "candidatos") === "candidatos";
  const esAtrasado = (s: SimulacionEvaluada) => s.estrategia === "atrasados";
  const es3C = (s: SimulacionEvaluada) =>
    (s.cifras ?? s.numero.length) === 3;
  const es2C = (s: SimulacionEvaluada) =>
    (s.cifras ?? s.numero.length) === 2;

  const porLoteria: LoteriaBalanceRow[] = LOTERIA_IDS.map((loteria) => {
    const deLoteria = simulaciones.filter((s) => s.loteria === loteria);
    return {
      loteria,
      total: sumarGrupo(deLoteria),
      candidatos: sumarGrupo(deLoteria.filter(esCandidato)),
      atrasados: sumarGrupo(deLoteria.filter(esAtrasado)),
      tresCifras: sumarGrupo(deLoteria.filter(es3C)),
      dosCifras: sumarGrupo(deLoteria.filter(es2C)),
    };
  });

  return {
    global: {
      candidatos: sumarGrupo(simulaciones.filter(esCandidato)),
      atrasados: sumarGrupo(simulaciones.filter(esAtrasado)),
      tresCifras: sumarGrupo(simulaciones.filter(es3C)),
      dosCifras: sumarGrupo(simulaciones.filter(es2C)),
    },
    porLoteria,
  };
}

