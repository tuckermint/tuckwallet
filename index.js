import { createWalletFromMnemonic, createBroadcastTx, BROADCAST_MODE_BLOCK } from '@tendermint/sig';

// -- constants --
const serverAddress = 'http://3.221.27.101'
const denom = 'utuckeratom';
const chainId = 'tuckermint-1';
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

async function getTxContext(){
    const data = await fetchFromServer(`/auth/accounts/${window.wallet.address}`);
    
    const txContext = {
        chainId: chainId,
        accountNumber: data['result']['value']['account_number'],
        sequence: data['result']['value']['sequence']
    };    
    
    console.log('txContext\n\n', JSON.stringify(txContext, null, 2), '\n');
    
    return txContext;
}

async function submitTransaction(tx){
    const waitingHtml = `<div class="lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>`;
    
    const mainContent = document.getElementById('mainContent').innerHTML;
    document.getElementById('mainContent').innerHTML = waitingHtml;
    
    let returnVal;
    
    const txContext = await getTxContext();
    
    const wrappedTx =  {
      "type": "cosmos-sdk/StdTx",
      "value": tx
    };    
    
    const signedTx = await sign(wrappedTx, txContext);

    console.log('signedTx\n\n', JSON.stringify(signedTx, null, 2), '\n');
    
    const broadcastTx = createBroadcastTx(signedTx['value'], BROADCAST_MODE_BLOCK);
    console.log('broadcastTx\n\n', JSON.stringify(broadcastTx, null, 2), '\n');     
    
    try{
        const responseData = await postToServer("/txs", broadcastTx);        
        await setBalance();
        
        alert(`Transaction result: ${JSON.stringify(responseData)}`);
        
        document.getElementById('mainContent').innerHTML = mainContent;
    }
    catch(error){
        await setBalance();
        alert(`call failed: ${JSON.stringify(error)}`);
        document.getElementById('mainContent').innerHTML = mainContent;
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
        Gas: <input id="gas" type="number" style="width:100%;margin-bottom:20px;" min="0" step="1" value="1000000">
        
        <button onclick="tuckwallet.finishSendTuckeratoms()">Send Tuckeratoms</button>
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
        memo: 'TuckWallet'        
    }       
    
    await submitTransaction(tx);

    document.getElementById('amountToSend').max = window.balances[denom] / oneMillion;
    
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

async function getDelegationArray(){
    const response = await fetchFromServer(`/staking/delegators/${window.wallet.address}/delegations`);
    const delegations = response['result'].sort((a, b) => (a['shares'] > b['shares']) ? 1 : -1);
    
    const delegationArray = [];
    
    for (const delegation of delegations){
        const address = delegation['validator_address'];
        const microTuckeratomBalance = Number(delegation['balance']['amount']);
        const tuckeratomBalance = microTuckeratomBalance / oneMillion;
        
        delegationArray.push({
                'validator_address': address,
                'balance': tuckeratomBalance
        });
    }
    
    return delegationArray;
}

async function getDelegations(validatorAddressToNameMap){
    const delegationArray = await getDelegationArray();
    
    let options = '';
    
    for (const delegation of delegationArray){
        const address = delegation['validator_address'];
        const name = validatorAddressToNameMap[address];                
        const tuckeratomBalance = delegation['balance'];
        
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
        
        Validator: <select id="validator" style="margin-bottom:20px;width:100%;">${validators}</select>
        Source of Tuckeratoms:  <select onchange="tuckwallet.updateMaxDelegationAmount()" id="source" style="width:100%;margin-bottom:20px;"><option value="undelegated">Undelegated Tuckeratoms</option>${delegations}</select>
        Amount to Delegate (in Tuckeratoms): <input id="amountToDelegate" type="number" style="width:100%;margin-bottom:20px;" min=".000001" max="${currentBalanceInTuckeratoms}" step=".000001">
        Fee (in Tuckeratoms): <input id="fee" type="number" style="width:100%;margin-bottom:20px;" min="0" step=".000001" value=".005">
        Gas: <input id="gas" type="number" style="width:100%;margin-bottom:20px;" min="0" step="1" value="1000000">
        
        <button onclick="tuckwallet.finishDelegateTuckeratoms()">Delegate Tuckeratoms</button>
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
    
    await submitTransaction(tx);
    
    const [validators, validatorAddressToNameMap] = await getValidators();
    const delegations = await getDelegations(validatorAddressToNameMap); 
    
    document.getElementById('source').innerHTML = `<option value="undelegated">Undelegated Tuckeratoms</option>${delegations}`;
    updateMaxDelegationAmount();
    
}

// withdraw rewards
async function getPendingRewards(validatorAddressToNameMap){
    const response = await fetchFromServer(`/distribution/delegators/${window.wallet.address}/rewards`);
    const rewards = response['result']['rewards'];
    
    let pendingRewards = '';
    window.currentValidators = [];
    
    for (const reward of rewards){
        const address = reward['validator_address'];
        const name = validatorAddressToNameMap[address];
        
        let microTuckeratomBalance;
        
        for (const rewardMap of reward['reward']){
            const rewardDenom = rewardMap['denom'];
            
            if (rewardDenom === denom){            
                microTuckeratomBalance = rewardMap['amount'];
                break;
            }
        }
        
        if (!microTuckeratomBalance){
            continue;
        }
        
        const tuckeratomBalance = microTuckeratomBalance / oneMillion;
        
        pendingRewards += `${name}: ${tuckeratomBalance} Tuckeratoms<br>`       
        
        window.currentValidators.push(address);
    }
    
    const totals = response['result']['total'];
    let totalRewards;
    
    for (const total of totals){
        const rewardDenom = total['denom'];
        
        if (rewardDenom === denom){
            totalRewards = total['amount'] / oneMillion;
            break;
        }
    }
    
    return [pendingRewards, totalRewards];
}    


export async function startWithdrawRewards(){
    const [_, validatorAddressToNameMap] = await getValidators();
    const [pendingRewards, totalRewards] = await getPendingRewards(validatorAddressToNameMap);
    
    const html = `
        <h2>Withdraw Staking Rewards</h2>
        
        <h3>Pending Rewards<br>(Totaling <span id="totalRewards">${totalRewards}</span> Tuckeratoms):</h3>
        <div id="pendingRewards" style="margin-bottom:20px;">${pendingRewards}<br></div>
        
        Fee (in Tuckeratoms): <input id="fee" type="number" style="width:100%;margin-bottom:20px;" min="0" step=".000001" value=".005">
        Gas: <input id="gas" type="number" style="width:100%;margin-bottom:20px;" min="0" step="1" value="1000000">
        
        <button onclick="tuckwallet.finishWithdrawRewards()">Withdraw All Rewards</button>
    `;
    
    document.getElementById('mainContent').innerHTML = html;    
}

export async function finishWithdrawRewards(){
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
    
    const msgs = [];
    
    for (const validator of window.currentValidators){
        msgs.push({
            type: "cosmos-sdk/MsgWithdrawDelegationReward",
            value: {
                delegator_address: window.wallet.address,
                validator_address: validator
            }
        })
    }
    
    const send = confirm('Withdrawing all staking rewards');
    
    if (!send){
        return;
    }    
    
    const tx = {
        msg: msgs,
        fee: { 
            amount: [ { amount: String(feeInMicroTuckeratoms), denom: denom } ], 
            gas: String(gas) 
        },
        memo: "TuckWallet",
    };    
    
    await submitTransaction(tx);    

    const [_, validatorAddressToNameMap] = await getValidators();
    const [pendingRewards, totalRewards] = await getPendingRewards(validatorAddressToNameMap);        
    document.getElementById('pendingRewards').innerHTML = pendingRewards;
    document.getElementById('totalRewards').innerHTML = totalRewards;    
}

//unstake
export function updateAmountToUnstake(){
    const validator = window.document.getElementById('validator');
    const text = validator.options[validator.selectedIndex].text;
    
    const amount = window.document.getElementById('amountToUnstake');
    amount.max = Number(text.split(': ')[1].split(' ')[0]);
}

export async function startUnstakeTuckeratoms(){
    const [_, validatorAddressToNameMap] = await getValidators();
    const delegationArray = await getDelegationArray();
    
    let options = '';
    
    for (const delegation of delegationArray){
        const address = delegation['validator_address'];
        const name = validatorAddressToNameMap[address];                
        const tuckeratomBalance = delegation['balance'];
        options += `<option value="${address}">${name} : ${tuckeratomBalance} Tuckeratoms Delegated</option>`
    }
    
    const html = `
        <h2>Unstake Tuckeratoms</h2>
        <h3>This will take 21 days!</h3>
        
        Validator: <select onchange="tuckwallet.updateAmountToUnstake()" id="validator" style="width:100%;margin-bottom:20px;">${options}</select>        
        Amount to Unstake (in Tuckeratoms): <input id="amountToUnstake" type="number" style="width:100%;margin-bottom:20px;" min=".000001" step=".000001">        
        Fee (in Tuckeratoms): <input id="fee" type="number" style="width:100%;margin-bottom:20px;" min="0" step=".000001" value=".005">
        Gas: <input id="gas" type="number" style="width:100%;margin-bottom:20px;" min="0" step="1" value="1000000">
        
        <button onclick="tuckwallet.finishUnstakeTuckeratoms()">Unstake Tuckeratoms</button>
    `;
    
    document.getElementById('mainContent').innerHTML = html; 
    updateAmountToUnstake();
}

export async function finishUnstakeTuckeratoms(){
    const validator = document.getElementById('validator').value;
    
    const amountToUnstakeInTuckeratoms = Number(document.getElementById('amountToUnstake').value);
    const amountToUnstakeInMicroTuckeratoms = amountToUnstakeInTuckeratoms * oneMillion;     
    
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
         
    const tx  = {
        msg: [
            {
                type: "cosmos-sdk/MsgUndelegate",
                value: {
                    amount: {
                        amount: String(amountToUnstakeInMicroTuckeratoms),
                        denom: denom
                    },
                    delegator_address: window.wallet.address,
                    validator_address: validator
                }
            }
        ],
        fee: { 
            amount: [ { amount: String(feeInMicroTuckeratoms), denom: denom } ], 
            gas: String(gas)
        },
        memo: "TuckWallet",
    };
    
    const send = confirm(`Unstaking ${amountToUnstakeInTuckeratoms} Tuckeratoms from ${validator}`);
    
    if (!send){
        return;
    }        
    
    await submitTransaction(tx);
    
    const [_, validatorAddressToNameMap] = await getValidators();
    const delegationArray = await getDelegationArray();
    
    let options = '';
    
    for (const delegation of delegationArray){
        const address = delegation['validator_address'];
        const name = validatorAddressToNameMap[address];                
        const tuckeratomBalance = delegation['balance'];
        options += `<option value="${address}">${name} : ${tuckeratomBalance} Tuckeratoms Delegated</option>`
    }        
    
    document.getElementById('validator').innerHTML = options;
    
}
//-------------------------------------------------------------------------------------------------------------
// Transaction signing code from https://github.com/cybercongress/cyb-snap/blob/master/index.js

const Sha256 = require('sha256');
const Secp256k1 = require('secp256k1');

async function sign(unsignedTx, txContext) {
  const bytesToSign = getBytesToSign(unsignedTx, txContext);
  const PRIV_KEY = window.wallet.privateKey;
  
  const hash = new Uint8Array(Sha256(Buffer.from(bytesToSign), {
    asBytes: true 
  }));
  const prikeyArr = PRIV_KEY;  // it's already a uint8 array, no need to call hexToBytes
  const sig = Secp256k1.ecdsaSign(hash, prikeyArr);

  return applySignature(unsignedTx, txContext, Array.from(sig.signature));
}

function getBytesToSign(tx, txContext) {
  if (typeof txContext === 'undefined') {
    throw new Error('txContext is not defined');
  }
  if (typeof txContext.chainId === 'undefined') {
    throw new Error('txContext does not contain the chainId');
  }
  if (typeof txContext.accountNumber === 'undefined') {
    throw new Error('txContext does not contain the accountNumber');
  }
  if (typeof txContext.sequence === 'undefined') {
    throw new Error('txContext does not contain the sequence value');
  }

  const txFieldsToSign = {
    account_number: txContext.accountNumber.toString(),
    chain_id: txContext.chainId,
    fee: tx.value.fee,
    memo: tx.value.memo,
    msgs: tx.value.msg,
    sequence: txContext.sequence.toString(),
  };

  return JSON.stringify(removeEmptyProperties(txFieldsToSign));
}

function removeEmptyProperties (jsonTx) {
  if (Array.isArray(jsonTx)) {
    return jsonTx.map(removeEmptyProperties)
  }

  if (typeof jsonTx !== `object`) {
    return jsonTx
  }

  const sorted = {}
  Object.keys(jsonTx)
    .sort()
    .forEach(key => {
      if (jsonTx[key] === undefined || jsonTx[key] === null) return
      sorted[key] = removeEmptyProperties(jsonTx[key])
    })
  return sorted
}

function applySignature(unsignedTx, txContext, secp256k1Sig) {
  if (typeof unsignedTx === 'undefined') {
    throw new Error('undefined unsignedTx');
  }
  if (typeof txContext === 'undefined') {
    throw new Error('undefined txContext');
  }
  if (typeof txContext.accountNumber === 'undefined') {
    throw new Error('txContext does not contain the accountNumber');
  }
  if (typeof txContext.sequence === 'undefined') {
    throw new Error('txContext does not contain the sequence value');
  }

  const tmpCopy = Object.assign({}, unsignedTx, {});

  tmpCopy.value.signatures = [
    {
      signature: Buffer.from(secp256k1Sig).toString('base64'),
      account_number: txContext.accountNumber.toString(),
      sequence: txContext.sequence.toString(),
      pub_key: {
        type: 'tendermint/PubKeySecp256k1',
        value: Buffer.from(window.wallet.publicKey).toString('base64'),
      },
    },
  ];
  return tmpCopy;
}

