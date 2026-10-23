export const UNIT = 100000000n;
export function parsePrice(value) {
  if (
    typeof value !== "string" ||
    !/^(0|[1-9]\d{0,6})(\.\d{1,8})?$/.test(value)
  )
    throw Error("Enter a CKB price with at most 8 decimal places.");
  const [whole, decimal = ""] = value.split(".");
  const result = BigInt(whole) * UNIT + BigInt(decimal.padEnd(8, "0"));
  if (result <= 0n || result > 1000000n * UNIT)
    throw Error("Price must be greater than zero and at most 1,000,000 CKB.");
  return result;
}
export function formatCkb(value) {
  const n = BigInt(value),
    fraction = (n % UNIT).toString().padStart(8, "0").replace(/0+$/, "");
  return (n / UNIT).toString() + (fraction ? "." + fraction : "");
}
export function splitPrice(value) {
  const total = BigInt(value),
    store = total / 5n;
  return {
    total: total.toString(),
    store: store.toString(),
    vendor: (total - store).toString(),
  };
}
