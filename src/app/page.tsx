import { ResultadosBoard } from "@/components/ResultadosBoard";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black px-4 py-10 font-sans">
      <main className="w-full max-w-6xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Resultados de Quiniela
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Ciudad, Provincia, Córdoba, Santa Fe, Mendoza, Entre Ríos y Uruguay.
          </p>
        </header>

        <ResultadosBoard />
      </main>
    </div>
  );
}
