// Drafts are flat text fields. Missing optional fields and empty fields are equivalent.
export function sameDraft(left, right) {
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].every(key => (left[key] ?? "") === (right[key] ?? ""));
}
export function reconcileSavedDraft(current, submitted, saved) {
  const next = {...current};
  for (const key of new Set([...Object.keys(submitted), ...Object.keys(saved)]))
    if ((current[key] ?? "") === (submitted[key] ?? "")) next[key] = saved[key] ?? "";
  return next;
}
const creditFields = [
  ["developerName", "Developer name"],
  ["developerAddress", "Developer wallet"],
  ["developerSourceUrl", "Original project"],
  ["publisherName", "Publisher name"],
];
export function creditChanges(live, draft) {
  if (!live) return [];
  return creditFields.flatMap(([key, label]) => {
    const before = (live[key] || "").trim(), after = (draft[key] || "").trim();
    return before === after ? [] : [{key, label, before, after}];
  });
}
export function missingCreditNames(draft) {
  return ["developerName", "publisherName"].filter(key => !draft[key]?.trim());
}
