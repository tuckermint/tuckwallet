import { createWalletFromMnemonic, signTx, verifyTx, createBroadcastTx, BROADCAST_MODE_BLOCK } from '@tendermint/sig';

// -- constants --
const serverAddress = 'https://api.cosmos.network'
const denom = 'uatom';
const chainId = 'cosmoshub-3';
const oneHundred = 100.0;
const oneMillion = 1000000.0;


// -- utilities --

async function fetchFromServer(path){
  const response = await fetch(`${serverAddress}${path}`);
  const data = await response.json()
  console.log(data);
  return data;
}

async function postToServer(path, payload){
  const response = await fetch(`${serverAddress}${path}`, {
    method: 'post',
    body: JSON.stringify(payload)
  });
  
  const data = await response.json()
  console.log(data);
  return data;
}

async function getSignMeta(){
    const data = await fetchFromServer(`/auth/accounts/${window.wallet.address}`);
    
    return {
        account_number: data['result']['value']['account_number'],
        chain_id:       chainId,
        sequence:       data['result']['value']['sequence'],
    }
}

async function submitTransaction(tx){
    getSignMeta().then(signMeta => {        
        const stdTx = signTx(tx, signMeta, window.wallet);
        console.log('signTx\n\n', JSON.stringify(stdTx, null, 2), '\n');
        
        const valid = verifyTx(stdTx, signMeta);
        console.log('verifyTx\n\n', JSON.stringify(valid, null, 2), '\n');
        
        const broadcastTx = createBroadcastTx(stdTx, BROADCAST_MODE_BLOCK);
        console.log('broadcastTx\n\n', JSON.stringify(broadcastTx, null, 2), '\n');     
        
        postToServer("/txs", broadcastTx).then(responseData => {
            alert(`Transaction result: ${JSON.stringify(responseData)}`);
        }).catch(error => {
            alert(`call failed: ${JSON.stringify(error)}`);
        });
    });     
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
    fetchFromServer(`/bank/balances/${window.wallet.address}`).then(data => {               
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
    
    if (window.wallet.address === receivingAddress){
        alert("You can't send to yourself!");
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
    
    const send = confirm(`Sending ${tuckeratomsToSend} Tuckeratoms to ${receivingAddress}`);
    
    if (!send){
        return;
    }
    
    const tx = {
        msg: [{
            type:  'cosmos-sdk/MsgSend',
            value: {
                amount: [{
                    amount: String(microTuckeratomsToSend),
                    denom: denom
                }],
                from_address: window.wallet.address,
                to_address: receivingAddress
            }
        }],
        fee:  {            
            amount: [{ denom: denom, amount: String(feeInMicroTuckeratoms) }],
            gas:    String(gas)
        },
        memo: 'TuckWallet',
    }       
    
    submitTransaction(tx);
}
// delegate

async function getValidators(){
    const response = await fetchFromServer('/staking/validators');
    const validators = response['result'].sort((a, b) => (a['description']['moniker'] > b['description']['moniker']) ? 1 : -1);
    
    let options = '';
    let validatorAddressToNameMap = {};
    
    for (const validator of validators){
        const jailed = validator['jailed'];
        
        if (jailed){
            continue;
        }        
        
        const address = validator['operator_address'];
        const name = validator['description']['moniker'];
        const commission = String(Number(validator['commission']['commission_rates']['rate']) * oneHundred) + '%';        
        
        const microTuckeratoms = validator['tokens'];
        const tuckeratoms = microTuckeratoms / oneMillion;
        
        validatorAddressToNameMap[address] = name;
                
        options += `<option value='${address}'>${name}: ${commission} commission, ${tuckeratoms} Tuckeratoms controlled</option>`;
    }
    
    return [options, validatorAddressToNameMap];
}

async function getDelegations(validatorAddressToNameMap){
    const response = await fetchFromServer(`/staking/delegators/${window.wallet.address}/delegations`);
    const delegations = response['result'].sort((a, b) => (a['shares'] > b['shares']) ? 1 : -1);
    
    let options = '';
    
    for (const delegation of delegations){
        const address = delegation['validator_address'];
        const name = validatorAddressToNameMap[address];        
        const microTuckeratomBalance = delegation['balance'];
        const tuckeratomBalance = microTuckeratomBalance / oneMillion;
        
        options += `<option value='${address}'>${name}: ${tuckeratomBalance} Tuckeratoms delegated</option>`;
    }
    
    return options;
}

export function updateMaxDelegationAmount(){
    const source = window.document.getElementById('source');
    const text = source.options[source.selectedIndex].text;
    
    const amount = window.document.getElementById('amountToDelegate');
    
    if (text === 'Undelegated Tuckeratoms'){
        const currentBalanceInMicroTuckeratoms = window.balances[denom];
        const currentBalanceInTuckeratoms = currentBalanceInMicroTuckeratoms / oneMillion;
        amount.max = currentBalanceInTuckeratoms;
    }
    else{
        amount.max = Number(text.split(': ')[1].split(' ')[0]);
    }
}

export async function startDelegateTuckeratoms(){
    const currentBalanceInMicroTuckeratoms = window.balances[denom];
    const currentBalanceInTuckeratoms = currentBalanceInMicroTuckeratoms / oneMillion;
    const [validators, validatorAddressToNameMap] = await getValidators();
    const delegations = await getDelegations(validatorAddressToNameMap);
    
    const html = `
        <h2>Delegate / Redelegate Tuckeratoms</h2>
        
        Validator: <select id="validator" style="margin-bottom:20px;">${validators}</select>
        Source of Tuckeratoms:  <select onchange="tuckwallet.updateMaxDelegationAmount()" id="source" style="width:100%;margin-bottom:20px;"><option value="undelegated">Undelegated Tuckeratoms</option>${delegations}</select>
        Amount to Delegate (in Tuckeratoms): <input id="amountToDelegate" type="number" style="width:100%;margin-bottom:20px;" min=".000001" max="${currentBalanceInTuckeratoms}" step=".000001">
        Fee (in Tuckeratoms): <input id="fee" type="number" style="width:100%;margin-bottom:20px;" min="0" step=".000001" value=".005">
        Gas: <input id="gas" type="number" style="width:100%;margin-bottom:20px;" min="0" step="1" value="50000">
        
        <button onclick="tuckwallet.finishDelegateTuckeratoms()">Delegate</button>
    `;
    
    document.getElementById('mainContent').innerHTML = html;
}

export async function finishDelegateTuckeratoms(){
    const validatorAddress = document.getElementById('validator').value;
    const tuckeratomSource = document.getElementById('source').value;
    
    const amountToDelegateInTuckeratoms = Number(document.getElementById('amountToDelegate').value);
    const amountToDelegateInMicroTuckeratoms = amountToDelegateInTuckeratoms * oneMillion;
    
    const feeInTuckeratoms = Number(document.getElementById('fee').value);
    
    if (feeInTuckeratoms < 0){
        alert("Fee can't be less than zero!");
        return;
    }
    
    const feeInMicroTuckeratoms = feeInTuckeratoms * oneMillion;  
          
    const gas = Number(document.getElementById('gas').value);    
    
    if (gas < 0){
        alert("Gas can't be less than zero!");
        return;
    }
    
    const send = confirm(`Delegating ${amountToDelegateInTuckeratoms} Tuckeratoms to ${validatorAddress} from ${tuckeratomSource}`);
    
    if (!send){
        return;
    }
    
    let tx;
    
    if (tuckeratomSource === 'undelegated'){    
        tx = {
            msg: [{                
                type: "cosmos-sdk/MsgDelegate",
                value: {
                    amount: {
                        amount: String(amountToDelegateInMicroTuckeratoms),
                        denom: denom
                    },
                    delegator_address: window.wallet.address,
                    validator_address: validatorAddress
                }                
            }],
            fee: {
                amount: [ { amount: String(feeInMicroTuckeratoms), denom: denom } ], 
                gas: String(gas) 
            },
            memo: "TuckWallet",
        }    
    }
    else{
        tx = {
            msg: [{                
                type: "cosmos-sdk/MsgBeginRedelegate",
                value: {
                    amount: {
                        amount: String(amountToDelegateInMicroTuckeratoms),
                        denom: denom
                    },
                    delegator_address: window.wallet.address,
                    validator_dst_address: validatorAddress,
                    validator_src_address: tuckeratomSource
                }                
            }],
            fee: { 
                amount: [ { amount: String(feeInMicroTuckeratoms), denom: denom } ], 
                gas: String(gas) 
            },
            memo: "TuckWallet",
        }
    }
    
    submitTransaction(tx);
}
