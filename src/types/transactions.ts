interface Coin{
    amount: string,
    denom: string
}

interface Fee {
    gas: string,
    amount: Coin[],
    granter?: string,
    payer?: string
}

export interface ITransactionParams{
    privateKey: string,
    senderAddress: string,
    receiptAddress: string,
    amount: Coin[],
    fee: Fee,
    memo?: string,
}

export interface ISignParams extends Omit<ITransactionParams, 'amount' | 'receiptAddress' > {
    msgs: any
}

export interface ISignDirectParams extends Omit<ISignParams, 'amount' | 'receiptAddress' > {
    signData: {
        account_number: number,
        sequence: number,
        chainId: string
    }
}

export interface IExecuteTransactiom{
    privateKey: string,
    senderAddress: string,
    contractAddress: string,
    msg: any,
    fee: any | "auto" | number,
    memo?: string,
    funds?: readonly Coin[],
}

export interface ExecuteResult {
    /** @deprecated Not filled in Cosmos SDK >= 0.50. Use events instead. */
    readonly logs: any;
    /** Block height in which the transaction is included */
    readonly height: number;
    /** Transaction hash (might be used as transaction ID). Guaranteed to be non-empty upper-case hex */
    readonly transactionHash: string;
    readonly events: readonly Event[];
    readonly gasWanted: bigint;
    readonly gasUsed: bigint;
}
  
export interface ExecuteInstruction {
    contractAddress: string;
    msg: any;
    funds?: readonly Coin[];
}


export interface IExecuteMultipleTransaction{
    privateKey: string,
    senderAddress: string,
    instructions: readonly ExecuteInstruction[]
    fee: any | "auto" | number,
    memo?: string,
}