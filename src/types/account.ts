export interface ICreateAccountParams{
    isPrivateKey: boolean,
    mnemonic: string,
    privateKey: Buffer,
    path?: string
}

export interface ICreateAccountResponse{
    address: string,
    publicKey: string,
    privateKey: string,
}

export interface IAccountParams {
    address: string, 
    rest: string
}

export interface IAccountResponse {
    sequence: number, 
    account_number: number,
    pub_key: string
}