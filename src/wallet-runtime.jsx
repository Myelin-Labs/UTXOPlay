import React, { useEffect, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
const filter = async (info) =>
  ["CkbSecp256k1", "BtcEcdsa", "JoyId"].includes(info.signer.signType);
function Bridge({ onState }) {
  const signer = ccc.useSigner();
  const { open, close, disconnect, wallet, isOpen } = ccc.useCcc();
  useEffect(
    () => onState({ signer, open, close, disconnect, wallet, isOpen }),
    [signer, open, close, disconnect, wallet, isOpen, onState],
  );
  return null;
}
export default function WalletRuntime({ onState }) {
  const [client, setClient] = useState(null);
  useEffect(() => {
    const owner = ccc.ClientPublicMainnet.open();
    setClient(owner.value);
    return () => void owner.dispose();
  }, []);
  if (!client) return null;
  return (
    <ccc.Provider
      defaultClient={client}
      clientOptions={[{ client, name: "CKB Mainnet" }]}
      name="UTXOPlay"
      icon={location.origin + "/brand/utxoplay-logo-dark-192.png"}
      signerFilter={filter}
      hideKhie
      connectorProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-label": "Choose your wallet",
        style: {
          "--background": "#181e1b",
          "--divider": "#303b34",
          "--btn-primary": "#222d26",
          "--btn-primary-hover": "#344b3b",
          "--btn-secondary": "#303b34",
          "--btn-secondary-hover": "#415648",
          "--icon-primary": "#edf5ef",
          "--icon-secondary": "#a3b2a8",
          "--tip-color": "#a3b2a8",
          color: "#edf5ef",
        },
      }}
    >
      <Bridge onState={onState} />
    </ccc.Provider>
  );
}
