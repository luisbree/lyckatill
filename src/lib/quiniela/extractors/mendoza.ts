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

function formatFechaDMY(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

/**
 * Busca en hint9509.aspx?<codigo> el número de sorteo correspondiente a `fecha`.
 */
async function findNumeroSorteoMendoza(
  codigo: number,
  fecha: string
): Promise<string | null> {
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
  const fechaDMY = formatFechaDMY(fecha);

  let numeroSorteo: string | null = null;

  $("tr").each((_, tr) => {
    if (numeroSorteo) return;
    const rowText = $(tr).text().replace(/\s+/g, " ");
    if (!rowText.includes(fechaDMY)) return;

    const inputVal = $(tr)
      .find("input[name^='_SORNRO']")
      .attr("value")
      ?.trim();
    const linkText = $(tr).find("a").first().text().trim();
    const candidate = inputVal || linkText;

    if (candidate && /^\d+$/.test(candidate)) {
      numeroSorteo = candidate;
    }
  });

  return numeroSorteo;
}

/**
 * Extrae los 20 premios de Quiniela de Mendoza desde el PDF oficial
 * (oint5002.aspx?<codigo>,<sorteo>) descomprimiendo el stream con zlib.
 */
function parseMendozaPdf(buf: Buffer): string[] {
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
          (it) =>
            it.y >= 540 &&
            it.y <= 700 &&
            /^\d{4}$/.test(it.text)
        );

      if (items.length >= 20) {
        items.sort((a, b) => {
          const colA = Math.round(a.x / 50);
          const colB = Math.round(b.x / 50);
          if (colA !== colB) return colA - colB;
          return b.y - a.y;
        });
        return items.slice(0, 20).map((it) => it.text);
      }
    } catch {
      // Ignoramos streams que no sean zlib (por ej. imágenes JPEG embebidas)
    }

    idx = end + 9;
  }

  return [];
}

/**
 * Extractor determinístico oficial de Quiniela de Mendoza (IPJyC).
 */
export async function fetchMendozaExtracto(
  turno: TurnoId,
  fecha: string
): Promise<ExtractoNormalizado> {
  const codigo = TURNO_TO_MENDOZA_CODIGO[turno];
  const numeroSorteo = await findNumeroSorteoMendoza(codigo, fecha);

  if (!numeroSorteo) {
    return {
      publicado: false,
      cabeza: null,
      premios: [],
      numeroSorteo: null,
    };
  }

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
  const premios = parseMendozaPdf(buf);

  if (premios.length === 0) {
    return {
      publicado: false,
      cabeza: null,
      premios: [],
      numeroSorteo,
    };
  }

  return {
    publicado: true,
    cabeza: premios[0],
    premios,
    numeroSorteo,
  };
}
