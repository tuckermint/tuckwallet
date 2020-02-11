import { createWalletFromMnemonic } from '@tendermint/sig';

const serverAddress = 'https://api.cosmos.network'
const denom = 'uatom';

async function fetchFromServer(path){
  let response = await fetch(`${serverAddress}${path}`);
  let data = await response.json()
  console.log(data);
  return data;
}

function setAccount(){
    window.document.getElementById('address').value = window.wallet.address;     
}

async function setBalance(){
    fetchFromServer(`/bank/balances/${window.wallet.address}`).then(data => {               
        const result = data['result'];
        
        for(const res of result){
            if (res['denom'] === denom){                
                const amount = res['amount'];
                
                window.document.getElementById('balance').value = `${amount} ${denom}`;
                break;
            }    
        }        
        console.log("Did not find correct denom for balance");
      }).catch(error => {
        console.log("Error getting balance");
      });        
}

function setSupply(){
    fetchFromServer(`/supply/total/${denom}`)
      .then(data => {          
        const supply = data['result'];
        
        window.document.getElementById('totalSupply').value = `${supply} ${denom}`;
        
      }).catch(error => {
        console.log("Error getting supply");
      });       
}

function showMainHeader(){
    window.document.getElementById('initialHeader').style.display = 'none';
    window.document.getElementById('header').style.display = '';
    window.document.getElementById('accountInfo').style.display = '';
    window.document.getElementById('chainInfo').style.display = '';
}

export function loadAccount(){
    const mnemonic = window.document.getElementById('mnemonic').value; // BIP39 mnemonic string

    window.wallet = createWalletFromMnemonic(mnemonic);    

    console.log(window.wallet);
    
    setAccount();
    setBalance();
    setSupply();
    showMainHeader();    
}
