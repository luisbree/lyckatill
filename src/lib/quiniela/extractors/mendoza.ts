import zlib from "node:zlib";
import * as cheerio from "cheerio";
import type { ExtractoNormalizado, TurnoId } from "../types";

const MENDOZA_BASE_URL = "http://ipjycweb.mendoza.gov.ar";

const TURNO_TO_MENDOZA_CODIGO: Record<TurnoId, number> = {
  previa: 41,
  primera: 31,
  matutina: 11,
  vespertina: 21,
  nocturna: 1,
};

const MESES_INDICE: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

interface MendozaPdfParsed {
  fecha: string | null; // YYYY-MM-DD
  premios: string[];
}

// Cachés en memoria para evitar consultas repetidas durante backfills
const listadoCache = new Map<
  number,
  {
    fetchedAt: number;
    entries: Array<{ fecha: string; numeroSorteo: number }>;
  }
>();
const pdfCache = new Map<string, MendozaPdfParsed>();

function dmyToIso(dmy: string): string | null {
  const m = dmy.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function spanishDateToIso(text: string): string | null {
  const m = text
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})$/);
  if (!m) return null;
  const mes = MESES_INDICE[m[2]];
  if (!mes) return null;
  return `${m[3]}-${mes}-${m[1].padStart(2, "0")}`;
}

async function getListadoMendoza(
  codigo: number
): Promise<Array<{ fecha: string; numeroSorteo: number }>> {
  const cached = listadoCache.get(codigo);
  if (cached && Date.now() - cached.fetchedAt < 60_000) {
    return cached.entries;
  }

  const url = `${MENDOZA_BASE_URL}/hint9509.aspx?${codigo}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`Mendoza listado HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const entries: Array<{ fecha: string; numeroSorteo: number }> = [];

  $("tr").each((_, tr) => {
    const fechaIso = dmyToIso($(tr).text().replace(/\s+/g, " "));
    if (!fechaIso) return;

    const inputVal = $(tr)
      .find("input[name^='_SORNRO']")
      .attr("value")
      ?.trim();
    const linkText = $(tr).find("a").first().text().trim();
    const candidate = inputVal || linkText;

    if (candidate && /^\d+$/.test(candidate)) {
      entries.push({ fecha: fechaIso, numeroSorteo: Number(candidate) });
    }
  });

  listadoCache.set(codigo, { fetchedAt: Date.now(), entries });
  return entries;
}

function parseMendozaPdf(buf: Buffer): MendozaPdfParsed {
  const str = buf.toString("latin1");
  let idx = 0;

  while ((idx = str.indexOf("stream", idx)) !== -1) {
    const start = str.indexOf("\n", idx) + 1;
    const end = str.indexOf("endstream", start);
    if (end === -1) break;

    const chunk = buf.subarray(start, end);
    try {
      const inflated = zlib.inflateSync(chunk).toString("latin1");
      if (!inflated.includes("QUINIELA")) {
        idx = end + 9;
        continue;
      }

      const textTokens = [
        ...inflated.matchAll(/\(([^)]*)\)\s*Tj/g),
      ].map((m) => m[1].trim());

      // La primera fecha (más temprana) en el PDF es la fecha del sorteo;
      // la segunda es la fecha de prescripción (15 días después).
      const fechasPdf = textTokens
        .map((t) => spanishDateToIso(t))
        .filter((f): f is string => f !== null)
        .sort();
      const fecha = fechasPdf[0] ?? null;

      // El bloque superior (y entre 540 y 700) corresponde a Quiniela de Mendoza
      const items = [
        ...inflated.matchAll(
          /1 0 0 1 ([\d.]+) ([\d.]+) Tm\s*\(([^)]*)\)\s*Tj/g
        ),
      ]
        .map((m) => ({
          x: Number(m[1]),
          y: Number(m[2]),
          text: m[3].trim(),
        }))
        .filter(
          (it) => it.y >= 540 && it.y <= 700 && /^\d{4}$/.test(it.text)
        );

      if (items.length >= 20) {
        items.sort((a, b) => {
          const colA = Math.round(a.x / 50);
          const colB = Math.round(b.x / 50);
          if (colA !== colB) return colA - colB;
          return b.y - a.y;
        });
        return {
          fecha,
          premios: items.slice(0, 20).map((it) => it.text),
        };
      }
    } catch {
      // Ignoramos streams que no sean zlib
    }

    idx = end + 9;
  }

  return { fecha: null, premios: [] };
}

