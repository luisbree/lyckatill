import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { collectTurno } from "@/lib/quiniela/collector";
import { getFechaRioplatense } from "@/lib/quiniela/repository";
import { TurnoIdSchema } from "@/lib/quiniela/schema";
import { TURNO_IDS } from "@/lib/quiniela/types";

const CollectBodySchema = z.object({
  turno: TurnoIdSchema.optional(),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  onlyPending: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      // Cuerpo vacío permitido: recolecta el día actual
    }

    const parsed = CollectBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const fecha = parsed.data.fecha ?? getFechaRioplatense();
    const onlyPending = parsed.data.onlyPending;

    if (parsed.data.turno) {
      const log = await collectTurno({
        turno: parsed.data.turno,
        fecha,
        onlyPending,
      });
      return NextResponse.json({ ok: true, logs: [log] });
    }

    // Sin turno específico: recolecta los 5 turnos del día (solo pendientes)
    const logs = [];
    for (const turno of TURNO_IDS) {
      logs.push(await collectTurno({ turno, fecha, onlyPending }));
    }
    return NextResponse.json({ ok: true, logs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno en recolección";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

