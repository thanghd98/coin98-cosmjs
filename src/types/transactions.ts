import { Wallet } from '@wallet/core'
import { SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
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
    wallet: Wallet,
    senderAddress: string,
    receiptAddress: string,
    amount: Coin[],
    fee: Fee,
    memo?: string,
}

export interface ISignParams extends Omit<ITransactionParams, 'amount' | 'receiptAddress' > {
    msgs: any
}

export interface ISignDirectParams{
    wallet: Wallet,
    signDoc: SignDoc
}

export interface IExecuteTransactiom{
    wallet: Wallet,
    senderAddress: string,
    contractAddress: string,
    msg: any,
    fee: any | "auto" | number,
    memo?: string,
    funds?: readonly Coin[],
}

export interface ExecuteResult {
    readonly transactionHash: string;
}
  
export interface ExecuteInstruction {
    contractAddress: string;
    msg: any;
    funds?: readonly Coin[];
}


export interface IExecuteMultipleTransaction{
    wallet: Wallet,
    senderAddress: string,
    instructions: readonly ExecuteInstruction[]
    fee: any | "auto" | number,
    memo?: string,
}

export interface AminoMsg {
    readonly type: string;
    readonly value: any;
}

export interface StdSignDoc {
    readonly chain_id: string;
    readonly account_number: string;
    readonly sequence: string;
    readonly fee: Fee;
    readonly msgs: readonly AminoMsg[];
    readonly memo: string;
}

export interface ISignAminoParams{
    wallet: Wallet,
    signDoc: StdSignDoc
}


export interface TokenCW20Params{
    address: string,
    query?: any
}

export interface TokenCW20Response{
    address: string,
    symbol: string,
    decimals: string
}