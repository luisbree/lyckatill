import * as cheerio from "cheerio";
import type { ExtractoNormalizado, TurnoId } from "../types";

const URUGUAY_URL = "https://www.loteria.gub.uy/ver_resultados.php";

const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function formatFechaTextoUruguay(fecha: string): {
  dia: number;
  mesNombre: string;
  anio: number;
} {
  const [anioStr, mesStr, diaStr] = fecha.split("-");
  const mesIdx = Number(mesStr) - 1;
  return {
    dia: Number(diaStr),
    mesNombre: MESES_ES[mesIdx] ?? "",
    anio: Number(anioStr),
  };
}

/**
 * Extractor determinístico para la Quiniela de Uruguay desde loteria.gub.uy.
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

  const res = await fetch(URUGUAY_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`Uruguay HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const { dia, mesNombre, anio } = formatFechaTextoUruguay(fecha);

  // Buscamos la tabla que contiene los 20 números de 3 dígitos de Quiniela
  let premios: string[] = [];
  let fechaCoincide = false;
  let turnoCoincide = false;

  const bodyText = $("body").text().replace(/\s+/g, " ").toLowerCase();
  const fechaPattern = new RegExp(
    `${dia}\\s+de\\s+${mesNombre}\\s+de\\s+${anio}`,
    "i"
  );
  fechaCoincide = fechaPattern.test(bodyText);

  if (turno === "vespertina") {
    turnoCoincide = /pr[óo]ximo\s+vespertino/i.test(bodyText) || /15:00/i.test(bodyText);
  } else {
    turnoCoincide = /pr[óo]ximo\s+nocturno/i.test(bodyText);
  }

  $("table").each((_, table) => {
    if (premios.length === 20) return;
    const cells = $(table)
      .find("td")
      .map((__, td) => $(td).text().trim())
      .get()
      .filter((t) => /^\d{3}$/.test(t));

    if (cells.length === 20) {
      premios = cells;
    }
  });

  if (!fechaCoincide || !turnoCoincide || premios.length === 0) {
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

