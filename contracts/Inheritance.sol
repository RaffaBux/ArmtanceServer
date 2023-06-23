// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19 <0.9.0;

// Issuer è l'inheritanceOwner (msg.sender quando viene deployato il contratto)
struct Issuer {
	address issuerAddress;
}

// atm se l'utente perde la chiave privata son cazzi perché gli inculano la sua fetta di eredità
struct Heir {
	string heirDid;
	bool delegated;
	uint addressCounter;	
	mapping(uint => Account) wallet;	// uint (from 0 to addressCounter - 1) → Account (that could be active or not)
	bool active;
}

// atm ogni account con amount != 0 è attivo
struct Account {
	string accountId;	// #identifier
	address payable accountAddress;	// 0x0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ
	uint percentage;
	bool active;
}

contract Inheritance {

	Issuer private inheritanceOwner;
	
	// uint (from 0 to heirCounter - 1) → Heir (that could be active or not)
	uint heirCounter;
	mapping(uint => Heir) private heirMap; 

	constructor() {	
		inheritanceOwner = Issuer(msg.sender);
		heirCounter = 0;
	}

	// validità dei dati passati controllata fuori contratto
	// _heirDid + _accountIdentifierList[i] → _addressList[i]
	function setHeir(
		string memory _heirDid,	// did:ssi-cot-eth:chainId:xxxxxxx
		bool _delegation,
		address payable[] memory _addressList,	// 0x0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ
		string[] memory _accountIdentifierList,	// #identifier
		uint[] memory _percentageList,
		bool _heirActivation
	) public returns (bool) {
		require(msg.sender == inheritanceOwner.issuerAddress, 'The setter is not the issuer (inheritance owner)!');

		Heir storage newHeir = heirMap[heirCounter++];

		newHeir.heirDid = _heirDid;
		newHeir.delegated = _delegation;
		newHeir.addressCounter = 0;

		require(
			_addressList.length == _percentageList.length && _addressList.length == _accountIdentifierList.length,
			'Account identifiers list length and percentage list length dont match!'
		);

		for(uint i = 0; i < _accountIdentifierList.length; i++) {
			newHeir.wallet[newHeir.addressCounter++] = Account(_accountIdentifierList[i], _addressList[i], _percentageList[i], _heirActivation);
		}

		return true;
	}
	
}
