// --- LIBRARIES ---

import Web3 from 'web3';
import Express from 'express';
import BodyParser from 'body-parser';
import { DidResolver } from '../adb-library/library/build/src/resolver/DidResolver.js';
import { JsonLdContextLoader } from '../adb-library/library/build/src/utils/JsonLdContextLoader.js';
import { FileContext, FileContextLoader } from '../adb-library/library/build/src/utils/FileContextLoader.js';
import { VerifiableCredentialManager } from '../adb-library/library/build/src/credential/VerifiableCredentialManager.js';
import { EcdsaSecp256k1ProofManager } from '../adb-library/library/build/src/credential/proof/ecdsa-secp256k1/EcdsaSecp256k1ProofManager.js';

// --- STRUCTS ---

import LogStruct from './assets/logStruct.json' assert { type: 'json' };
import INHERITANCE from './artifacts/Inheritance.json' assert { type: 'json' };
import AccountStruct from './assets/accountStruct.json' assert { type: 'json' };
import ContractStruct from './assets/contractStruct.json' assert { type: 'json' };
import CHIDTRDIDSSI from './artifacts/ChainOfTrustDidSsi.json' assert { type: 'json' };
import AccountListStruct from './assets/accountListStruct.json' assert { type: 'json' };
import GanacheAccounts from './assets/test/ganache-accounts.json' assert { type: 'json'};

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
var ssiContract = {...ContractStruct};

// --- VARIABLES ---

var logs = [];
var didResolver = null;
var verifiableCredentialManager = null;
var accountList = {...AccountListStruct};
var ecdsaSecp256k1CreationOptions = null;

const fileContextLoader = new FileContextLoader('./adb-library/library/context');

// --- USES ---

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

app.use(BodyParser.urlencoded({extended: true}));
app.use(BodyParser.json());

// --- GETS ---

app.get('/getAccounts', (req, res) => {
  var accountDidObj;
  
  accountList.free.forEach(async (freeAccount, index) => {
    accountDidObj = await didResolver.createNewDidFromAccount(freeAccount);
    accountList.free[index].did = accountDidObj.did;
    accountList.free[index].bufferedPrivateKey = accountDidObj.privateKey;
  });

  res.send(accountList.free);
});

app.get('/getOwner', (req, res) => {
  accountList.reserved[ownerReservedAccountIndex].active = true;

  res.send(accountList.reserved[ownerReservedAccountIndex]);
});

app.get('/logs', (req, res) => {
  res.send(logs);
});

