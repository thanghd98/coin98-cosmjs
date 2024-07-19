import { MsgData } from "cosmjs-types/cosmos/base/abci/v1beta1/abci";

export interface DeliverTxResponse {
    readonly height: number;
    /** The position of the transaction within the block. This is a 0-based index. */
    readonly txIndex: number;
    /** Error code. The transaction suceeded if and only if code is 0. */
    readonly code: number;
    readonly transactionHash: string;
    readonly events: readonly Event[];
    /**
     * A string-based log document.
     *
     * This currently seems to merge attributes of multiple events into one event per type
     * (https://github.com/tendermint/tendermint/issues/9595). You might want to use the `events`
     * field instead.
     *
     * @deprecated This field is not filled anymore in Cosmos SDK 0.50+ (https://github.com/cosmos/cosmos-sdk/pull/15845).
     * Please consider using `events` instead.
     */
    readonly rawLog?: string;
    /** @deprecated Use `msgResponses` instead. */
    readonly data?: readonly MsgData[];
    /**
     * The message responses of the [TxMsgData](https://github.com/cosmos/cosmos-sdk/blob/v0.46.3/proto/cosmos/base/abci/v1beta1/abci.proto#L128-L140)
     * as `Any`s.
     * This field is an empty list for chains running Cosmos SDK < 0.46.
     */
    readonly msgResponses: Array<{ readonly typeUrl: string; readonly value: Uint8Array }>;
    readonly gasUsed: bigint;
    readonly gasWanted: bigint;
}
  
export function isDeliverTxFailure(result: DeliverTxResponse): boolean {
  return !!result.code;
}


export function createDeliverTxResponseErrorMessage(result: DeliverTxResponse): string {
    return `Error when broadcasting tx ${result.transactionHash} at height ${result.height}. Code: ${result.code}; Raw log: ${result.rawLog}`;
}