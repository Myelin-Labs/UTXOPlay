import { ccc } from "@ckb-ccc/shell";
import { UNIT, parsePrice, formatCkb, splitPrice } from "../shared/pricing.mjs";
export { UNIT, parsePrice, formatCkb, splitPrice };
export const CONFIRMATIONS = 24;
export function jsonSafe(value) {
  return JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === "bigint" ? "0x" + v.toString(16) : v,
    ),
  );
}
export function minimumPrice(storeLock, vendorLock) {
  const minimum = (lock) =>
    BigInt(ccc.CellOutput.from({ capacity: 0, lock }).occupiedSize) * UNIT;
  const store = minimum(storeLock) * 5n,
    vendor = (minimum(vendorLock) * 5n + 3n) / 4n;
  return store > vendor ? store : vendor;
}
export function validatePaymentTransaction(
  txLike,
  order,
  { prepared = false } = {},
) {
  const tx = ccc.Transaction.from(txLike),
    quote = JSON.parse(order.quote),
    splits = splitPrice(order.price);
  if (
    tx.inputs.length < 1 ||
    tx.inputs.length > 128 ||
    tx.outputs.length < 2 ||
    tx.outputs.length > 8
  )
    throw Error("Unexpected payment transaction shape.");
  for (const [i, lock, amount] of [
    [0, quote.storeLock, splits.store],
    [1, quote.vendorLock, splits.vendor],
  ]) {
    const o = tx.outputs[i];
    if (
      !o.lock.eq(ccc.Script.from(lock)) ||
      o.capacity !== BigInt(amount) ||
      o.type ||
      tx.outputsData[i] !== "0x"
    )
      throw Error(
        "The payment must contain the exact 20% / 80% outputs from this order.",
      );
  }
  for (let i = 2; i < tx.outputs.length; i++) {
    const o = tx.outputs[i];
    if (
      !o.lock.eq(ccc.Script.from(quote.buyerLock)) ||
      o.type ||
      tx.outputsData[i] !== "0x"
    )
      throw Error("Payment change must return to the purchasing wallet.");
  }
  if (
    new Set(
      tx.inputs.map(
        (i) => i.previousOutput.txHash + ":" + i.previousOutput.index,
      ),
    ).size !== tx.inputs.length
  )
    throw Error("Duplicate payment input.");
  if (!prepared && tx.hash() !== order.tx_hash)
    throw Error("Transaction does not match the reserved invoice.");
  return tx;
}
export function createChainReader({
  client,
  confirmations = CONFIRMATIONS,
} = {}) {
  let owner;
  function getClient() {
    if (!client) {
      owner = ccc.ClientPublicMainnet.open();
      client = owner.value;
    }
    return client;
  }
  async function address(value) {
    if (typeof value !== "string" || !value.startsWith("ckb1"))
      throw Error("Use a CKB mainnet receive address.");
    return ccc.Address.fromString(value, getClient());
  }
  async function inspect(order) {
    const c = getClient(),
      response = await c.getTransactionNoCache(order.tx_hash);
    if (!response || response.status !== "committed")
      return {
        status: response?.status === "rejected" ? "rejected" : "pending",
        confirmations: 0,
      };
    const tx = validatePaymentTransaction(response.transaction, order),
      height = response.blockNumber;
    if (height === undefined || !response.blockHash)
      throw Error("Payment block information is unavailable.");
    const [block, tip] = await Promise.all([
      c.getHeaderByNumberNoCache(height),
      c.getTipHeader(),
    ]);
    if (!block || block.hash !== response.blockHash)
      return { status: "pending", confirmations: 0 };
    if (height <= BigInt(order.created_tip))
      throw Error("This payment predates the order.");
    const count = Number(tip.number - height + 1n);
    if (count < confirmations)
      return { status: "confirming", confirmations: Math.max(0, count) };
    const quote = JSON.parse(order.quote);
    let owned = false;
    // Resolve consumed cells from their historical transactions; they need not remain live.
    for (const input of tx.inputs) {
      const prior = await c.getTransactionNoCache(input.previousOutput.txHash);
      const cell =
        prior?.transaction.outputs[Number(input.previousOutput.index)];
      if (cell?.lock.eq(ccc.Script.from(quote.buyerLock))) {
        owned = true;
        break;
      }
    }
    if (!owned)
      throw Error("The payment was not funded by the purchasing wallet.");
    return {
      status: "confirmed",
      confirmations: count,
      blockHash: block.hash,
      blockNumber: height.toString(),
    };
  }
  return {
    address,
    tip: async () => String((await getClient().getTipHeader()).number),
    inspect,
    close: () => owner?.dispose(),
  };
}
