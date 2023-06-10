// --- LIBRARIES ---

import Web3 from 'web3';
import Express from 'express';
import { DidResolver } from '../adb-library/library/build/src/resolver/DidResolver.js';

// --- STRUCTS ---

import LogStruct from './assets/logStruct.json' assert { type: "json" };
import INHERITANCE from './artifacts/Inheritance.json' assert { type: "json" };
import AccountStruct from './assets/accountStruct.json' assert { type: "json" };
import ContractStruct from './assets/contractStruct.json' assert { type: "json" };
import CHIDTRDIDSSI from './artifacts/ChainOfTrustDidSsi.json' assert { type: "json" };
import AccountListStruct from './assets/accountListStruct.json' assert { type: "json" };

// --- SERVER ---

const port = 3015;
const app = Express();

// --- ADDRESSES ---

const numberOfVCReleasers = 3;
const numberOfFreeAccounts = 20;
const numberOfReservedAccounts = 6;

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

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));

// --- CONTRACT ---

var policyIdCounter = 0;
var inheritancePolicyList = [];

// --- VARIABLES ---

var logs = [];
var didResolver = null;
var freeAccountIdCounter = 0;
var reservedAccountIdCounter = 0;
var accountList = {...AccountListStruct};
var entropyString = 'abcdefghijklmnopqrstuvwxyz0123456789';
var signatureString = 'this is my official signature!';

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

  newInhPolicy.contract = new web3.eth.Contract(INHERITANCE.abi, inhAddress);

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

async function getDefaultAccounts() {
  var newAccount;

  for(let i = 0; i < numberOfReservedAccounts; i++) {
    newAccount = {...AccountStruct};
    newAccount.id = reservedAccountIdCounter++;
    newAccount.wallet = await web3.eth.accounts.create(entropyString);

    if(i > vcReleaserReservedAccountIndex - 1 && i < numberOfReservedAccounts) {
      newAccount.reservationId = vcReleaserReservedAccountIndex;
    } else if(i < numberOfReservedAccounts) {
      newAccount.reservationId = i;
    }

    newAccount.signObj = await newAccount.wallet.sign(signatureString, newAccount.wallet.privateKey);

    accountList.reserved.push(newAccount);
  }

  for(let i = 0; i < numberOfFreeAccounts; i++) {
    newAccount = {...AccountStruct};
    newAccount.id = freeAccountIdCounter++;
    newAccount.wallet = await web3.eth.accounts.create(entropyString);

    newAccount.signObj = await newAccount.wallet.sign(signatureString, newAccount.wallet.privateKey);

    accountList.free.push(newAccount);
  }

  await addLog('The following account list has been correctly created: ', accountList);
}

async function deploySSI() {
  var ssiAccount = accountList.reserved[ssiReservedAccountIndex];
  var ssiAddress = ssiAccount.wallet.address;

  //it builds the did resolver object to interface with the contract
  didResolver = new DidResolver(web3, CHIDTRDIDSSI.abi, ssiAddress, null);

  accountList.reserved[ssiReservedAccountIndex].did = (await didResolver.createNewDidFromAccount(ssiAccount.wallet)).did;

  accountList.reserved[ssiReservedAccountIndex].active = true;

  console.log('CITDS param address: ', ssiAddress); //TEST
  console.log('DidResolver object succesfully created!'); //TEST

  await addLog('ChainIdTrustDidSsi address: ' + ssiAccount, null);
  await addLog('DidResolver object succesfully created: ', didResolver);
}

async function setDefaultTestChain() {
  var previousBlock;
  var firstBlock = true;
  
  accountList.reserved.forEach(async (reservedAccount) => {
    if(reservedAccount.reservationId === vcReleaserReservedAccountIndex) {
      if(firstBlock) {
        // reservedAccount.signature = await web3Reserved.eth.sign('VC releasers chain parent block signature!', reservedAccount.address);
        // reservedAccount.did = await chainIdTrustDidSsi.instance.methods.createDid().send({= require(: reservedAccount.address});
        // reservedAccount.active = true;

        // VEDI RIGA 140 DIDRESOLVER.TS LIBRERIA ALESSIO

        firstBlock = false;
      } else {
        // reservedAccount.signature = await web3Reserved.eth.sign('VC releasers chain parent block signature!', reservedAccount.address);
        // reservedAccount.did = await chainIdTrustDidSsi.instance.methods.createChildTrustedDid(reservedAccount.address, previousBlock.signature).send({= require(: previousBlock.address});
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

  console.log(0);  //TEST

  await getDefaultAccounts();

  console.log(1); //TEST

  await deploySSI();

  console.log(2); //TEST

  await setDefaultTestChain();
  
  console.log(3); //TEST
});