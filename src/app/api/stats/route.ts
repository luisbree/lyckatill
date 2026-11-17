import { NextResponse } from "next/server";
import { getAllSorteosPublicados } from "@/lib/quiniela/repository";
import { calcularAtrasosPorLoteria } from "@/lib/quiniela/stats";

export async function GET() {
  try {
    const sorteos = await getAllSorteosPublicados();
    const atrasos = calcularAtrasosPorLoteria(sorteos);
    return NextResponse.json({ atrasos });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al calcular estadísticas";
    return NextResponse.json({ atrasos: null, error: message }, { status: 500 });
  }
}

