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
    window.document.getElementById('address').textContent = window.wallet.address;     
}

function storeBalances(result){
    const balances = {};
    
    for(const res of result){
        const denom = res['denom'];
        const amount = res['amount'];
        balances[denom] = amount;
    }
    
    window.balances = balances;
}

async function setBalance(){
    //fetchFromServer(`/bank/balances/${window.wallet.address}`).then(data => {               
    // use cosmos12w6tynmjzq4l8zdla3v4x0jt8lt4rcz5dz2hye as a test address
    fetchFromServer(`/bank/balances/cosmos12w6tynmjzq4l8zdla3v4x0jt8lt4rcz5dz2hye`).then(data => {   
        const result = data['result'];
        
        storeBalances(result);
        
        for(const res of result){
            if (res['denom'] === denom){                
                const amount = res['amount'];
                
                window.document.getElementById('balance').textContent = `${amount} ${denom}`;
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
        
        window.document.getElementById('totalSupply').textContent = `${supply} ${denom}`;
        
      }).catch(error => {
        console.log("Error getting supply");
      });       
}

function showMainHeader(){
    window.document.getElementById('initialHeader').style.display = 'none';
    window.document.getElementById('header').style.display = '';
    window.document.getElementById('infoHolder').style.display = '';
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
