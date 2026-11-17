import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { collectTurno } from "@/lib/quiniela/collector";
import { TurnoIdSchema } from "@/lib/quiniela/schema";

const CollectRequestSchema = z.object({
  turno: TurnoIdSchema,
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  onlyPending: z.boolean().optional().default(false),
});

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // En desarrollo local sin CRON_SECRET configurado permitimos probar directo.
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-cron-secret");

  return authHeader === `Bearer ${secret}` || cronHeader === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      // Permite llamar solo con query params desde Cloud Scheduler
    }

    const parsed = CollectRequestSchema.safeParse({
      turno: body.turno ?? searchParams.get("turno"),
      fecha: body.fecha ?? searchParams.get("fecha") ?? undefined,
      onlyPending:
        body.onlyPending ?? searchParams.get("onlyPending") === "true",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const log = await collectTurno(parsed.data);
    return NextResponse.json({ ok: true, log });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error interno en recolección";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

