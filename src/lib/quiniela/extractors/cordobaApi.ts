import type { ExtractoNormalizado, LoteriaId, TurnoId } from "../types";

const CORDOBA_API_BASE =
  "https://www.loteriadecordoba.com.ar/api/sorteos/quiniela";

const TURNO_TO_CORDOBA_TIPO: Record<TurnoId, string[]> = {
  previa: ["la previa", "previa"],
  primera: ["primera", "la primera"],
  matutina: ["matutino", "matutina"],
  vespertina: ["vespertino", "vespertina"],
  nocturna: ["nocturno", "nocturna"],
};

const CORDOBA_LOTERIA_MATCHERS: Partial<
  Record<LoteriaId, { idLoteria: number; keywords: string[] }>
> = {
  ciudad: { idLoteria: 1, keywords: ["LOTBA", "CIUDAD", "NACIONAL"] },
  provincia: { idLoteria: 2, keywords: ["BUENOS", "PROVINCIA"] },
  cordoba: { idLoteria: 3, keywords: ["CORDOBA", "CÓRDOBA"] },
  santa_fe: { idLoteria: 4, keywords: ["SANTA FE"] },
  entre_rios: { idLoteria: 5, keywords: ["ENTRE RIOS", "ENTRE RÍOS"] },
};

interface CordobaListaResponse {
  data?: {
    items?: Array<{
      sorteo: number;
      tipo_juego: string;
      fecha_sorteo: string;
    }>;
  };
}

interface CordobaDetalleResponse {
  data?: {
    sorteo?: number;
    resultado?: Array<{
      id_loteria?: number;
      nombre?: string;
      numeros?: Array<{
        posicion: number;
        numero: string;
      }>;
    }>;
  };
}

/**
 * Obtiene en una sola consulta a la API JSON oficial de Lotería de Córdoba
 * los extractos de Ciudad, Provincia, Córdoba, Santa Fe y Entre Ríos para un turno.
 */
export async function fetchLoteriaSetFromCordobaApi(
  turno: TurnoId,
  fecha: string,
  loterias: LoteriaId[]
): Promise<Partial<Record<LoteriaId, ExtractoNormalizado>>> {
  const result: Partial<Record<LoteriaId, ExtractoNormalizado>> = {};

  const listRes = await fetch(`${CORDOBA_API_BASE}?fecha=${fecha}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!listRes.ok) {
    throw new Error(`Córdoba API lista HTTP ${listRes.status}`);
  }

  const listJson = (await listRes.json()) as CordobaListaResponse;
  const items = listJson.data?.items ?? [];
  const tipos = TURNO_TO_CORDOBA_TIPO[turno];
  const match = items.find((item) =>
    tipos.includes(item.tipo_juego.trim().toLowerCase())
  );

  if (!match) {
    for (const lot of loterias) {
      result[lot] = {
        publicado: false,
        cabeza: null,
        premios: [],
        numeroSorteo: null,
      };
    }
    return result;
  }

  const detailRes = await fetch(
    `${CORDOBA_API_BASE}?numeroSorteo=${match.sorteo}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    }
  );

  if (!detailRes.ok) {
    throw new Error(`Córdoba API detalle HTTP ${detailRes.status}`);
  }

  const detailJson = (await detailRes.json()) as CordobaDetalleResponse;
  const bloques = detailJson.data?.resultado ?? [];

  for (const loteria of loterias) {
    const matcher = CORDOBA_LOTERIA_MATCHERS[loteria];
    if (!matcher) continue;

    const bloque = bloques.find(
      (b) =>
        b.id_loteria === matcher.idLoteria ||
        matcher.keywords.some((kw) => b.nombre?.toUpperCase().includes(kw))
    );

    const numeros = (bloque?.numeros ?? [])
      .slice()
      .sort((a, b) => a.posicion - b.posicion)
      .map((n) => n.numero.padStart(4, "0"))
      .slice(0, 20);

    result[loteria] =
      numeros.length > 0
        ? {
            publicado: true,
            cabeza: numeros[0],
            premios: numeros,
            numeroSorteo: String(match.sorteo),
          }
        : {
            publicado: false,
            cabeza: null,
            premios: [],
            numeroSorteo: String(match.sorteo),
          };
  }

  return result;
}

