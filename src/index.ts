import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { CosmosChainInfo, ICreateAccountResponse, ISignDirectParams, ISignParams, ITransactionParams, IExecuteTransactiom, ExecuteResult, ExecuteInstruction, IExecuteMultipleTransaction, TokenCW20Params, ISignAminoParams } from "./types";
import { ICreateAccountParams } from "./types";
import { mnemonicToSeed } from "bip39"
import { compressPubkey, createSignature, makeKeypair, Sha256, sha256, Slip10, Slip10Curve, stringToPath } from "./crypto";
import { encodeSecp256k1Pubkey, rawSecp256k1PubkeyToRawAddress, serializeSignDoc } from "./amino";
import { BinaryReader, getAccount, QuerySmartContractStateRequest, QuerySmartContractStateResponse } from "./utils";
import { encode, encodeInjectivePubkey, encodePubkey, makeAuthInfoBytes, makeSignBytes, makeSignDoc } from "./proto-signing";
import { Int53 } from "./math";
import { encodeSecp256k1Signature } from "./crypto/signature";
import { fromBase64, fromUtf8, toAscii, toBase64, toBech32, toUtf8 } from "./encoding";
import { createDeliverTxResponseErrorMessage, isDeliverTxFailure } from "./stargate";
import keccak256 from 'keccak256'
import get from "lodash/get";


export class Coin98Cosmos{
  chainInfo: CosmosChainInfo

  constructor( chainInfo: CosmosChainInfo ){
    this.chainInfo = chainInfo
  }

  static withChainInfo(chainInfo: CosmosChainInfo){
    return new Coin98Cosmos(chainInfo)
  }

