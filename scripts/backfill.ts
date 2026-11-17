import fs from "node:fs";
import path from "node:path";

// Cargar variables de entorno ANTES de importar firebase-admin
for (const envFile of [".env.local", ".env"]) {
  const fullPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(fullPath)) {
    process.loadEnvFile(fullPath);
  }
}

function parseArgs(hoy: string) {
  const args = process.argv.slice(2);
  const getFlag = (name: string) =>
    args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

  const [anio, mes] = hoy.split("-");

  const desde = getFlag("desde") || `${anio}-${mes}-01`;
  const hasta = getFlag("hasta") || hoy;
  const delayMs = Number(getFlag("delay") || "350");
  const force = args.includes("--force");

  return { desde, hasta, delayMs, force };
}

function* iterFechas(desde: string, hasta: string): Generator<string> {
  const cur = new Date(`${desde}T12:00:00Z`);
  const end = new Date(`${hasta}T12:00:00Z`);

  while (cur <= end) {
    yield cur.toISOString().slice(0, 10);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { collectTurno } = await import("../src/lib/quiniela/collector");
  const { getFechaRioplatense } = await import("../src/lib/quiniela/repository");
  const { TURNO_IDS } = await import("../src/lib/quiniela/types");

  const hoy = getFechaRioplatense();
  const { desde, hasta, delayMs, force } = parseArgs(hoy);

  console.log(
    `Iniciando backfill desde ${desde} hasta ${hasta} (delay=${delayMs}ms, onlyPending=${!force})`
  );

  let totalPublicados = 0;
  let totalPendientes = 0;
  let totalErrores = 0;

  for (const fecha of iterFechas(desde, hasta)) {
    const dayOfWeek = new Date(`${fecha}T12:00:00-03:00`).getUTCDay();
    if (dayOfWeek === 0) {
      console.log(`[${fecha}] Domingo — sin sorteos`);
      continue;
    }

    for (const turno of TURNO_IDS) {
      const log = await collectTurno({
        turno,
        fecha,
        onlyPending: !force,
      });

      totalPublicados += log.publicados;
      totalPendientes += log.pendientes;
      totalErrores += log.errores;

      const detalleErr = log.detalles
        .filter((d) => d.estado === "error")
        .map((d) => `${d.loteria}:${d.mensaje}`)
        .join(" | ");

      console.log(
        `[${fecha}] ${turno.padEnd(10)} -> pub:${log.publicados} pend:${log.pendientes} err:${log.errores}${
          detalleErr ? ` (${detalleErr})` : ""
        }`
      );

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  console.log(
    `\nBackfill finalizado. Publicados: ${totalPublicados}, Pendientes: ${totalPendientes}, Errores: ${totalErrores}`
  );
}

main().catch((err) => {
  console.error("Error fatal en backfill:", err);
  process.exit(1);
});