app.post('/isINHDeployed', (req, res) => {
  var result = false;
  
  var policyId = req.body.policyIdentifier;

  var searchedPolicyResults = inheritancePolicyList.filter((policy) => (policy.id === policyId));
  
  if(searchedPolicyResults.length === 1 && searchedPolicyResults[0].instance !== null) {
    result = true;
  }

  res.send({"result": result});
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
  var policyId = req.body.policyIdentifier;
  var heirList = req.body.heirList;
  var sender = req.body.sender;

  //TEST
  for(let i = 0; i < heirList.length; i++) {
    accountList.free.forEach((freeAccount) => {
      if(freeAccount.did === heirList[i]) {
        freeAccount.active = true;
      }
    });
  }

  var result = false;
  var error = 'Nessun errore vai tra'; //TEST

  var policyFilter = inheritancePolicyList.filter((policy) => (policy.id === policyId && policy.active === true))

  if(sender.address !== accountList.reserved[ownerReservedAccountIndex].address) {
    error = 'ERRORE: Chi sta impostando gli eredi non è il proprietario della polizza d`eredità!';
  } else if(policyFilter.length !== 1) {
    error = 'ERRORE: Esistono più polizze d`eredita attive con lo stesso identificativo! SUS!';
  } 
  // else {
  //   heirList.forEach(async (heirToBeSaved) => {
  //     var addingResult = await policyFilter[0].instance.methods.saveHeir(heirToBeSaved).send({ from: sender.address });

  //     if(addingResult) {
  //       addingResultMessage = 'Erede ' + heirToBeSaved.did + ' correttamente salvato nel contratto.';
  //       result = true;
  //     } else {
  //       error = 'ERRORE inserimento: ' + heirToBeSaved.did;  
  //       console.log(error);
  //     }
  //   });
  // }

  // result? await addLog('Inserimento eredi terminato:', error) : await addLog('Inserimento eredi terminato:', error);

  console.log('son passato di qua');

  res.send({
    "result": result,
    "errorMessage": error
  });
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
  var reservedAddressIDCounter = 0;
  var freeAddressIDCounter = 0;

  for(var key in GanacheAccounts.addresses) {
    newAccount = {...AccountStruct};
    newAccount.address = GanacheAccounts.addresses[key];
    newAccount.privateKey = GanacheAccounts.private_keys[key];

    if(reservedAddressIDCounter < numberOfReservedAccounts) {
      if(reservedAddressIDCounter > vcReleaserReservedAccountIndex - 1 && reservedAddressIDCounter < numberOfReservedAccounts) {
        newAccount.reservationId = vcReleaserReservedAccountIndex;
      } else if(reservedAddressIDCounter < numberOfReservedAccounts) {
        newAccount.reservationId = reservedAddressIDCounter;
      }

      newAccount.id = reservedAddressIDCounter++;
      accountList.reserved.push(newAccount);
    } else {
      newAccount.id = freeAddressIDCounter++;
      accountList.free.push(newAccount);
    }
  }

  await addLog('The following account list has been correctly created: ', accountList);
}

async function deploySSI() {
  var ssiAddress = accountList.reserved[ssiReservedAccountIndex].address;

  ssiContract.contract = new web3.eth.Contract(CHIDTRDIDSSI.abi, ssiAddress);

  ssiContract.instance = await ssiContract.contract.deploy({
    data: CHIDTRDIDSSI.bytecode,
    arguments: []
  }).send({
    from: ssiAddress,
    gas: 5000000,
    gasPrice: '3000000000'
  });

  accountList.reserved[ssiReservedAccountIndex].active = true;


  // DidResolver.js:29
  // web3;
  // contract;
  // gasLimit;
  // trustCredentialManager;
  // chainId;
  // constructor(web3, instance, gasLimit) {
  //   this.web3 = web3;
  //   this.contract = instance.methods;
  //   this.gasLimit = gasLimit;
  //   this.trustCredentialManager = new VerifiableCredentialManager_1.VerifiableCredentialManager(this.web3, this, new EcdsaSecp256k1ProofManager_1.EcdsaSecp256k1ProofManager(this.web3, this));
  //   this.chainId = 0;
  // }

  //it builds the did resolver object to interface with the contract
  didResolver = new DidResolver(web3, CHIDTRDIDSSI.abi, ssiAddress, ssiContract.instance, 650000);
  // didResolver = new DidResolver(web3, ssiContract.instance, 650000);

  console.log('CITDS param address: ', ssiAddress); //TEST
  console.log('DidResolver object succesfully created!'); //TEST

  await addLog('ChainIdTrustDidSsi address: ' + ssiAddress, null);
  await addLog('DidResolver object succesfully created: ', didResolver);
}

function setDefaultTestChain() {
  var firstBlock = true;
 
  for(let i = 0; i < accountList.reserved.length; i++) {
    if(accountList.reserved[i].reservationId === vcReleaserReservedAccountIndex) {
      firstBlock ? firstBlock = false : buildChain(i);
    }
  }
}

async function buildChain(currentBlockIndex) {
  var accountDidObj;
  var verifiableCredential;

  if(accountList.reserved[currentBlockIndex - 1].did === null || accountList.reserved[i].bufferedPrivateKey === null || accountList.reserved[i] === false) {
    accountDidObj = await didResolver.createNewDidFromAccount(accountList.reserved[currentBlockIndex - 1]);
    accountList.reserved[currentBlockIndex - 1].did = accountDidObj.did;
    accountList.reserved[currentBlockIndex - 1].bufferedPrivateKey = accountDidObj.privateKey;
    accountList.reserved[currentBlockIndex - 1].active = true;
  }
  
  accountDidObj = await didResolver.createNewDidFromAccount(accountList.reserved[currentBlockIndex]);
  accountList.reserved[currentBlockIndex].did = accountDidObj.did;
  accountList.reserved[currentBlockIndex].bufferedPrivateKey = accountDidObj.privateKey;

  verifiableCredential = await getVerifiableCredential(accountList.reserved[currentBlockIndex - 1], accountList.reserved[currentBlockIndex]);

  const trustedIssuers = new Set();
  trustedIssuers.add(accountList.reserved[currentBlockIndex - 1].did);
  
  await didResolver.updateTrustCertification(verifiableCredential, trustedIssuers, fileContextLoader, `${accountList.reserved[currentBlockIndex].did}#auth-key-1`, accountList.reserved[currentBlockIndex].address);

  accountList.reserved[currentBlockIndex].active = true;
}

async function setVerificationEnviroment() {
  ecdsaSecp256k1CreationOptions = new EcdsaSecp256k1ProofManager(web3, didResolver);
  verifiableCredentialManager = new VerifiableCredentialManager(web3, didResolver, ecdsaSecp256k1CreationOptions);
}

async function getVerifiableCredential(parent, child) {
  return verifiableCredentialManager.createVerifiableCredential({
    additionalContexts: [
      'https://identity.foundation/EcdsaSecp256k1RecoverySignature2020/lds-ecdsa-secp256k1-recovery2020-2.0.jsonld',
      'https://www.ssicot.com/certification-credential',
      'https://www.ssicot.com/RevocationList2023'
    ],
    additionalTypes: ['CertificationCredential'],
    credentialSubject: {
      id: child.did
    },
    issuer: parent.did,
    expirationDate: new Date('2024-01-01T19:24:24Z'),
    credentialStatus: {
      id: `${parent.did}#revoc-1`,
      type: "RevocationList2023"
    }
  }, {
    chainId: await didResolver.getChainId(),
    verificationMethod: `${parent.did}#assert-key-1`,
    proofPurpose: 'assertionMethod',
    privateKey: parent.bufferedPrivateKey,
    documentLoader: JsonLdContextLoader.concatenateLoaders([
      fileContextLoader.createContextLoader(FileContext.CERTIFICATION_CREDENTIAL_LOADER),
      fileContextLoader.createContextLoader(FileContext.REVOCATION_LIST_LOADER)
    ])
  });
}

// --- LISTEN ---

app.listen(port, async () => {
  console.log('Armtance server is listening on port: ' + port); //TEST
  await addLog('Armtance server is listening on port: ' + port, null);

  console.log(0);  //TEST

  await getDefaultAccounts();

  console.log(0.1);

  await deploySSI();

  console.log(1); //TEST

  await setVerificationEnviroment();

  console.log(2); //TEST

  await setDefaultTestChain();
  
  console.log(3); //TEST
});