async function fetchPdfByNumero(
  codigo: number,
  numeroSorteo: number
): Promise<MendozaPdfParsed> {
  const key = `${codigo}_${numeroSorteo}`;
  const cached = pdfCache.get(key);
  if (cached) return cached;

  const pdfUrl = `${MENDOZA_BASE_URL}/oint5002.aspx?${codigo},${numeroSorteo}`;
  const pdfRes = await fetch(pdfUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!pdfRes.ok) {
    throw new Error(`Mendoza PDF HTTP ${pdfRes.status}`);
  }

  const buf = Buffer.from(await pdfRes.arrayBuffer());
  const parsed = parseMendozaPdf(buf);
  if (parsed.fecha || parsed.premios.length > 0) {
    pdfCache.set(key, parsed);
  }
  return parsed;
}

/**
 * Busca un sorteo histórico anterior a los últimos 30 listados en hint9509.aspx
 * interpolando el número de sorteo y ajustando por la fecha real dentro del PDF.
 */
async function findHistoricalByInterpolation(
  codigo: number,
  targetFecha: string,
  anchor: { fecha: string; numeroSorteo: number }
): Promise<{ numeroSorteo: number; parsed: MendozaPdfParsed } | null> {
  const msPerDay = 86_400_000;
  const diffDays = Math.round(
    (new Date(`${anchor.fecha}T12:00:00Z`).getTime() -
      new Date(`${targetFecha}T12:00:00Z`).getTime()) /
      msPerDay
  );

  // ~6 sorteos por cada 7 días (lun-sáb)
  let guess = Math.max(1, anchor.numeroSorteo - Math.round((diffDays * 6) / 7));

  for (let step = 0; step < 12; step++) {
    const parsed = await fetchPdfByNumero(codigo, guess);
    if (!parsed.fecha) return null;

    if (parsed.fecha === targetFecha) {
      return { numeroSorteo: guess, parsed };
    }

    const deltaDays = Math.round(
      (new Date(`${targetFecha}T12:00:00Z`).getTime() -
        new Date(`${parsed.fecha}T12:00:00Z`).getTime()) /
        msPerDay
    );

    const deltaDraws =
      deltaDays === 0
        ? 0
        : deltaDays > 0
          ? Math.max(1, Math.round((deltaDays * 6) / 7))
          : Math.min(-1, Math.round((deltaDays * 6) / 7));

    if (deltaDraws === 0) return null;

    const nextGuess = guess + deltaDraws;
    if (nextGuess < 1) return null;

    // Si el paso es ±1 y ya pasamos por el otro lado, es feriado sin sorteo
    if (Math.abs(deltaDraws) === 1) {
      const nextParsed = await fetchPdfByNumero(codigo, nextGuess);
      if (nextParsed.fecha === targetFecha) {
        return { numeroSorteo: nextGuess, parsed: nextParsed };
      }
      return null;
    }

    guess = nextGuess;
  }

  return null;
}

/**
 * Extractor determinístico oficial de Quiniela de Mendoza (IPJyC).
 * Soporta tanto sorteos recientes como fechas históricas anteriores.
 */
export async function fetchMendozaExtracto(
  turno: TurnoId,
  fecha: string
): Promise<ExtractoNormalizado> {
  const codigo = TURNO_TO_MENDOZA_CODIGO[turno];
  const listado = await getListadoMendoza(codigo);

  if (listado.length === 0) {
    return {
      publicado: false,
      cabeza: null,
      premios: [],
      numeroSorteo: null,
    };
  }

  const exact = listado.find((e) => e.fecha === fecha);
  if (exact) {
    const parsed = await fetchPdfByNumero(codigo, exact.numeroSorteo);
    if (parsed.premios.length === 0) {
      return {
        publicado: false,
        cabeza: null,
        premios: [],
        numeroSorteo: String(exact.numeroSorteo),
      };
    }
    return {
      publicado: true,
      cabeza: parsed.premios[0],
      premios: parsed.premios,
      numeroSorteo: String(exact.numeroSorteo),
    };
  }

  const oldest = listado[listado.length - 1];
  if (fecha > listado[0].fecha) {
    return {
      publicado: false,
      cabeza: null,
      premios: [],
      numeroSorteo: null,
    };
  }

  const found = await findHistoricalByInterpolation(codigo, fecha, oldest);
  if (!found || found.parsed.premios.length === 0) {
    return {
      publicado: false,
      cabeza: null,
      premios: [],
      numeroSorteo: null,
    };
  }

  return {
    publicado: true,
    cabeza: found.parsed.premios[0],
    premios: found.parsed.premios,
    numeroSorteo: String(found.numeroSorteo),
  };
}
