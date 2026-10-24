import { chooseMove } from "./strategy.mjs";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ id: data.id, move: chooseMove(data) });
  } catch {
    self.postMessage({
      id: data.id,
      error: "The training partner could not read this position.",
    });
  }
};
