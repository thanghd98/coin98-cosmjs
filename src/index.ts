import { bech32 } from "bech32";
import { CosmosChainInfo, ICreateAccountResponse } from "./types";
import { ICreateAccountParams } from "./types";
import { mnemonicToSeed } from "bip39"
import { compressPubkey, makeKeypair, Slip10, Slip10Curve, stringToPath } from "./crypto";
import { rawSecp256k1PubkeyToRawAddress } from "./amino";

export class CosmosLibrary{
  chainInfo: CosmosChainInfo

  constructor( chainInfo: CosmosChainInfo ){
    this.chainInfo = chainInfo
  }

  async createAcccount(params: ICreateAccountParams): Promise<ICreateAccountResponse>{
    const {isPrivateKey, mnemonic, privateKey, path} = params
    let privKey: Buffer

    try {
        if(isPrivateKey){
          privKey = Buffer.from(privateKey, 'hex')
        }else{
          const seed = await mnemonicToSeed(mnemonic)
          const { privkey: privateKey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, stringToPath(`m/44'/${path}'/0'/0/0`));
          privKey = privateKey as Buffer
        }

        const uncompressed =  (await makeKeypair(privKey)).pubkey
        console.log("🚀 ~ huhu ~ uncompressed:", uncompressed)
    
        const publickey = compressPubkey(uncompressed)


        const words = bech32.toWords(rawSecp256k1PubkeyToRawAddress(publickey))
        const address = bech32.encode('cosmos', words)

        return {
            address,
            privateKey: privKey.toString('hex'),
            publicKey: Buffer.from(publickey).toString('hex')
        }
    } catch (error) {
      console.log("🚀 ~ CosmosLibrary ~ createAcccount ~ error:", error)
      throw new Error('Can not create the account')
    }
  }
}