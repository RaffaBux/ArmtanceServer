// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19 <0.9.0;

// struct Degree {
// 	string degreeType;
// 	string name;
// }

// struct CredentialSubject {
// 	string id;
// 	Degree degree;
// }

struct Proof {
	string proofType;
	string creationDate;
	string verificationMethod;
	string proofPurpose;
	string proofValue;
}

struct VerifiableCredential {
	string[] context;
	string id;
	string[] credentialTypes;
	string issuer;
	string issuanceDate;
	// CredentialSubject credentialSubject;
	Proof proof;
}

// → ?? non mi ricordo di preciso chi è ç-ç
// → Issuer è l'inheritanceOwner quando viene invoato il contratto
// 		contratto la prima volta ma che succede quando 
//		inheritanceOwner muore???
struct Issuer {
	address issuerAddress;
	// string issuerDid;
	// string signature;
}

// → per il momento ogni account con amount != 0 è attivo
struct Account {
	uint accountId;
	address payable accountAddress;
	uint accountAmount;
	// bool active;
}

// → in questa maniera se l'utente perde la chiave privata
//		son cazzi perché gli inculano la sua fetta di eredità
struct Heir {
	uint heirId;
	string heirDid;
	bool delegated;
	// bool active;
	mapping(uint => Account) wallet;
}

contract Inheritance {

	VerifiableCredential private vC;
	Issuer private inheritanceOwner;
	
	// did → Heir
	mapping(string => Heir) private heirMap; 

	constructor() {	
		inheritanceOwner = Issuer(msg.sender);
	}

	function setHeir(
		uint _heirId,
		string memory _heirDid,
		bool _delegation
	) public returns (bool) {
		require(msg.sender == inheritanceOwner.issuerAddress, 'The setter is not the issuer!');

		Heir storage newHeir = heirMap[_heirDid];
		newHeir.heirId = _heirId;
		newHeir.heirDid = _heirDid;
		newHeir.delegated = _delegation;

		return true;
	}

	function setHeirAddresses(
		uint index,
		string memory _heirDid,
		uint _accountId,
		address payable _accountAddress,
		uint _accountAmount
	) public returns (bool) {
		require(msg.sender == inheritanceOwner.issuerAddress, 'The setter is not the issuer!');
		
		heirMap[_heirDid].wallet[index] = Account(_accountId, _accountAddress, _accountAmount);

		return true;
	}

	// function modifyHeir() public {}	//TODO
	
}
