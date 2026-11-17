import * as cheerio from "cheerio";
import type { ExtractoNormalizado, TurnoId } from "../types";

const URUGUAY_EXTRACTO_URL =
  "https://www.loteria.gub.uy/extractosweb/QV_QN_K/Extracto_QV_QN.php";

/**
 * Extractor determinístico para la Quiniela de Uruguay desde loteria.gub.uy
 * (soporta fecha actual e históricas vía vdia, vmes, vano).
 */
export async function fetchUruguayExtracto(
  turno: TurnoId,
  fecha: string
): Promise<ExtractoNormalizado> {
  if (turno !== "vespertina" && turno !== "nocturna") {
    return {
      publicado: false,
      cabeza: null,
      premios: [],
      numeroSorteo: null,
    };
  }

  const [anioStr, mesStr, diaStr] = fecha.split("-");
  const vdia = Number(diaStr);
  const vmes = Number(mesStr);
  const vano = Number(anioStr);

  const url = `${URUGUAY_EXTRACTO_URL}?vdia=${vdia}&vmes=${vmes}&vano=${vano}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (res.status === 404 || res.status === 502) {
    // DNLQ devuelve 502/404 en feriados uruguayos o cuando el extracto aún no existe
    return {
      publicado: false,
      cabeza: null,
      premios: [],
      numeroSorteo: null,
    };
  }

  if (!res.ok) {
    throw new Error(`Uruguay HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const expectedHora = turno === "vespertina" ? "15:00" : "21:00";
  let premios: string[] = [];

  $("table").each((_, table) => {
    if (premios.length === 20) return;

    const text = $(table).text().replace(/\s+/g, " ");
    if (!text.includes(expectedHora)) return;

    const nums = $(table)
      .find("td")
      .map((__, td) => $(td).text().trim())
      .get()
      .filter((t) => /^\d{3}$/.test(t));

    if (nums.length === 20) {
      premios = nums;
    }
  });

  if (premios.length === 0) {
    return {
      publicado: false,
      cabeza: null,
      premios: [],
      numeroSorteo: null,
    };
  }

  return {
    publicado: true,
    cabeza: premios[0],
    premios,
    numeroSorteo: null,
  };
}
