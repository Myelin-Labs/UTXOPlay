// UTXOPlay 0.1: trusted, same-origin store integrations only.
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
