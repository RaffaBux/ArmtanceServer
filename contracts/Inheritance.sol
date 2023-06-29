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

	function getIssuer() public view returns (Issuer memory){
		return inheritanceOwner;
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

	function verifyVC(uint ownerBalance) public returns (bool) {
		// requires the issuer be from the trust chain
		// requires the owner to be dead
		bool results = false;

		require(msg.sender == inheritanceOwner.issuerAddress, 'The caller is not the inheritance owner!');

		splitInheritance(ownerBalance);

		results = true;
		return results;
	}

	function splitInheritance(uint ownerBalance) private returns (bool result) {
		Heir storage thisHeir;
		Account storage thisAccount;
		uint accountPercentage;
		uint initialOwnerBalance = ownerBalance;
		uint amount;

		result = false;

		// receiverAddress.send(amount) // from msg.sender address
		
		for(uint i = 0; i < heirCounter; i++) {
			thisHeir = heirMap[i];
			if(thisHeir.active == true) {
				for(uint j = 0; j < thisHeir.addressCounter; j++) {
					thisAccount = thisHeir.wallet[j];
					if(thisAccount.active == true) {
						accountPercentage = thisAccount.percentage;
						amount = initialOwnerBalance * accountPercentage / 100;

						thisAccount.accountAddress.transfer(amount);
					}
				}
			}
		}

		result = true;
		return result;
	}
	
}
