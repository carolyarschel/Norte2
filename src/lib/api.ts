const BASE = "/api";

async function handle<T = any>(res: Response): Promise<T> {
  if (res.status === 204) return null as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  return res.json();
}

function post(url: string, data: object) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(handle);
}

function put(url: string, data: object) {
  return fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(handle);
}

function del(url: string) {
  return fetch(url, { method: "DELETE" }).then(handle);
}

function get<T = any>(url: string): Promise<T> {
  return fetch(url).then(handle<T>);
}

export const api = {
  consultants: {
    list:    ()                          => get(`${BASE}/consultants`),
    getById: (id: number)               => get(`${BASE}/consultants/${id}`),
    busy:    (id: number)               => get(`${BASE}/consultants/${id}/busy`),
    create:  (data: object)             => post(`${BASE}/consultants`, data),
    update:  (id: number, data: object) => put(`${BASE}/consultants/${id}`, data),
    remove:  (id: number)               => del(`${BASE}/consultants/${id}`),
  },

  projects: {
    list:    ()                          => get(`${BASE}/projects`),
    getById: (id: number)               => get(`${BASE}/projects/${id}`),
    create:  (data: object)             => post(`${BASE}/projects`, data),
    update:  (id: number, data: object) => put(`${BASE}/projects/${id}`, data),
    remove:  (id: number)               => del(`${BASE}/projects/${id}`),

    setAllocations: (projectId: number, allocations: { consultantId: number; weekday: number; role: string }[]) =>
      put(`${BASE}/projects/${projectId}/allocations`, { allocations }),

    clearAllocations: (projectId: number) =>
      del(`${BASE}/projects/${projectId}/allocations`),
  },

  simulation: {
    /**
     * Batch simulate 1+ projects together. Order matters: the first project's
     * proposed allocations become constraints for the second, and so on.
     */
    run: (projectIds: number[], randomize = false) =>
      post(`${BASE}/simulation`, { projectIds, randomize }),
  },
};