  async createAcccount(params: ICreateAccountParams): Promise<ICreateAccountResponse>{
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

        const uncompressed =  (await makeKeypair(privKey)).pubkey
    
        const publickey = compressPubkey(uncompressed)
        const address = toBech32(get(this.chainInfo, 'bech32Config.bech32PrefixAccAddr'), rawSecp256k1PubkeyToRawAddress(publickey))

        return {
            address,
            privateKey: Buffer.from(privKey).toString('hex'),
            publicKey: Buffer.from(publickey).toString('hex')
        }
    } catch (error) {
      throw new Error('Can not create the account')
    }
  }

  async sendTokens(params: ITransactionParams){
    const { senderAddress, receiptAddress, amount, wallet, fee, memo } = params
    try {
      const sendMsg = {
          typeUrl: "/cosmos.bank.v1beta1.MsgSend",
          value: {
            fromAddress: senderAddress,
            toAddress: receiptAddress,
            amount: [...amount],
          },
      }
  
      return this.signAndBroadcast({senderAddress, wallet, msgs: [sendMsg], fee, memo })
    } catch (error) {
      console.log("🚀 ~ Cosmos ~ sendTokens ~ error:", error)
      throw new Error(error.message)
    }
  }

  async signAndBroadcast(params: ISignParams){
    const { senderAddress, wallet, memo, fee, msgs } = params

    const txRaw = await this.sign({wallet, senderAddress, msgs, fee, memo}) as TxRaw;
    const txBytes = TxRaw.encode(txRaw).finish();
  
    return this.broadcastTransaction(toBase64(txBytes)) 
  }

  async sign(params: ISignParams){
    const { senderAddress, wallet, msgs, memo, fee,  } = params

    const rest = this.chainInfo.rest
    const { account_number, sequence } = await getAccount({rest, address: senderAddress, chain: wallet?.meta?.chain})

    const uncompressed =  (await makeKeypair(Buffer.from(wallet?.privateKey as string, 'hex'))).pubkey
    const publickey = compressPubkey(uncompressed)
    let pubkey = encodePubkey(encodeSecp256k1Pubkey(publickey));

    if(this.chainInfo.chainId.startsWith('injective') && !wallet?.meta?.isOldStandard){
      pubkey = encodeInjectivePubkey(encodeSecp256k1Pubkey(publickey));
    }else{
      pubkey = encodePubkey(encodeSecp256k1Pubkey(publickey));
    }
    
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

    const chainId =  this.chainInfo.chainId

    const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, chainId, account_number);

    const { signature } = await this.signDirect({wallet, signDoc})

    const txRaw = TxRaw.fromPartial({
      bodyBytes: signDoc.bodyBytes,
      authInfoBytes: signDoc.authInfoBytes,
      signatures: [fromBase64(signature.signature)],
    });

    return txRaw
  }


  async signDirect(params: ISignDirectParams){
    const { wallet, signDoc } = params

    const uncompressed =  (await makeKeypair(Buffer.from(wallet?.privateKey as string, 'hex'))).pubkey
    const publickey = compressPubkey(uncompressed)

    const signBytes = makeSignBytes(signDoc);
    let hashedMessage = sha256(signBytes);

    if(this.chainInfo.chainId?.startsWith('injective') && !wallet?.meta?.isOldStandard){
      hashedMessage = keccak256(Buffer.from(signBytes))
    }else{
      hashedMessage = sha256(signBytes);
    }

    const signature = await createSignature(Buffer.from(hashedMessage), Buffer.from(wallet?.privateKey as string, 'hex'));
    const signatureBytes = new Uint8Array([...signature.r(32), ...signature.s(32)]);
    const stdSignature = encodeSecp256k1Signature(publickey, signatureBytes);

    return {
      signed: signDoc,
      signature: stdSignature,
    };
  }

  async signAmino(params: ISignAminoParams){
    const { wallet, signDoc } = params
    const uncompressed =  (await makeKeypair(Buffer.from(wallet.privateKey as string, 'hex'))).pubkey
    const publickey = compressPubkey(uncompressed)

    const message = new Sha256(serializeSignDoc(signDoc)).digest();
    const signature = await createSignature(message, Buffer.from(wallet?.privateKey as string, 'hex'));
    const signatureBytes = new Uint8Array([...signature.r(32), ...signature.s(32)]);

    return {
      signed: signDoc,
      signature: encodeSecp256k1Signature(publickey, signatureBytes),
    };
  }

  async broadcastTransaction(txBytes: string){
    const broadcastTx = await fetch(`${this.chainInfo.rpc}`,{
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

    if(get(result, 'log') !== '[]' && get(result, 'log') !== ''){
      throw new Error(get(result, 'log'))
    }

    return result
  }

  async execute (params: IExecuteTransactiom ): Promise<ExecuteResult>{
    const { contractAddress, msg, funds, wallet, senderAddress, fee, memo } = params
    const instruction: ExecuteInstruction = {
      contractAddress: contractAddress,
      msg: msg,
      funds: funds,
    };
    return this.executeMultiple( {wallet, senderAddress, instructions: [instruction], fee, memo});
  }

  async executeMultiple ( params: IExecuteMultipleTransaction): Promise<ExecuteResult>{
    const { instructions, senderAddress , wallet, fee, memo } = params

    const msgs: any[] = instructions.map((i) => ({
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: MsgExecuteContract.fromPartial({
        sender: senderAddress,
        contract: i.contractAddress,
        msg: toUtf8(JSON.stringify(i.msg)),
        funds: [...(i.funds || [])],
      }), 
    }));

    const result = await this.signAndBroadcast({wallet, senderAddress, msgs, fee, memo});

    if (isDeliverTxFailure(result)) {
      throw new Error(createDeliverTxResponseErrorMessage(result));
    }

    return {
      // logs: parseRawLog(result.rawLog),
      // height: result.height,
      transactionHash: result.hash,
      // events: result.events,
      // gasWanted: result.gasWanted,
      // gasUsed: result.gasUsed,
    };
  }

  async queryContractSmart (params: TokenCW20Params){
    const { address, query} = params

    try {
      const request = { address: address, queryData: toAscii(JSON.stringify(query)) };    
      const  data  = QuerySmartContractStateRequest.encode(request).finish()
      const dataHex = Buffer.from(data).toString('hex')
  
      const fetching = await fetch(this.chainInfo.rpc, {
        method: 'POST',
        body: JSON.stringify({
          "jsonrpc": "2.0",
          "id": new Date().getTime(),
          "method": "abci_query",
          "params": {
              "path": "/cosmwasm.wasm.v1.Query/SmartContractState",
              "data": dataHex,
              "prove": false
          }
        })
      })
  
      const {result} = await fetching.json()

      const value = get(result, 'response.value')
      const valueRaw = fromBase64(value)

      const {data: resultDecode} = QuerySmartContractStateResponse.decode(new BinaryReader(valueRaw))

      let responseText: string;
      try {
        responseText = fromUtf8(resultDecode);
      } catch (error) {
        throw new Error(`Could not UTF-8 decode smart query response from contract: ${error}`);
      }
      try {
        return JSON.parse(responseText);
      } catch (error) {
        throw new Error(`Could not JSON parse smart query response from contract: ${error}`);
      }
      
    } catch (error) {
      throw new Error('Contract not found')
    }


  }
}



export * from './encoding'
export * from './crypto'
export * from './amino'