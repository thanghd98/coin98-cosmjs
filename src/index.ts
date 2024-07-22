import { bech32 } from "bech32";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { CosmosChainInfo, ICreateAccountResponse, ISignDirectParams, ISignParams, ITransactionParams, IExecuteTransactiom, ExecuteResult, ExecuteInstruction, IExecuteMultipleTransaction, StdSignDoc } from "./types";
import { ICreateAccountParams } from "./types";
import { mnemonicToSeed } from "bip39"
import { compressPubkey, createSignature, makeKeypair, Sha256, sha256, Slip10, Slip10Curve, stringToPath } from "./crypto";
import { encodeSecp256k1Pubkey, rawSecp256k1PubkeyToRawAddress, serializeSignDoc } from "./amino";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { getAccount } from "./utils";
import { encode, encodePubkey, makeAuthInfoBytes, makeSignBytes, makeSignDoc } from "./proto-signing";
import { Int53 } from "./math";
import { encodeSecp256k1Signature } from "./crypto/signature";
import { fromBase64, toBase64, toUtf8 } from "./encoding";
import { createDeliverTxResponseErrorMessage, isDeliverTxFailure, parseRawLog } from "./stargate";
import get from "lodash/get";

export class Cosmos{
  chainInfo: CosmosChainInfo

  constructor( chainInfo: CosmosChainInfo ){
    this.chainInfo = chainInfo
  }

  async createAcccount(params: ICreateAccountParams): Promise<ICreateAccountResponse>{
    console.log("🚀 ~ Cosmos ~ createAcccount ~ params:", params)
    const {isPrivateKey, mnemonic, privateKey, path} = params
    let privKey: Buffer

    try {
        if(isPrivateKey){
          privKey = privateKey
        }else{
          const seed = await mnemonicToSeed(mnemonic)
          const { privkey: privateKey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, stringToPath(`m/44'/${path}'/0'/0/0`));
          privKey = privateKey as Buffer
        }
        console.log("🚀 ~ Cosmos ~ createAcccount ~ privKey:", privKey)

        const uncompressed =  (await makeKeypair(privKey)).pubkey
        console.log("🚀 ~ Cosmos ~ createAcccount ~ uncompressed:", uncompressed)
    
        const publickey = compressPubkey(uncompressed)
        console.log("🚀 ~ Cosmos ~ createAcccount ~ publickey:", publickey)

        const words = bech32.toWords(rawSecp256k1PubkeyToRawAddress(publickey))
        const address = bech32.encode( get(this.chainInfo, 'bech32Config.bech32PrefixAccAddr'), words)

        return {
            address,
            privateKey: Buffer.from(privKey).toString('hex'),
            publicKey: Buffer.from(publickey).toString('hex')
        }
    } catch (error) {
      console.log("🚀 ~ CosmosLibrary ~ createAcccount ~ error:", error)
      throw new Error('Can not create the account')
    }
  }

  async sendTokens(params: ITransactionParams){
    const { senderAddress, receiptAddress, amount, privateKey, fee, memo } = params
    const sendMsg = {
        typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        value: {
          fromAddress: senderAddress,
          toAddress: receiptAddress,
          amount: [...amount],
        },
    }
    console.log("🚀 ~ sendMsg:", sendMsg)

    return this.signAndBroadcast({senderAddress, privateKey, msgs: sendMsg, fee, memo })
  }

  async signAndBroadcast(params: ISignParams){
    const { senderAddress, privateKey, memo, fee, msgs } = params
    const txRaw = await this.sign({privateKey, senderAddress, msgs, fee, memo}) as TxRaw;
    const txBytes = TxRaw.encode(txRaw).finish();

    return this.broadcastTransaction(toBase64(txBytes))
  }

  async sign(params: ISignParams){
    const { senderAddress } = params

    const rest = this.chainInfo.rest
    const { account_number, sequence } = await getAccount({rest, address: senderAddress})

    const  signerData = {
      account_number: account_number,
      sequence: sequence,
      chainId: this.chainInfo.chainId,
    };

    return this.signDirect({...params, signData: signerData})
  }

