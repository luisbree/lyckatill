import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAllSorteosPublicados } from "@/lib/quiniela/repository";
import { LoteriaIdSchema, TurnoIdSchema } from "@/lib/quiniela/schema";
import {
  createSimulacionesBatch,
  deleteAllSimulaciones,
  deleteSimulacion,
  evaluarSimulaciones,
  getFechaMananaRioplatense,
  limpiarListaSimulaciones,
  listSimulaciones,
} from "@/lib/quiniela/simulator";

const CreateSimulacionesSchema = z.object({
  jugadas: z
    .array(
      z.object({
        loteria: LoteriaIdSchema,
        numero: z.string().regex(/^\d{2,3}$/, "Debe tener 2 o 3 dígitos"),
        cifras: z.union([z.literal(2), z.literal(3)]).optional(),
        estrategia: z
          .enum(["candidatos", "atrasados", "eco", "ambos_atrasados"])
          .optional(),
        multiplicadorPremio: z.number().positive().max(10_000).optional(),
      })
    )
    .min(1),
  apuestaPorSorteo: z.number().positive().max(1_000_000).default(150),
  multiplicadorPremio: z.number().positive().max(10_000).default(600),
  fechaInicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  turnoInicio: TurnoIdSchema.optional().default("previa"),
});

export async function GET() {
  try {
    const [sims, sorteos] = await Promise.all([
      listSimulaciones(),
      getAllSorteosPublicados(),
    ]);
    const evaluacion = evaluarSimulaciones(sims, sorteos);
    return NextResponse.json({
      ...evaluacion,
      fechaMananaSugerida: getFechaMananaRioplatense(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al cargar simulaciones";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const parsed = CreateSimulacionesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      jugadas,
      apuestaPorSorteo,
      multiplicadorPremio,
      fechaInicio,
      turnoInicio,
    } = parsed.data;

    const fecha = fechaInicio ?? getFechaMananaRioplatense();
    const created = await createSimulacionesBatch(
      jugadas.map((j) => ({
        loteria: j.loteria,
        numero: j.numero,
        cifras: j.cifras ?? (j.numero.length === 2 ? 2 : 3),
        estrategia: j.estrategia ?? "candidatos",
        apuestaPorSorteo,
        multiplicadorPremio: j.multiplicadorPremio ?? multiplicadorPremio,
        fechaInicio: fecha,
        turnoInicio,
      }))
    );

    return NextResponse.json({ ok: true, created });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al crear simulaciones";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const sorteos = await getAllSorteosPublicados();
    const result = await limpiarListaSimulaciones(sorteos);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al limpiar jugadas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const all = req.nextUrl.searchParams.get("all") === "true";

    if (all) {
      await deleteAllSimulaciones();
      return NextResponse.json({ ok: true });
    }

    if (!id) {
      return NextResponse.json(
        { error: "Se requiere ?id=... o ?all=true" },
        { status: 400 }
      );
    }

    await deleteSimulacion(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al eliminar simulación";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
