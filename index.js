import { createWalletFromMnemonic, signTx, verifyTx } from '@tendermint/sig';

// -- constants --
const serverAddress = 'https://api.cosmos.network'
const denom = 'uatom';
const chainId = 'cosmoshub-3';
const oneMillion = 1000000.0;


// -- utilities --

async function fetchFromServer(path){
  let response = await fetch(`${serverAddress}${path}`);
  let data = await response.json()
  console.log(data);
  return data;
}

async function getSignMeta(){
    let data = await fetchFromServer(`/auth/accounts/${window.wallet.address}`);
    
    return {
        account_number: data['result']['value']['account_number'],
        chain_id:       chainId,
        sequence:       data['result']['value']['sequence'],
    }
}

function getMicroMacroAmountString(microAmount, microDenom){
    const macroAmount = microAmount / oneMillion;
    const macroDenom = microDenom.substring(1);

    return `${macroAmount} ${macroDenom} / ${microAmount} ${microDenom}`;
}

function strip(str) {
    return str.replace(/^\s+|\s+$/g, '');
}

//-- initial load --

function setAccount(){
    window.document.getElementById('address').textContent = window.wallet.address;     
}

function storeBalances(result){
    const balances = {};
    
    for(const res of result){
        const currentDenom = res['denom'];
        const amount = res['amount'];
        balances[currentDenom] = amount;
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
                window.document.getElementById('balance').textContent = getMicroMacroAmountString(res['amount'], denom);
                return;
            }    
        }        
        console.log("Did not find correct denom for balance");
      }).catch(error => {
        console.log("Error getting balance");
      });        
}

async function setSupply(){
    fetchFromServer(`/supply/total/${denom}`)
      .then(data => {          
        const supply = data['result'];
        
        window.document.getElementById('totalSupply').textContent = getMicroMacroAmountString(supply, denom);
        
      }).catch(error => {
        console.log("Error getting supply");
      });       
}

function showMainHeader(){
    window.document.getElementById('initialHeader').style.display = 'none';
    window.document.getElementById('header').style.display = '';
    window.document.getElementById('infoHolder').style.display = '';
}

export async function loadAccount(){
    const mnemonic = strip(window.document.getElementById('mnemonic').value); // BIP39 mnemonic string

    window.wallet = createWalletFromMnemonic(mnemonic);    

    console.log(window.wallet);
    
    setAccount();
    await setBalance();
    await setSupply();
    showMainHeader();    
}

// -- actions --

// send
export function startSendTuckeratoms(){
    const currentBalanceInMicroTuckeratoms = window.balances[denom];
    const currentBalanceInTuckeratoms = currentBalanceInMicroTuckeratoms / oneMillion;
    
    const html = `
        <h2>Send Tuckeratoms</h2>
        
        Receiving Address: <input id="receivingAddress" style="width:100%;margin-bottom:20px;">
        Amount to Send (in Tuckeratoms): <input id="amountToSend" type="number" style="width:100%;margin-bottom:20px;" min=".000001" max="${currentBalanceInTuckeratoms}" step=".000001">
        Fee (in Tuckeratoms): <input id="fee" type="number" style="width:100%;margin-bottom:20px;" min="0" step=".000001" value=".005">
        Gas: <input id="gas" type="number" style="width:100%;margin-bottom:20px;" min="0" step="1" value="50000">
        
        <button onclick="tuckwallet.finishSendTuckeratoms()">Send</button>
    `;
    
    document.getElementById('mainContent').innerHTML = html;
}

export async function finishSendTuckeratoms(){
    const receivingAddress = strip(document.getElementById('receivingAddress').value);
    
    if (!receivingAddress){
        alert("You must enter a receiving address!");
        return;
    }
    
    const tuckeratomsToSend = Number(document.getElementById('amountToSend').value);
    const microTuckeratomsToSend = tuckeratomsToSend * oneMillion;
    
    const currentBalanceInMicroTuckeratoms = window.balances[denom];
    
    if (microTuckeratomsToSend > currentBalanceInMicroTuckeratoms){
        alert("You can't send more than you have!");
        return;
    }
    
    const feeInTuckeratoms = Number(document.getElementById('fee').value);
    
    if (feeInTuckeratoms < 0){
        alert("Fee can't be less than zero!");
        return;
    }
    
    const feeInMicroTuckeratoms = feeInTuckeratoms * oneMillion;
    
    if (microTuckeratomsToSend + feeInMicroTuckeratoms > currentBalanceInMicroTuckeratoms){
        alert("Amount to Send + Fee can't be more than your balance!");
        return;
    }
    
    const gas = Number(document.getElementById('gas').value);    
    
    if (gas < 0){
        alert("Gas can't be less than zero!");
        return;
    }
    
    const tx = {
        fee:  {
            amount: [{ amount: String(feeInMicroTuckeratoms), denom: denom }],
            gas:    String(gas)
        },
        memo: 'TuckWallet',
        msgs: [{
            type:  'cosmos-sdk/Send',
            value: {
                inputs:  [{
                    address: window.wallet.address,
                    coins:   [{ amount: String(microTuckeratomsToSend), denom: denom }]
                }],
                outputs: [{
                    address: receivingAddress,
                    coins:   [{  amount: String(microTuckeratomsToSend), denom: denom }]
                }]
            }
        }]
    };
    
    getSignMeta().then(signMeta => {
        const stdTx = signTx(tx, signMeta, window.wallet);
        console.log('signTx\n\n', JSON.stringify(stdTx, null, 2), '\n');
        
        const valid = verifyTx(stdTx, signMeta);
        console.log('verifyTx\n\n', JSON.stringify(valid, null, 2), '\n');
    });
}
