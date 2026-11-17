import { z } from "genkit";
import { ai } from "@/genkit/ai";
import { adminDb } from "@/lib/firebase/admin";

export const SuerteInputSchema = z.object({
  prompt: z.string().min(1, "El prompt no puede estar vacío"),
  saveToFirestore: z.boolean().optional().default(true),
});

export const SuerteOutputSchema = z.object({
  text: z.string(),
  docId: z.string().nullable(),
});

export const suerteFlow = ai.defineFlow(
  {
    name: "suerteFlow",
    inputSchema: SuerteInputSchema,
    outputSchema: SuerteOutputSchema,
  },
  async ({ prompt, saveToFirestore }) => {
    const response = await ai.generate({
      prompt,
    });

    const text = response.text;
    let docId: string | null = null;

    if (saveToFirestore) {
      const docRef = await adminDb.collection("generations").add({
        prompt,
        response: text,
        createdAt: new Date().toISOString(),
      });
      docId = docRef.id;
    }

    return { text, docId };
  }
);

