// --- LIBRARIES ---

import Web3 from 'web3';
import Express from 'express';
import { DidResolver } from '../adb-library/library/build/src/resolver/DidResolver.js';
import { JsonLdContextLoader } from '../adb-library/library/build/src/utils/JsonLdContextLoader.js';
import { FileContext, FileContextLoader } from '../adb-library/library/build/src/utils/FileContextLoader.js';
import { VerifiableCredentialManager } from '../adb-library/library/build/src/credential/VerifiableCredentialManager.js';
import { EcdsaSecp256k1ProofManager } from '../adb-library/library/build/src/credential/proof/ecdsa-secp256k1/EcdsaSecp256k1ProofManager.js';

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
var verifiableCredentialManager = null;
var accountList = {...AccountListStruct};
var ecdsaSecp256k1CreationOptions = null;
var signatureString = 'this is my official signature!';
var entropyString = 'abcdefghijklmnopqrstuvwxyz0123456789';

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
    web3.eth.accounts.wallet.add(newAccount.wallet);

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
    web3.eth.accounts.wallet.add(newAccount.wallet);

    newAccount.signObj = await newAccount.wallet.sign(signatureString, newAccount.wallet.privateKey);

    accountList.free.push(newAccount);
  }

  await addLog('The following account list has been correctly created: ', accountList);
}

async function deploySSI() {
  const addresses = await web3.eth.getAccounts();

  const ssiContract = new web3.eth.Contract(CHIDTRDIDSSI.abi, addresses[ssiReservedAccountIndex]);

  const ssiContractInstance = await ssiContract.deploy({
    data: CHIDTRDIDSSI.bytecode,
    arguments: []
  }).send({
    from: addresses[ssiReservedAccountIndex],
    gas: 5000000,
    gasPrice: '3000000000'
  });

  //it builds the did resolver object to interface with the contract
  didResolver = new DidResolver(web3, CHIDTRDIDSSI.abi, addresses[ssiReservedAccountIndex]);

  // accountList.reserved[ssiReservedAccountIndex].did = (await didResolver.createNewDidFromAccount(ssiAccount.wallet)).did;

  accountList.reserved[ssiReservedAccountIndex].active = true;

  console.log('CITDS param address: ', addresses[ssiReservedAccountIndex]); //TEST
  console.log('DidResolver object succesfully created!'); //TEST

  await addLog('ChainIdTrustDidSsi address: ' + addresses[ssiReservedAccountIndex], null);
  await addLog('DidResolver object succesfully created: ', didResolver);
}

async function setDefaultTestChain() {
  var firstBlock = true;
  var previousBlockAccount;
  var verifiableCredential;
  var accountDidObj;
  
  accountList.reserved.forEach(async (reservedAccount, index) => {
    if(reservedAccount.reservationId === vcReleaserReservedAccountIndex) {      
      accountDidObj = await didResolver.createNewDidFromAccount(reservedAccount.wallet);
      reservedAccount.did = accountDidObj.did;
      reservedAccount.bufferedPrivateKey = accountDidObj.privateKey;
      if(firstBlock) {
        firstBlock = false;
      } else {
        verifiableCredential = await getVerifiableCredential(previousBlockAccount, reservedAccount);

        const trustedIssuers = new Set();
        trustedIssuers.add(previousBlockAccount.did);

        console.log(verifiableCredential);
        
        var aaa = await didResolver.updateTrustCertification(verifiableCredential, trustedIssuers, fileContextLoader, `${reservedAccount.did}#auth-key-1`, reservedAccount.wallet.address);
      
        console.log(aaa);

        console.log('AAAAAAAAAA' + index);
      }

      console.log('BBBBBBBBBB' + index);
      console.log(`${reservedAccount.did}#auth-key-1`);

      reservedAccount.active = true;
      previousBlockAccount = reservedAccount;
    }
  });
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
    // credentialStatus: {
    //   id: `${parent.did}#revoc-1`,
    //   type: "RevocationList2023"
    // }
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