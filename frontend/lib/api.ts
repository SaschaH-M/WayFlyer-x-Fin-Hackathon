// API client — talks to Flask via Next rewrites (/api/* -> :5055).

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`/api${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

export const api = {
  health: () => get<any>("/health"),
  summary: () => get<any>("/summary"),
  stocksense: () => get<any>("/stocksense"),
  cashradar: () => get<any>("/cashradar"),
  simulate: (cutoff?: string) => get<any>(`/simulate${cutoff ? `?cutoff=${cutoff}` : ""}`),
  cashengine: (scenario: string) => get<any>(`/cashengine?scenario=${scenario}`),
  cashengineAll: () => get<any>("/cashengine/all"),
  agent: async (question: string, use_llm = true) => {
    const r = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, use_llm }),
    });
    if (!r.ok) throw new Error(`agent -> ${r.status}`);
    return r.json();
  },
};
