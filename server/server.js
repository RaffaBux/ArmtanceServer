// --- LIBRARIES ---

const express = require('express')
const Web3 = require('web3')

// --- STRUCTS ---

const LogStruct = require('./assets/logStruct.json');
const AccountStruct = require('./assets/accountStruct.json');
const AccountListStruct = require('./assets/accountListStruct.json');

// --- SERVER ---

const app = express()
const port = 3015

// --- ADDRESSES ---

const numberOfReservedAddresses = 6;
const vcReleasersChainLength = 3;

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

// --- VARIABLES ---

var accountList = {...AccountListStruct};
var logs = [];

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

app.get('/getAddresses', async (req, res) => {
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

  res.send(accountList);
})

app.get('/logs', (req, res) => {
  res.send(logs);
})

// --- FUNCTIONS ---

async function addLog(message, content) {
  var newLog = {...LogStruct};
  newLog.message = message;
  newLog.content = content;
  logs.push(newLog);
}

// --- LISTEN ---

app.listen(port, () => {
  console.log('Armtance server is listening on port ' + port);
})