// --- LIBRARIES ---

const Web3 = require('web3');
const express = require('express');

// --- STRUCTS ---

const LogStruct = require('./assets/logStruct.json');
const AccountStruct = require('./assets/accountStruct.json');
const ContractStruct = require('./assets/contractStruct.json');
const INHERITANCE = require('./artifacts/Inheritance.json');
const CHIDTRDIDSSI = require('./artifacts/ChainOfTrustDidSsi.json');
const AccountListStruct = require('./assets/accountListStruct.json');

// --- SERVER ---

const app = express()
const port = 3015

// --- ADDRESSES ---

const vcReleasersChainLength = 3;
const numberOfReservedAddresses = 6;

// --- ADDRESSES RESERVATION ID LEGEND ---

// 0 -> SSI contract
// 1 -> INH contract
// 2 -> Inheritance owner
// 3 -> Verifiable Credential releaser
const ssiReservedAccountIndex = 0;
const inhReservedAccountIndex = 1;
const ownerReservedAccountIndex = 2;
const vcReleaserReservedAccountIndex = 3;

// --- GANACHE NETWORK ---

const web3Free = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
const web3Reserved = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

// --- CONTRACTS ---

var chainIdTrustDidSsi = {};

var policyIdCounter = 0;
var inheritancePolicyList = [];

// --- VARIABLES ---

var logs = [];
var accountList = {...AccountListStruct};

// --- USES ---

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

// --- GETS ---

app.get('/getAccounts', (req, res) => {
  res.send(accountList.free);
});

app.get('/getOwner', (req, res) => {
  accountList.reserved[ownerReservedAccountIndex].active = true;

  res.send(accountList.reserved[ownerReservedAccountIndex])
});

app.get('/logs', (req, res) => {
  res.send(logs);
});

app.post('/isINHDeployed', (req, res) => {
  var result = false;
  var policyId = req.body.policyId;

  var searchedPolicyResults = inheritancePolicyList.filter((policy) => (policy.id === policyId));
  
  if(searchedPolicyResults.length === 1 && searchedPolicyResults[0].instance !== null) {
    result = true;
  }

  res.send({
    "result": result
  });
});

app.get('/deployINH', async (req, res) => {
  var inhAccount = accountList.reserved[inhReservedAccountIndex];
  var inhAddress = inhAccount.address;

  var newInhPolicy = {...ContractStruct};
  newInhPolicy.id = policyIdCounter++;
  newInhPolicy.namecode = 'inh';

  newInhPolicy.contract = new web3Reserved.eth.Contract(INHERITANCE.abi, inhAddress);

  newInhPolicy.instance = await newInhPolicy.contract.deploy({
    data: INHERITANCE.bytecode,
    arguments: []
  }).send({
    from: accountList.reserved[ownerReservedAccountIndex].address, // ← msg.sender
    gas: 30000000,
    gasPrice: '2000000000'
  });

  newInhPolicy.active = true;

  inheritancePolicyList.push(newInhPolicy);

  accountList.reserved[inhReservedAccountIndex].active = true;

  console.log('INH param address: ', inhAddress); //TEST
  console.log('Inheritance contract deployed at: ', newInhPolicy.instance.options.address);  //TEST

  await addLog('New Inheritance policy address: ' + inhAddress, null);
  await addLog('New Inheritance policy contract deployed at: ' + newInhPolicy.instance.options.address, null);
  await addLog('New Inheritance policy correctly initialized: ', newInhPolicy);
});

app.post('/saveHeirs', (req, res) => {
  var heirList = req.body;
});

// --- FUNCTIONS ---

async function addLog(message, content) {
  var newLog = {...LogStruct};
  newLog.message = message;
  newLog.content = content;
  logs.push(newLog);
}

