"use client";

import { useEffect, useState } from "react";

interface GenerationItem {
  id: string;
  prompt: string;
  response: string;
  createdAt: string;
}

export function GenkitDemo() {
  const [prompt, setPrompt] = useState("");
  const [saveToFirestore, setSaveToFirestore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text: string; docId: string | null } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationItem[]>([]);

  async function refreshHistory() {
    try {
      const res = await fetch("/api/generations");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setHistory(data.items);
      }
    } catch {
      // Firestore puede no estar iniciado todavía si no corre el emulador
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/generations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.items)) {
          setHistory(data.items);
        }
      })
      .catch(() => {
        // Firestore puede no estar iniciado todavía si no corre el emulador
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/genkit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            prompt: prompt.trim(),
            saveToFirestore,
          },
        }),
      });

      const payload = await res.json();
      if (!res.ok || payload.error) {
        throw new Error(
          payload.error?.message || "Error al ejecutar el flujo de Genkit"
        );
      }

      setResult(payload.result);
      setPrompt("");
      if (saveToFirestore) {
        await refreshHistory();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="prompt"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2"
          >
            Prompt para Genkit (Gemini)
          </label>
          <textarea
            id="prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Escribí una consulta o idea..."
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={saveToFirestore}
              onChange={(e) => setSaveToFirestore(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Guardar resultado en Firestore
          </label>

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="rounded-full bg-zinc-900 dark:bg-zinc-100 px-5 py-2.5 text-sm font-medium text-white dark:text-zinc-900 transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "Generando..." : "Ejecutar Flow"}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Respuesta de Genkit</span>
            {result.docId && <span>Firestore ID: {result.docId}</span>}
          </div>
          <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
            {result.text}
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Últimas generaciones en Firestore
          </h2>
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 text-sm space-y-1"
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {item.prompt}
                </div>
                <div className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                  {item.response}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