  async signDirect(params: ISignDirectParams){
    const { signData, privateKey, msgs, memo, fee } = params
    const { account_number, sequence, chainId } = signData

    const uncompressed =  (await makeKeypair(Buffer.from(privateKey, 'hex'))).pubkey
    const publickey = compressPubkey(uncompressed)
    const pubkey = encodePubkey(encodeSecp256k1Pubkey(publickey));

    const txBodyEncodeObject = {
      typeUrl: "/cosmos.tx.v1beta1.TxBody",
      value: {
        messages: msgs,
        memo: memo,
      },
    };

    const txBodyBytes = encode(txBodyEncodeObject);
    const gasLimit = Int53.fromString(fee.gas).toNumber();

    const authInfoBytes = makeAuthInfoBytes(
      [{ pubkey, sequence }],
      fee.amount,
      gasLimit,
      fee.granter,
      fee.payer,
    );

    const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, chainId, account_number);

    const signBytes = makeSignBytes(signDoc);
    const hashedMessage = sha256(signBytes);
    const signature = await createSignature(hashedMessage, Buffer.from(privateKey, 'hex'));
    const signatureBytes = new Uint8Array([...signature.r(32), ...signature.s(32)]);
    const stdSignature = encodeSecp256k1Signature(publickey, signatureBytes);

    const txRaw = TxRaw.fromPartial({
      bodyBytes: signDoc.bodyBytes,
      authInfoBytes: signDoc.authInfoBytes,
      signatures: [fromBase64(stdSignature.signature)],
    });

    return txRaw
  }

  async signAmino(privateKey: string, signDoc: StdSignDoc){
    const uncompressed =  (await makeKeypair(Buffer.from(privateKey, 'hex'))).pubkey
    const publickey = compressPubkey(uncompressed)

    const message = new Sha256(serializeSignDoc(signDoc)).digest();
    const signature = await createSignature(message, Buffer.from(privateKey, 'hex'));
    const signatureBytes = new Uint8Array([...signature.r(32), ...signature.s(32)]);

    return {
      signed: signDoc,
      signature: encodeSecp256k1Signature(publickey, signatureBytes),
    };
  }

  async broadcastTransaction(txBytes: string){
    const broadcastTx = await fetch(`${this.chainInfo.rest}`,{
      method: 'POST',
      body: JSON.stringify({
          "jsonrpc": "2.0",
          "id": new Date().getTime(),
          "method": "broadcast_tx_sync",
          "params": {
             "tx": txBytes
          }
      })
    })

    const { result } = await broadcastTx.json()

    return result?.hash || ''
  }

  async execute (params: IExecuteTransactiom ): Promise<ExecuteResult>{
    const { contractAddress, msg, funds, privateKey, senderAddress, fee, memo } = params
    const instruction: ExecuteInstruction = {
      contractAddress: contractAddress,
      msg: msg,
      funds: funds,
    };
    return this.executeMultiple( {privateKey, senderAddress, instructions: [instruction], fee, memo});
  }

  async executeMultiple ( params: IExecuteMultipleTransaction): Promise<ExecuteResult>{
    const { instructions, senderAddress , privateKey, fee, memo } = params

    const msgs: any[] = instructions.map((i) => ({
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: MsgExecuteContract.fromPartial({
        sender: senderAddress,
        contract: i.contractAddress,
        msg: toUtf8(JSON.stringify(i.msg)),
        funds: [...(i.funds || [])],
      }), 
    }));

    const result = await this.signAndBroadcast({privateKey, senderAddress, msgs, fee, memo});

    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxResponseErrorMessage(result));
    }

    return {
      logs: parseRawLog(result.rawLog),
      height: result.height,
      transactionHash: result.transactionHash,
      events: result.events,
      gasWanted: result.gasWanted,
      gasUsed: result.gasUsed,
    };
  }
}

