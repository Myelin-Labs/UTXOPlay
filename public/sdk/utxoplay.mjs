// UTXOPlay 0.5: trusted, same-origin store integrations only.
async function request(path, body) {
 const response = await fetch(path, {credentials: "same-origin", method: body === undefined ? "GET" : "POST", headers: body === undefined ? {} : {"Content-Type":"application/json"}, body: body === undefined ? undefined : JSON.stringify(body)});
 const result = await response.json();
 if (!response.ok) throw new Error(result.error || "UTXOPlay request failed");
 return result;
}
export const games = () => request("/api/games");
export const player = () => request("/api/me");
export const library = () => request("/api/library");
export const projects = () => request("/api/developer/projects");
export const createProject = (draft) => request("/api/developer/projects", draft);

const projectPath = id => `/api/developer/projects/${encodeURIComponent(id)}`;
export const saveProject = (id, revision, draft) => request(projectPath(id)+"/save", {revision, draft});
export const checkProject = id => request(projectPath(id)+"/check", {});
export const checkPrice = id => request(projectPath(id)+"/price", {});
export const publishProject = (id, revision) => request(projectPath(id)+"/publish", {revision});
export const unlistProject = id => request(projectPath(id)+"/unpublish", {});
export const sales = () => request("/api/developer/sales");
export const purchases = () => request("/api/orders");
export const commerce = () => request("/api/commerce/config");
// Vendor keys and ticket redemption belong on your server: see vendor/adapter.mjs.
