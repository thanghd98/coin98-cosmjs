import { Any } from "cosmjs-types/google/protobuf/any";
import { fromBase64 } from "../encoding";
import { Uint53 } from "../math";
import { LegacyAminoPubKey } from "cosmjs-types/cosmos/crypto/multisig/keys";
import { PubKey as CosmosCryptoSecp256k1Pubkey } from "cosmjs-types/cosmos/crypto/secp256k1/keys";
import { PubKey as CosmosCryptoEd25519Pubkey } from "cosmjs-types/cosmos/crypto/ed25519/keys";

export interface Pubkey {
    // type is one of the strings defined in pubkeyType
    // I don't use a string literal union here as that makes trouble with json test data:
    // https://github.com/cosmos/cosmjs/pull/44#pullrequestreview-353280504
    readonly type: string;
    readonly value: any;
}

export interface SinglePubkey extends Pubkey {
    // type is one of the strings defined in pubkeyType
    // I don't use a string literal union here as that makes trouble with json test data:
    // https://github.com/cosmos/cosmjs/pull/44#pullrequestreview-353280504
    readonly type: string;
    /**
     * The base64 encoding of the Amino binary encoded pubkey.
     *
     * Note: if type is Secp256k1, this must contain a 33 bytes compressed pubkey.
     */
    readonly value: string;
}

export interface Ed25519Pubkey extends SinglePubkey {
    readonly type: "tendermint/PubKeyEd25519";
    readonly value: string;
}
  
export function isEd25519Pubkey(pubkey: Pubkey): pubkey is Ed25519Pubkey {
    return (pubkey as Ed25519Pubkey).type === "tendermint/PubKeyEd25519";
}

export interface Secp256k1Pubkey extends SinglePubkey {
    readonly type: "tendermint/PubKeySecp256k1";
    readonly value: string;
}

export function isSecp256k1Pubkey(pubkey: Pubkey): pubkey is Secp256k1Pubkey {
    return (pubkey as Secp256k1Pubkey).type === "tendermint/PubKeySecp256k1";
}

export interface MultisigThresholdPubkey extends Pubkey {
    readonly type: "tendermint/PubKeyMultisigThreshold";
    readonly value: {
      /** A string-encoded integer */
      readonly threshold: string;
      readonly pubkeys: readonly SinglePubkey[];
    };
}
  
export function isMultisigThresholdPubkey(pubkey: Pubkey): pubkey is MultisigThresholdPubkey {
    return (pubkey as MultisigThresholdPubkey).type === "tendermint/PubKeyMultisigThreshold";
}

export function encodeInjectivePubkey(pubkey: Pubkey){
  const pubkeyProto = CosmosCryptoSecp256k1Pubkey.fromPartial({
    key: fromBase64(pubkey.value),
  });
  return Any.fromPartial({
    typeUrl: "/injective.crypto.v1beta1.ethsecp256k1.PubKey",
    value: Uint8Array.from(CosmosCryptoSecp256k1Pubkey.encode(pubkeyProto).finish()),
  });
}

export function encodePubkey(pubkey: Pubkey): Any {
    if (isSecp256k1Pubkey(pubkey)) {
      const pubkeyProto = CosmosCryptoSecp256k1Pubkey.fromPartial({
        key: fromBase64(pubkey.value),
      });
      return Any.fromPartial({
        typeUrl: "/cosmos.crypto.secp256k1.PubKey",
        value: Uint8Array.from(CosmosCryptoSecp256k1Pubkey.encode(pubkeyProto).finish()),
      });
    } else if (isEd25519Pubkey(pubkey)) {
      const pubkeyProto = CosmosCryptoEd25519Pubkey.fromPartial({
        key: fromBase64(pubkey.value),
      });
      return Any.fromPartial({
        typeUrl: "/cosmos.crypto.ed25519.PubKey",
        value: Uint8Array.from(CosmosCryptoEd25519Pubkey.encode(pubkeyProto).finish()),
      });
    } else if (isMultisigThresholdPubkey(pubkey)) {
      const pubkeyProto = LegacyAminoPubKey.fromPartial({
        threshold: Uint53.fromString(pubkey.value.threshold).toNumber(),
        publicKeys: pubkey.value.pubkeys.map(encodePubkey),
      });
      return Any.fromPartial({
        typeUrl: "/cosmos.crypto.multisig.LegacyAminoPubKey",
        value: Uint8Array.from(LegacyAminoPubKey.encode(pubkeyProto).finish()),
      });
    } else {
      throw new Error(`Pubkey type ${pubkey.type} not recognized`);
    }
  }
  