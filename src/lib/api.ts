const BASE = "/api"; // funciona com o rewrite do next.config.ts

// ── Consultants ──────────────────────────────────────────
export const api = {
  consultants: {
    list: () =>
      fetch(`${BASE}/consultants`).then((r) => r.json()),

    create: (data: object) =>
      fetch(`${BASE}/consultants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),

    update: (id: number, data: object) =>
      fetch(`${BASE}/consultants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),

    remove: (id: number) =>
      fetch(`${BASE}/consultants/${id}`, { method: "DELETE" }).then((r) =>
        r.json()
      ),
  },

  projects: {
    list: () =>
      fetch(`${BASE}/projects`).then((r) => r.json()),

    create: (data: object) =>
      fetch(`${BASE}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),

    update: (id: number, data: object) =>
      fetch(`${BASE}/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),

    remove: (id: number) =>
      fetch(`${BASE}/projects/${id}`, { method: "DELETE" }).then((r) =>
        r.json()
      ),
  },
};