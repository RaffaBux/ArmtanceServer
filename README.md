# Armtance project server side

For more info on the project check the [Armtance project repo](https://github.com/RaffaBux/Armtance).

## Recommended Node version for the project

`node v16.0.0`

## `adb-library` dependence

The server interacts with the ChainOfTrustDidSsi contract through the `adb-library` developed
by Alessio De Biasi (who also developed `ChainOfTrustDidSsi.sol`).

## Requires Truffle

Run `npm install -g truffle` to install all the Truffle dependencies. </br>
Due to simulate a real network, a Ganache Networks needs to be available and running at:
* http://localhost:7545

## Available Scripts

In the project directory, you can run:

### `npm run start-server`

Runs the Armtance server at [http://localhost:3015](http://localhost:3015). </br>
Access at [http://localhost:3015/logs](http://localhost:3015/logs) to check the logs.

### `npm run set-env`

Downloads all the node project dependencies (except for `adb-library` that is already properly manually configurated).

### `npm run compileAll`

Compiles all the project Solidity contracts and generate their artifacts in `server/artifacts`.
