import './Server.css';
import Web3 from 'web3';
import { useEffect } from 'react';

const web3Free = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
const web3Reserved = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

export default function Server() {

  return (
    <div className="main-container">
      <h3 className="centred-text">
        LOGS
      </h3>
    </div>
  );
}
