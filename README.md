# Armtance project server side

For more info on the project check the [Armtance project repo](https://github.com/RaffaBux/Armtance).

## Recommended Node version for the project

`node v18.16.0`

## `adb-library` dependence

The server interacts with the ChainOfTrustDidSsi contract through the `adb-library` developed
by Alessio De Biasi (who also developed `ChainOfTrustDidSsi.sol`). </br>

At the moment, adb-library accepts just the contract abi and address. This way aint working on my code
so once compiled typescript files replace `DidResolver.js` from line 34 to 41 with the following:
```
constructor(web3, instance, gasLimit) {
  this.web3 = web3;
  this.contract = instance.methods;
  this.gasLimit = gasLimit;
  this.trustCredentialManager = new VerifiableCredentialManager_1.VerifiableCredentialManager(this.web3, this, new EcdsaSecp256k1ProofManager_1.EcdsaSecp256k1ProofManager(this.web3, this));
  this.chainId = 0;
}
```

## Requires Truffle

Run `npm install -g truffle` to install all the Truffle dependencies. </br>
Due to simulate a real network, a Ganache Networks needs to be available and running at:
* http://localhost:7545

## Available Scripts

In the project directory, you can run:

### `npm run ganache`

Must be executed before the serever start-up. </br>
Runs the Ganache network at [http://localhost:7545](http://localhost:7545).

### `npm run start-server`

Runs the Armtance server at [http://localhost:3015](http://localhost:3015). </br>
Access at [http://localhost:3015/logs](http://localhost:3015/logs) to check the logs.

### `npm run set-env`

Downloads all the node project dependencies.
Compiles the `adb-library` that needs to be properly configurated according to the previously described requirements.

### `npm run compileAll`

Compiles all the project Solidity contracts and generate their artifacts in `server/artifacts`.

## To dos

* Verifiable Credential verification
* Inheritance split
* Heirs update and deactivation
* Multiple addresses per did handler
* Trust chain Credential Sstatus verification
* Did identifier to address association (did:ssi-cot-eth:chainId:xxxxxxx#identifier → 0x0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ)
* Database