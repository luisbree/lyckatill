import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("generations")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as {
        prompt: string;
        response: string;
        createdAt: string;
      }),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al consultar Firestore";
    return NextResponse.json({ items: [], error: message }, { status: 500 });
  }
}

