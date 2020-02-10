import { createWalletFromMnemonic } from '@tendermint/sig';


export function test(){
const mnemonic = 'trouble salon husband push melody usage fine ensure blade deal miss twin';

const wallet = createWalletFromMnemonic(mnemonic); // BIP39 mnemonic string

console.log(wallet);
}
