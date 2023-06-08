# Armtance project server side

For more info on the project check the [Armtance project repo](https://github.com/RaffaBux/Armtance).

## Recommended Node version for the project

`node v16.0.0`

## `adb-library` dependence

The server interacts with the SelfSovereignIdentity contract using the `adb-library` developed </br>
by Alessio De Biasi (who also developed the SSI contract `ChainOfTrustDidSsi.sol`).

## Requires Truffle

Run `npm install -g truffle` to install all the Truffle dependencies. </br>
Due to simulate a real network, two Ganache Networks need to be available and running at:
* http://localhost:7545
* http://localhost:8545

## Available Scripts

In the project directory, you can run:

### `npm run start-server`

Runs the Armtance server at [http://localhost:3015](http://localhost:3015). </br>
Access at to check the logs [http://localhost:3015/logs](http://localhost:3015/logs).

### `npm start`

Runs the React app in the development mode. </br>
Open [http://localhost:3010](http://localhost:3010) to view it in your browser. </br>

The page will reload when you make changes. </br>
You may also see any lint errors in the console.
