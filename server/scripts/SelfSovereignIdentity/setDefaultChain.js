export async function setDefaultChain(web3, ssiInstance, chainAccounts) {   
  if (chainAccounts.length > 0) {
    var parentSignature = await web3.eth.sign('VC releasers chain parent block signature!', chainAccounts[0].address).then((sign) => {
      return sign;
    });

    var parentDid = await ssiInstance.methods.createDid().send({from: chainAccounts[0].address});
    chainAccounts[0].did = parentDid;
    chainAccounts[0].signature = parentSignature;
    chainAccounts[0].active = true;

    for(let i = 1; i < chainAccounts.length; i++) {
      var childBlockDid = await ssiInstance.methods.createChildTrustedDid(chainAccounts[i].address, parentSignature).send({from: chainAccounts[i - 1].address});

      parentSignature = await web3.eth.sign('VC releasers chain parent block signature!', chainAccounts[i].address).then((sign) => {
        return sign;
      });
      
      chainAccounts[i].did = childBlockDid;
      chainAccounts[i].signature = parentSignature;
      chainAccounts[i].active = true;
    }

    return chainAccounts;
  } else {
    return [];
  }
}