async function getAddresses() {
  const freeAddresses = await web3Free.eth.getAccounts();
  const reservedAddresses = await web3Reserved.eth.getAccounts();

  var newReservedAccounts = accountList.reserved;
  var newFreeAccounts = accountList.free;

  freeAddresses.forEach((thisFreeAddress, index) => {
    // it checks if this free address is already be initialized
    if(newFreeAccounts.filter((account) => (account.address === thisFreeAddress)).length < 1) {
      var newAccount = {...AccountStruct};
      newAccount.address = thisFreeAddress;
      newAccount.id = index;
      newFreeAccounts.push(newAccount);
    }
  });

  reservedAddresses.forEach((thisReservedAddress, index) => {
    // it checks if this reserved address is already be initialized
    if(newReservedAccounts.filter((account) => (account.address === thisReservedAddress)).length < 1) {
      var newAccount = {...AccountStruct};
      newAccount.address = thisReservedAddress;
      newAccount.id = index;

      // it assigns the correct reservation index
      if(index < numberOfReservedAddresses && index > vcReleaserReservedAccountIndex - 1) {
        newAccount.reservationId = vcReleaserReservedAccountIndex;
      } else if(index < numberOfReservedAddresses) {
        newAccount.reservationId = index;
      }

      newReservedAccounts.push(newAccount);
    }
  });

  var newAccountList = {...AccountListStruct};
  newAccountList.reserved = newReservedAccounts;
  newAccountList.free = newFreeAccounts; 
  accountList = newAccountList;

  await addLog('The following account list has been correctly fetched: ', accountList);
}

async function deploySSI() {
  var ssiAccount = accountList.reserved[ssiReservedAccountIndex];
  var ssiAddress = ssiAccount.address;

  var newSsiContract = {...ContractStruct};
  newSsiContract.id = 0;
  newSsiContract.namecode = 'ssi';
  
  newSsiContract.contract = new web3Reserved.eth.Contract(CHIDTRDIDSSI.abi, ssiAddress);

  newSsiContract.instance = await newSsiContract.contract.deploy({
    data: CHIDTRDIDSSI.bytecode,
    arguments: []
  }).send({
    from: ssiAddress,
    gas: 30000000,
    gasPrice: '2000000000'
  });

  newSsiContract.active = true;

  chainIdTrustDidSsi = newSsiContract;

  accountList.reserved[ssiReservedAccountIndex].active = true;

  console.log('CITDS param address: ', ssiAddress); //TEST
  console.log('CITDS contract deployed at: ', newSsiContract.instance.options.address);  //TEST

  await addLog('ChainIdTrustDidSsi address: ' + ssiAccount, null);
  await addLog('ChainIdTrustDidSsi contract deployed at: ' + newSsiContract.instance.options.address, null);
  await addLog('ChainIdTrustDidSsi correctly initialized: ', chainIdTrustDidSsi);
}

async function setDefaultTestChain() {
  var previousBlock;
  var firstBlock = true;
  
  accountList.reserved.forEach(async (reservedAccount) => {
    if(reservedAccount.reservationId === vcReleaserReservedAccountIndex) {
      if(firstBlock) {
        // reservedAccount.signature = await web3Reserved.eth.sign('VC releasers chain parent block signature!', reservedAccount.address);
        // reservedAccount.did = await chainIdTrustDidSsi.instance.methods.createDid().send({from: reservedAccount.address});
        // reservedAccount.active = true;

        // VEDI RIGA 140 DIDRESOLVER.TS LIBRERIA ALESSIO

        parentBlock = false;
      } else {
        // reservedAccount.signature = await web3Reserved.eth.sign('VC releasers chain parent block signature!', reservedAccount.address);
        // reservedAccount.did = await chainIdTrustDidSsi.instance.methods.createChildTrustedDid(reservedAccount.address, previousBlock.signature).send({from: previousBlock.address});
        // reservedAccount.active = true;
      }

      previousBlock = reservedAccount;
    }
  });
}

// --- LISTEN ---

app.listen(port, async () => {
  console.log('Armtance server is listening on port: ' + port); //TEST
  await addLog('Armtance server is listening on port: ' + port, null);

  await getAddresses();
  console.log('Addresses fetched correctly!');  //TEST

  await deploySSI();
  console.log('ChainIdTrustDidSsi contract deployed correctly!'); //TEST

  await setDefaultTestChain();
  console.log('Test Verifiable Credential chain saved correctly!'); //TEST
});