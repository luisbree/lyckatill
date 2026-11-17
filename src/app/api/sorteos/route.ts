import { NextRequest, NextResponse } from "next/server";
import {
  getFechaRioplatense,
  getSorteosPorFecha,
} from "@/lib/quiniela/repository";

export async function GET(req: NextRequest) {
  try {
    const fechaParam = req.nextUrl.searchParams.get("fecha");
    const fecha =
      fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)
        ? fechaParam
        : getFechaRioplatense();

    const sorteos = await getSorteosPorFecha(fecha);
    return NextResponse.json({ fecha, sorteos });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al consultar sorteos";
    return NextResponse.json(
      { fecha: getFechaRioplatense(), sorteos: [], error: message },
      { status: 500 }
    );
  }
}

