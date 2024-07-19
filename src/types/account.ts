export interface ICreateAccountParams{
    isPrivateKey: string,
    mnemonic: string,
    privateKey: string,
    path?: string
}

export interface ICreateAccountResponse{
    address: string,
    publicKey: string,
    privateKey: string,
}