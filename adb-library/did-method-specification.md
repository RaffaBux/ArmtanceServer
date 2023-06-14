# `ssi-cot-eth` DID Method Specification

This document describes how the `ssi-cot-eth` DID method works, and how to use the TypeScript
library or the smart contract to perform the CRUD operations.

Moreover, it details how to use the library to create and verify verifiable credentials and
verifiable presentations, and how to revoke verifiable credentials.

## DID method name

The name of the method is `ssi-cot-eth`.

## DID method specific identifier

The full DID consists of four parts, separated by a colon `:`:

1. `did`, as required by the W3C Decentralized Identifiers standard;
2. The method name `ssi-cot-eth`;
3. The ID of the Ethereum chain, according to the EIP-155 standard, where the smart contract is
   deployed;
4. The Ethereum address of the user, in hexadecimal and without the `0x` prefix.

The following is the ABNF of the DID:

```
DID        := "did:ssi-cot-eth:" <chain_id> ":" <user-id>
<chain_id> := {3,8}*DECDIG
<user-id>  := 40*HEXDIG
```

The DID must be a string containing only lower-cased characters. Any string containing upper-cased
characters is invalid.

Example:

```
did:ssi-cot-eth:5777:1234567890abcdef123456789abcdef123456789
```

## DID document

The following is a complete example of a DID document:

```json
{
    "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://identity.foundation/EcdsaSecp256k1RecoverySignature2020/lds-ecdsa-secp256k1-recovery2020-2.0.jsonld",
        "https://www.ssicot.com/did-document",
        "https://ssi.eecc.de/api/registry/context/credentialregistry"
    ],
    "id": "did:ssi-cot-eth:5777:1234567890abcdef123456789abcdef123456789",
    "authentication": [
        {
            "id": "did:ssi-cot-eth:5777:1234567890abcdef123456789abcdef123456789#issuer-authentication-key",
            "type": "EcdsaSecp256k1RecoveryMethod2020",
            "controller": "did:ssi-cot-eth:5777:1234567890abcdef123456789abcdef123456789",
            "blockchainAccountId": "eip155:5777:d14DaC2057Bd0BEbF442fa3C5be5b2b69bbcbe35"
        }
    ],
    "assertionMethod": [
        {
            "id": "did:ssi-cot-eth:5777:1234567890abcdef123456789abcdef123456789#vc-issuing-key",
            "type": "EcdsaSecp256k1RecoveryMethod2020",
            "controller": "did:ssi-cot-eth:5777:1234567890abcdef123456789abcdef123456789",
            "blockchainAccountId": "eip155:5777:e14D5C265fBdfB7bF442fa3C30ed1b2b69bbe1e59"
        }
    ],
    "service": [
        {
            "id": "did:ssi-cot-eth:5777:123456789abcdef123456789abcdef123456789abc#issuing-service",
            "type": "CredentialRegistry",
            "serviceEndpoint": {
                "registries": [
                    "https://www.issuer-service.com/verifier",
                    "https://www.new-issuer-service.com"
                ]
            }
        }
    ]
}
```

## CRUD operations

The CRUD operations are provided by methods of the `DidResolver` class. To execute these methods,
you need to create a new object of the `DidResolver` class, providing:

-   An instance of the `Web3` class, which will be used to interact with the blockchain;
-   The ABI of the smart contract;
-   The address of the smart contract;
-   An optional global gas limit that will be used in case no gas limit is specified when calling
    one of the methods exposed by the `DidResolver` class.

Note that many of the methods the `DidResolver` class exposes require the sender of the transaction
to authenticate. See
[Authentication and execution of CRUD operations](#authentication-and-execution-of-crud-operations)
for further details.

### Create

To create a DID, a user just needs to create a pair of public and private keys through its walled.
No interaction is then required with the blockchain.

Therefore, any user owning a pair of private and public keys also owns a DID, which will be simply
the concatenation between:

-   The string `did:ssi-cot-eth:`;
-   The ID of the Ethereum chain, according to the EIP-155 standard, where the smart contract is
    deployed;
-   A colon `:`;
-   The Ethereum address of the user, without the `0x` prefix.

The library implementing the DID resolution for the `ssi-cot-eth` DID method eases this creation of
new DIDs by providing two convenient methods:

-   `createNewDid(entropy?: string)`, which creates a new Ethereum account by using the specified
    `entropy` string to generate the private key, and then computes the DID associated with the
    newly created account;
-   `createNewDidFromAccount(account: Account)`, which computes the DID associated with the
    specified `account`.

Since the user does not interact with the blockchain, when the DID document of such user is
requested, the library will generate it on-the-fly.

The DID document will be effectively created in the storage the first time any non-read operation is
executed on the DID document.

#### Add new authentication methods, assertion methods and services

By calling the `addAuthentication`, `addAssertionMethod` and `addService` methods you can add,
respectively, a new authentication method, assertion method and service.

These methods require the sender of the transaction to authenticate, as described in
[Authentication and execution of CRUD operations](#authentication-and-execution-of-crud-operations).

#### Add a trust certification

Adding a trust certification to a DID subject adds them to a chain of trust. In this chain, the DID
subject will be the last entity of the chain, while the second-to-last entity will be the issuer of
the certification.

Any DID subject can be part of at most one chain of trust. To do so, the user first needs to obtain
a certification, which is a verifiable credential with the following structure (the parts that are
required but not relevant are condensed with `...`):

```json
{
    "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://identity.foundation/EcdsaSecp256k1RecoverySignature2020/lds-ecdsa-secp256k1-recovery2020-2.0.jsonld",
        "https://www.ssicot.com/certification-credential",
        "https://www.ssicot.com/RevocationList2023"
    ],
    "type": ["VerifiableCredential", "CertificationCredential"],
    "credentialSubject": {
        "id": "<DID of the DID subject>"
    },
    "issuer": "<DID of the issuer>",
    "issuanceDate": "...",
    "expirationDate": "...",
    "credentialStatus": {
        "id": "<Certification status URL>",
        "type": "RevocationList2023"
    },
    "proof": {
        "type": "EcdsaSecp256k1RecoverySignature2020",
        "created": "...",
        "verificationMethod": "<Issuer verification method>",
        "proofPurpose": "assertionMethod",
        "jws": "..."
    }
}
```

where:

-   `<DID of the DID subject>` is the DID of the DID subject;
-   `<DID of the issuer>` is the DID of the issuer of the trust certification;
-   `<Certification status URL>` is the DID URL that, once dereferenced, results in the status of
    the trust certification, according to the [RevocationList2023](#revocationlist2023) credential
    status type;
-   `<Issuer verification method>` is the DID URL that, once dereferenced, results in an assertion
    method that can be used to verify the validity of the trust certification.

Then, the DID subject can supply this verifiable credential to the `updateTrustCertification`
method, which will verify the credential and, only if verified, will update the DID document
accordingly.

Since the trust certification credential will be verified, the `updateTrustCertification` method
requires the specification of:

-   The set of trusted credential issuers, so to verify if the issuer of the trust certification is
    trusted by the DID subject;
-   A `FileContextLoader` that loads all the required JSON-LD context definition files from the file
    system. See [Custom JSON-LD contexts](#custom-json-ld-contexts) for further details.

The `updateTrustCertification` method require the sender of the transaction to authenticate, as
described in
[Authentication and execution of CRUD operations](#authentication-and-execution-of-crud-operations).

### Read

The following sections detail what read operations the `ssi-cot-eth` DID method can perform.

All these methods accept some options to correctly perform the read operation. In particular, all
the methods accept an object containing at least the property `accept`, which must be set to
`application/did+ld+json`, otherwise the read operation will fail with error
`representationNotSupported` ( see
[Resolution and dereferencing error](#resolution-and-dereferencing-errors) for additional details).

#### Resolve a DID document

The DID document associated with a DID can be always retrieved by using the `resolveRepresentation`
method. In case the DID document is not present in the storage (e.g., because the DID subject did
not update the DID document), then the returned document is created on-the-fly.

In case the resolution is unsuccessful, the method returns a JSON-LD object with 3 fields:

1. `didResolutionMetadata`, which is an object contains two fields:
    - `error`, which is a string identifying the error, and it can be:
        - `invalidDid` if the specified DID does not conform to the DID syntax explained in
          [DID method specific identifier](#did-method-specific-identifier);
        - Any of the errors described in
          [Resolution and dereferencing errors](#resolution-and-dereferencing-errors);
    - `errorMessage`, which contains a textual description of the error;
2. `didDocumentStream`, which contains an empty object;
3. `didDocumentMetadata`, which contains an empty object;

In case, instead, the resolution is successful, the returned JSON-LD object contains the same 3
fields, but this time:

1. `dereferencingMetadata` contains an object with a property `contentType` set to
   `application/did+ld+json`;
2. `didDocumentStream` contains the resolved DID document;
3. `didDocumentMetadata` contains an object with 3 fields:
    1. `created`, which is the date and time the DID document was created. In case the DID document
       was generated on-the-fly, the current date and time is placed in this field;
    2. `updated`, which is the date and time of the last update performed on the DID document. In
       case the DID document was generated on-the-fly, the current date and time is placed in this
       field;
    3. `deactivated`, which is a boolean value expressing whether the DID is deactivated or not.

Note that the DID document may contain one or more services. Therefore, the `resolveRepresentation`
allows for the specification of one or more `ServiceManager<S, T>` so to properly instantiate all
the `Service` objects based on the information retrieved (see [Services](#services) for further
details). This is done by setting the `serviceManagers` property of the `resolutionOptions`argument.
In case this property is not specified, and the DID document contains a service, an exception is
thrown.

Moreover, these services may require the specification of additional JSON-LD contexts, which should
be specified in the `additionalContexts` property of the `resolutionOptions` argument.

#### Resolve a DID URL

To resolve a DID URL, you can call the `resolveDidUrl` method. In case the resolution is
unsuccessful, the `resolveDidUrl` method returns a JSON-LD object with 3 fields:

1. `dereferencingMetadata`, which is an object contains two fields:
    - `error`, which is a string identifying the error, and it can be:
    - `invalidDidUrl` if the DID URL does not conform to the DID URL syntax;
    - Any of the errors described in
      [Resolution and dereferencing errors](#resolution-and-dereferencing-errors);
        - `errorMessage`, which contains a textual description of the error;
2. `contentStream`, which contains an empty object;
3. `contentMetadata`, which contains an empty object;

In case, instead, the resolution is successful, the returned JSON-LD object contains the same 3
fields as before, but this time:

1. `dereferencingMetadata` contains an object with a property `contentType` set to
   `application/did+ld+json`;
2. `contentStream` contains an object that depends on the resource identified by the DID URL (see
   below);
3. `contentMetadata` contains an object that depends on the resource identified by the DID URL (see
   below).

The content of `contentStream` and `contentMetadata` depend on the resource identified by the DID
URL. In particular, we can distinguish between 4 case:

-   If the DID URL contains no query parameter and no fragment, then the DID URL refers to a DID
    document.

    In this case `contentStream` will contain the DID document, and `contentMetadata` will contain
    the same information contained in the `didDocumentMetadata` of the object returned by the
    `resolveRepresentation` method;

-   If the DID URL contain the query parameter `service`, then the DID URL refers to a service.

    In this case, if the service is found, the `contentStream` will contain the service, and
    `contentMetadata` will contain an object with the property `resourceType` set to
    `ResourceType.SERVICE`.

    Any other query parameter will cause `resolveDidUrl` to fail with dereferencing error
    `invalidDidUrl`.

-   If the DID URL contains a fragment, the method tries to resolve the DID URL as an authentication
    or assertion method.

    If the DID URL dereference is successful, then the `contentStream` field will contain the
    information related to teh authentication or assertion method, and `contentMetadata` will
    contain an object with the property `resourceType` set to `ResourceType.AUTHENTICATION` or
    `ResourceType.ASSERTION_METHOD`.

    If, instead, the DID URL dereference is unsuccessful, then the DID URL is considered to
    reference a credential status, and it is resolved according to the
    [RevocationList2023](#revocationlist2023) credential status type specification. In particular,
    the `contentStream` field will contain the revocation status, while `contentMetadata` will
    contain an object with the property `resourceType` set to `ResourceType.CREDENTIAL_STATUS`.

    You can avoid this behaviour, hence forcing the `resolveDidUrl` method to return a
    `notFound`error if it does not resolve to an authentication or assertion method, by setting
    `omitCredentialStatus` to `true` in the `dereferenceOptions` specified when calling the method;

-   If the DID URL does not fit the previous cases, or the resource referenced by the DID URL is not
    found, then DID URL dereferencing is considered unsuccessful with `notFound` error.

Using the utility method `isDereferenceErrored` of the `DidUtils` class you can distinguish between
a successful and an unsuccessful dereference. Moreover, using the methods `isAuthentication`,
`isAssertionMethod`, `isService`, `isCredentialStatus` and `isDidDocument` offered by the same
class, you can discriminate between the different types of resources that are contained in the
`contentStream` field.

Note that the DID URL may refer to a service. In this case, the `resolveDidUrl` method requires the
specification of one or more `ServiceManager<S, T>` so to properly instantiate the `Service` object
based on the information retrieved (see [Services](#services) for further details). This is done by
setting the `serviceManagers` property of the `dereferenceOptions` argument.

If you know in advance the type of the resource referenced by the DID URL, you can directly call one
of the `resolveAuthentication`, `resolveAssertionMethod`, `resolveService` or
`resolveCredentialStatus` methods. These methods will try to resolve the DID URL as an
authentication, assertion method, service and credential status respectively and, if the DID URL
does not refer to a valid resource, the DID URL dereference will fail with the `notFound` error.

#### Resolve a chain of trust

To resolve the chain of trust a DID subject belongs to, you can call the `resolveChain` method.

In case of errors, this method will return a JSON-LD object with 3 fields:

1. `resolutionMetadata`, which is an object containing two fields:
    - `error`, which is a string identifying the error, as described in
      [Resolution and dereferencing errors](#resolution-and-dereferencing-errors);
    - `errorMessage`, which contains a textual description of the error;
2. `trustChain`, which is an empty object;
3. `chainMetadata`, which is an empty object.

In case, instead, the resolution is successful, then the returned JSON-LD object will contain the
same 3 fields, but this time:

1. `resolutionMetadata` contains an object with a property `contentType` set to
   `application/did+ld+json`;
2. `trustChain` contains a JSON-LD object with just one property, `trustChain`, which contains the
   last 10 certifications attesting the trust of the last 10 entities (excluding the DID subject)
   belonging to the chain of trust.

    Note that the certifications are inserted in the `trustChain` array starting from the root and
    moving to the last entity of the chain.

3. `chainMetadata`, which is an empty object.

#### Resolution and dereferencing errors

The DID resolution, DID URL dereferencing and chain resolution process may fail for several reasons.
The following is the list of common errors:

-   `notFound`, if the resource has not been found;
-   `representationNotSupported`, if the `accept` field of the `resolutionOptions`,
    `chainResolutionOptions` or `dereferenceOptions` parameter is not the string
    `application/did+ld+json`;
-   `methodNotSupported` if the specified DID does not belong to the `ssi-cot-eth` DID method;
-   `internalError` if an unexpected error occurs during the resolution or dereference process.

### Update

The `ssi-cot-eth` DID method allows for the modification of DID documents. The following sections
will detail what modification operations are allowed by the `ssi-cot-eth` DID method.

#### Update authentication methods, assertion methods and services

You can call the `updateAuthentication`, `updateAssertionMethod` and `updateService` methods to
update, respectively, an existing authentication method, assertion method and service.

These methods require the sender of the transaction to authenticate, as described in
[Authentication and execution of CRUD operations](#authentication-and-execution-of-crud-operations).

#### Update the trust certification

The DID subject can update the trust certification (e.g., because it is expired), by calling
`updateTrustCertification` method and supplying the new certification. See
[Add a trust certification](#add-a-trust-certification) for additional details.

### Delete (deactivate)

To delete (deactivate) a DID, you can call the `deactivate` method providing the DID to deactivate.
Note that once deactivated, the DID cannot be reactivated.

Deactivated DIDs can still be resolved to the corresponding DID documents, but no further
modification is allowed on the DID document.

This method require the sender of the transaction to authenticate, as described in
[Authentication and execution of CRUD operations](#authentication-and-execution-of-crud-operations).

The `DidResolver` class provides also the `clear` method, which will effectively delete from the
storage all the DID documents. No authentication is required to call this method. Note that this
method is dangerous, hence it should be used for development purposes only.

In production codes, the `clear` method should be manually removed from the `DidResolver` class.

### Remove authentication methods, assertion methods and services

You can call the `removeAuthentication`, `removeAssertionMethod` and `removeService` methods to
remove, respectively, an authentication method, an assertion method and a service from the DID
document associated with the sender of the transaction.

All these methods require the sender of the transaction to authenticate, as described in
[Authentication and execution of CRUD operations](#authentication-and-execution-of-crud-operations).

#### Remove a trust certification

To remove a trust certification, which effectively removes the DID subject from the chain of trust
they belong to, you can call the `removeTrustCertification` method, supplying the DID of the
subject.

This method require the sender of the transaction to authenticate, as described in
[Authentication and execution of CRUD operations](#authentication-and-execution-of-crud-operations).

#### Revoke any verifiable credential

The library allows to revoke any verifiable credential, as detailed by the
[RevocationList2023](#revocationlist2023) credential status type, by calling the
`revokeVerifiableCredential` method and supplying the DID URL specified in the `credentialStatus.id`
field of the verifiable credential to revoke.

Once a verifiable credential has been revoked, there is no way to un-revoke it.

The sender of the transaction can revoke only verifiable credentials having, in the
`credentialStatus.id` field, a DID URL that contains the DID of the sender. This avoids the sender
to revoke a verifiable credential issued by another user. Therefore, this method require the sender
of the transaction to authenticate, as described in
[Authentication and execution of CRUD operations](#authentication-and-execution-of-crud-operations).

### Authentication and execution of CRUD operations

The DID method `ssi-cot-eth` allows only the DID subject can make changes to their DID document. All
the methods provided by the library that require to authenticate the DID subject require the
specification of two arguments:

1. `senderAuthenticationMethod: string`, which is the DID URL or the authentication method to use to
   authenticate the sender of the transaction;
2. `senderAccount: string`, which is the Ethereum address of the account that will be used to send
   the transaction.

Moreover, all the methods interacting with the blockchain allow to specify the gas limit by using
the `gasLimit` parameter. If omitted, the gas limit used will be the one provided during the
construction of the `DidResolver` object or, if not specified, the gas limit used will be the
default gas limit set by the web3.js library.

### Services

DID documents may contain services. However, different types of services may require different
information. To accomodate this need, the library provides the `ServiceManager<S, T>` interface. Any
class implementing this interface is able to handle services with type `T` and that are described by
the TypeScript type `S`.

In particular, any must provide a definition of the following three methods:

1. `canHandleType(serviceType: string)`, which returns a boolean value specifying whether the
   `ServiceManager` can handle services with the specified `serviceType`;
2. `stringifyEndpoint(service: S)`, which takes in input an object of type `S` describing the
   service, and returns in output a string that serializes the endpoint of the service, together
   with any other information related to the service (except for its type and DID URL);
3. `parseEndpoint(serviceId: string, serviceType: T, serviceEndpoint: string )`, which takes the DID
   URL of the service, the type `T` of the service, and all the information serialized by the
   `stringifyEndpoint` method, and returns the JavaScript object of type `S` containing all the
   information related to the service (included the DID URL, its type, and the JSON-LD context).

The library provides the `CredentialRegistryService` interface and the
`CredentialRegistryServiceManager` class to manage services with type `CredentialRegistry`.

### Custom JSON-LD contexts

Services, verifiable credentials and verifiable presentations may require the use of custom JSON-LD
contexts.

The library allows to properly resolve custom JSON-LD contexts URLs without requiring you to deploy
the context definitions on a web server.

To do so, you need to provide a custom `DocumentLoader`, which is just a function that takes in
input the URL of the context to resolve, and returns in output an object containing three fields:

1. `contextUrl`, which should be set to `undefined`;
2. `document`, which is a JavaScript object expressing the JSON-LD context definition;
3. `documentUrl`, which is a string containing the URL of the resolved context.

Typically, you want to resolve multiple custom JSON-LD contexts. To do so, the library creates a
chain of `DocumentLoader`s where, if a `DocumentLoader` is not able to resolve a specific context,
the next one in the chain is called.

Each element of this chain is described by the `ChainableContextLoader` type, which is just a
function that takes in input the next `DocumentLoader` in the chain, and returns a `DocumentLoader`
resolving a specific context. If the `DocumentLoader` cannot resolve the specified URL, it should
call the next `DocumentLoader`in the chain. Therefore, a typical `ChainableContextLoader` has the
following structure:

```typescript
const loader: ChainableContextLoader = (nextLoader: DocumentLoader) => {
    // nextLoader is the next DocumentLoader in the chain
    return async (url: Url) => {
        if (url === "specific-json-ld-context-url") {
            return {
                contextUrl: undefined,
                document: {
                    // JSON-LD context definition
                },
                documentUrl: url
            };
        }
        // Call the next DocumentLoader in the chain so to try to resolve the JSON-LD context
        return nextLoader(url);
    };
};
```

You can then create the chain of `DocumentLoader`s by calling the
`JsonLdContextLoader.concatenateLoaders` static method providing, in order, all the
`DocumentLoader`s belonging to the chain, each of which resolving a specific JSON-LD context.

`JsonLdContextLoader.concatenateLoaders` allows to separately specify of the last `DocumentLoader`of
the chain, which is a `DocumentLoader` that does not call a next `DocumentLoader`. By default, to
correctly resolve non-custom contexts, the library uses the default `node()` `DocumentLoader` (which
can be retrieved though the `JsonLdContextLoader.DEFAULT_DOCUMENT_LOADER` constant). However, you
can override this last `DocumentLoader` by providing a new `DocumentLoader` as the
`lastDocumentLoader` argument in the call to the `JsonLdContextLoader.concatenateLoaders` static
method.

The library provides custom `DocumentLoader`s for the following JSON-LD contexts:

-   https://www.ssicot.com/did-document
-   https://www.ssicot.com/chain-resolution
-   https://www.ssicot.com/certification-credential
-   https://www.ssicot.com/did-resolution
-   https://www.ssicot.com/RevocationList2023

You can retrieve these `DocumentLoader`s by creating a new object of the `FileContextLoader`,
specifying the path of the directory containing the JSON-LD context definition files. Then, you can
retrieve the `DocumentLoader` by calling the `createContextLoader` method specifying one of the
constants of the `FileContext` enumeration, each of which identifies one of the aforementioned
JSON-LD contexts.

If you need to obtain the URLs of the JSON-LD contexts provided by the library, you can use one of
the constants of the `DidResolver` class.

## Low-level APIs through the smart contract

The library, which acts as a DID resolver for the `ssi-cot-eth` DID method, is just a wrapper around
the functionalities offered by the `ChainOfTrustDidSsi` smart contract.

In case the library does not fit your needs, it is possible to directly interact with the smart
contract. The [Smart contract methods](#smart-contract-methods) section details the functionalities
exposed by the smart contract.

### Authentication

Several methods exposed by the smart contract require the sender of the transaction to authenticate.
Indeed, only the DID subject can perform any modification to its DID document, and the smart
contract enforces this by authenticating the sender of the transaction.

In particular, the sender specifies the authentication method to use to perform the authentication
through a DID URL, which is specified using two parameters:

1. `senderDid`, which is the DID part of the DID URL;
2. `senderAuthFragment`, which is the fragment part of the DID URL, without the sharp `#` character.

The sender of the transaction is authenticated only if the DID URL resolves to an authentication
method containing, in the `blockchainAccountId` property, the address of the sender.

For example, if the sender of the transaction wants to use the authentication method referred by the
DID URL `did:ssi-cot-eth:5777:ebfeb1f712ebcdef12345678bc6f1c276e12ec21#my-authentication-method`,
then:

1. `senderDid` will be the string `did:ssi-cot-eth:5777:ebfeb1f712ebcdef12345678bc6f1c276e12ec21`;
2. `senderAuthFragment` will be the string `my-authentication-method`

The sender of the transaction is authenticated only if the DID URL
`did:ssi-cot-eth:5777:ebfeb1f712ebcdef12345678bc6f1c276e12ec21#my-authentication-method`resolves to
the following authentication method:

```json
{
    "id": "did:ssi-cot-eth:5777:ebfeb1f712ebcdef12345678bc6f1c276e12ec21#my-authentication-method",
    "type": "EcdsaSecp256k1RecoveryMethod2020",
    "controller": "<any DID>",
    "blockchainAccountId": "eip155:5777:<address of the sender>"
}
```

### Smart contract methods

This section describes the methods exposed by the `ChainOfTrustDidSsi` smart contract.

#### `updateTrustCertification`

```solidity
function updateTrustCertification(
    string calldata senderDid,
    string calldata senderAuthFragment,
    CertificationCredential calldata certificationCredential
)
```

Adds or updates the trust certification of the DID `senderDid`.

The `certificationCredential` parameter specifies:

-   `issuer` is the DID of the issuer of the credential;
-   `issuanceTimestamp` is the date and time the credential was issued, specified as the number of
    seconds from January 1<sup>st</sup>, 1970, 00:00:00 UTC;
-   `expirationTimestamp` is the date and time the credential will expire, specified as the number
    of seconds from January 1<sup>st</sup>, 1970, 00:00:00 UTC. After this date, the certification
    is not considered valid anymore;
-   `credentialStatusFragment`: the fragment part, without the sharp `#` character, of the DID URL
    that resolves to the status of the specified credential. See
    [RevocationList2023](#revocationlist2023) for further details;
-   `proof`: the integrity proof of the verifiable credential. In particular:
    -   `jwsSignatureR` are the first 32 bytes of ECDSA secp256k1 the signature;
    -   `jwsSignatureS` are the last 32 bytes of ECDSA secp256k1 the signature;
    -   `jwsSignatureV` is the recovery byte;
    -   `createdTimestamp` is the date and time the proof was created, specified as the number of
        seconds from January 1<sup>st</sup>, 1970, 00:00:00 UTC;
    -   `issuerAssertionMethodFragment` is the fragment part, without the sharp `#` character, of
        the DID URL that resolves to the assertion method containing all the information required to
        validate the proof, i.e., the Ethereum address.

This method requires the sender of the transaction to authenticate ( see
[Authentication](#authentication)).

#### `addVerificationMethod`

```solidity
function addVerificationMethod(
    string calldata senderDid,
    string calldata senderAuthFragment,
    string memory methodDidUrlFragment,
    VerificationMethodType methodType,
    address blockchainAccount
)
```

Adds a new authentication or assertion method to the DID `senderDid`. In particular:

-   `methodDidUrlFragment` is the fragment part, without the sharp `#` character, of the DID URL
    identifying the new verification method. Therefore, the newly created verification method will
    be identified by the following DID URL:
    ```
    <senderDid>#<methodDidUrlFragment>
    ```
-   `methodType` specifies the type of the verification method, namely
    `VerificationMethodType.Authentication` for an authentication method or
    `VerificationMethodType.AssertionMethod` for an assertion method;
-   `blockchainAccount` specifies the address of the user that can use the newly added verification
    method to authenticate or to issue verifiable credentials.

This method requires the sender of the transaction to authenticate ( see
[Authentication](#authentication)).

#### `addService`

```solidity
function addService(
    string calldata senderDid,
    string calldata senderAuthFragment,
    string calldata serviceDidUrlFragment,
    string memory serviceType,
    string memory endpoint
)
```

Adds a new service for the DID `senderDid`. In particular:

-   `serviceDidUrlFragment` is the fragment part, without the sharp `#` character, of the DID URL
    identifying the new service. Therefore, the newly created service will be identified by the
    following DID URL:
    ```
    <senderDid>#<serviceDidUrlFragment>
    ```
-   `serviceType` is the type of the new service;
-   `endpoint` is the endpoint of the service. In case the endpoint is not just a plain string, it
    is responsibility of the caller to encode the endpoint as a string, so to then decode it when
    using the result produced by the `resolve` or `resolveService` methods.

This method requires the sender of the transaction to authenticate ( see
[Authentication](#authentication)).

#### `updateVerificationMethod`

```solidity
function updateVerificationMethod(
    string calldata senderDid,
    string calldata senderAuthFragment,
    string memory methodDidUrlFragment,
    VerificationMethodType methodType,
    address blockchainAccount
)
```

Updates an existing authentication or assertion method associated with the DID `senderDid`. In
particular:

-   `methodDidUrlFragment` is the fragment part, without the sharp `#` character, of the DID URL
    identifying the verification method to update. Therefore, the verification method to update will
    be identified by the following DID URL:
    ```
    <senderDid>#<methodDidUrlFragment>
    ```
-   `methodType` specifies the type of the verification method, namely
    `VerificationMethodType.Authentication` for an authentication method or
    `VerificationMethodType.AssertionMethod` for an assertion method. This parameter avoids
    accidentally modifying an authentication method in place of an assertion one, and vice versa;
-   `blockchainAccount` specifies the new address that will be associated with the verification
    method.

This method requires the sender of the transaction to authenticate ( see
[Authentication](#authentication)).

#### `updateService`

```solidity
function updateService(
    string calldata senderDid,
    string calldata senderAuthFragment,
    string calldata serviceDidUrlFragment,
    string memory serviceType,
    string memory endpoint
)
```

Updates an existing service associated with the DID `senderDid`. In particular:

-   `serviceDidUrlFragment` is the fragment part, without the sharp `#` character, of the DID URL
    identifying the service to update. Therefore, the service to update will be identified by the
    following DID URL:
    ```
    <senderDid>#<serviceDidUrlFragment>
    ```
-   `serviceType` is the new type of the service;
-   `endpoint` is the new endpoint of the service. In case the endpoint is not just a plain string,
    it is responsibility of the caller to encode the endpoint as a string, so to then decode it when
    using the result produced by the `resolve` or `resolveService` methods.

This method requires the sender of the transaction to authenticate ( see
[Authentication](#authentication)).

#### `removeVerificationMethod`

```solidity
function removeVerificationMethod(
    string calldata senderDid,
    string calldata senderAuthFragment,
    string memory verificationMethodFragment,
    VerificationMethodType methodType
)
```

Removes an existing authentication or assertion method associated with the DID `senderDid`. In
particular:

-   `methodDidUrlFragment` is the fragment part, without the sharp `#` character, of the DID URL
    identifying the verification method to remove. Therefore, the verification method to remove will
    be identified by the following DID URL:
    ```
    <senderDid>#<methodDidUrlFragment>
    ```
-   `methodType` specifies the type of the verification method, namely
    `VerificationMethodType.Authentication` for an authentication method or
    `VerificationMethodType.AssertionMethod` for an assertion method. This parameter avoids
    accidentally removing an authentication method in place of an assertion one, and vice versa.

This method requires the sender of the transaction to authenticate ( see
[Authentication](#authentication)).

#### `removeService`

```solidity
function removeService(
    string calldata senderDid,
    string calldata senderAuthFragment,
    string calldata serviceDidUrlFragment
)
```

Removes an existing service associated with the DID `senderDid`. In particular:

-   `serviceDidUrlFragment` is the fragment part, without the sharp `#` character, of the DID URL
    identifying the service to remove. Therefore, the service to remove will be identified by the
    following DID URL:
    ```
    <senderDid>#<serviceDidUrlFragment>
    ```

This method requires the sender of the transaction to authenticate ( see
[Authentication](#authentication)).

#### revokeVerifiableCredential

```solidity
function revokeVerifiableCredential(
    string calldata senderDid,
    string calldata senderAuthFragment,
    string memory credentialStatusFragment
)
```

Revokes the verifiable credential having `<senderDid>#<credentialStatusFragment>` in the `id` field
of the `credentialStatus` object. Once the verifiable credential has been revoked, it is not
possible to un-revoke it.

This method should be used only if the credential status type is `RevocationList2023` ( see
[RevocationList2023](#revocationlist2023) for further details).

Moreover, this method requires the sender of the transaction to authenticate ( see
[Authentication](#authentication)).

####

```solidity
function deactivate(string calldata senderDid, string calldata senderAuthFragment)
```

Deactivates the DID `senderDid`. Once deactivated, the DID document associated to the `senderDid`can
still be resolved (i.e., all the information inside it can still be retrieved), but no additional
modifications are allowed. Moreover, the user cannot use anymore any of the authentication methods
to authenticate or any of the assertion methods to issue verifiable credentials

Note that, once deactivated, the DID cannot be reactivated.

This method requires the sender of the transaction to authenticate ( see
[Authentication](#authentication)).

#### `resolve`

```solidity
function resolve(string memory did) public view returns (ResolvedDidDocument memory)
```

Resolves the DID document associated with the specified `did`. The returned `ResolvedDidDocument`
struct contains the following fields:

-   `deactivated`, which indicates whether the specified `did` has been deactivated;
-   `createdTimestamp`, which indicates the date and time the DID document has been created. The
    timestamp is represented as the number of seconds from January 1<sup>st</sup>, 1970, 00:00:00
    UTC. Note that if the DID document has not been not created, this timestamp is 0;
-   `updatedTimestamp`, which indicates the date and time of the last modification to the DID
    document. The timestamp is represented as the number of seconds from January 1<sup>st</sup>,
    1970, 00:00:00 UTC. Note that if the DID document has not been not created, this timestamp is 0;
-   `verificationMethods`, which is the list of authentication and assertion methods associated with
    the specified `did`;
-   `services`, which is the list of services associated with the specified `did`;
-   `certification`, which is the trust certification associated with the specified `did`. If the
    specified `did` is not part of a chain of trust, then this struct contains the value `false` in
    the field `valid`. Otherwise, the field `valid` contains the value `true`;
-   `certificationStatus`, which is the status of the trust certification. Refer to the description
    of the `statuses` field of the `ResolvedTrustChain` struct returned by the
    [resolveChain](#resolvechain) method for a description of the value of this field. Note that, if
    the specified `did` is not part of a chain of trust, then this value is useless.

#### `resolveChain`

```solidity
function resolveChain(string memory did) public view returns (ResolvedTrustChain memory)
```

Resolve the trust certifications in the chain of trust having the specified `did` as the last node
of the chain. In particular, the returned `ResolvedTrustChain` struct contains two arrays:

-   `certifications`, which contains the last 10 certifications in the chain of trust ending with
    the specified `did`. Refer to the description of the `certificationCredential` parameter of the
    [updateTrustCertification](#updatetrustcertification) method for a description of the meaning of
    each field of the returned struct.

    Note that the list of certifications is reversed, i.e., the certification issued by root of the
    chain of trust is the last element in this array.

    Moreover, if the chain of trust contains _c_ certifications, with _c_ < 10, then this array
    still contains 10 elements, where the first `c` ones have the `valid` field set to `true`, while
    the following 10- _c_ have the `valid` field set to `false`;

-   `statuses` which contains, for each element _i_, the status of the _i_-th valid certification in
    the `certification` array, where:

    -   `TrustCertificationStatus.Revoked` indicates that the certification has been revoked by the
        issuer;

    -   `TrustCertificationStatus.Deactivated` indicates that the DID of the issuer of the
        certification has been deactivated;
    -   `TrustCertificationStatus.Valid`, indicates that neither of the previous conditions are met.

    Note that this status is returned even if the certification is expired. It is responsibility of
    the caller to check whether the certification is expired or not, and act consequently.

If the specified `did` is not part of a chain of trust, then the `certifications` array contains 10
certifications with the `valid` field set to `false`.

If the chain of trust contains more than 10 certifications, you can reconstruct the entire chain by
iteratively calling this method specifying every time the DID of the last element of the
previously-returned chain.

#### `resolveVerificationMethod`

```solidity
function resolveVerificationMethod(
    string calldata methodDid,
    string calldata methodDidUrlFragment
) public view returns (VerificationMethod memory)
```

Returns the information associated with the verification method identified by the DID URL
`<methodDid>#<methodDidUrlFragment>`.

Note that, if the verification method has not been found, the `valid` field of the returned
`VerificationMethod` struct is set to `false`. Otherwise, if the DID URL identifies an existing
verification method, the `valid` field is set to `true`.

Moreover, it is responsibility of the caller to check the type of the returned `VerificationMethod`
so to avoid using an assertion method to authenticate the user, or using an authentication method to
verify assertions (like verifiable credentials) issued by the user.

#### `resolveService`

```solidity
function resolveService(
    string calldata serviceDid,
    string calldata serviceFragment
) public view returns (Service memory)
```

Returns the information related to the service identified by the DID URL
`<serviceDid>#<serviceFragment>`.

Note that, if the service has not been found, the `valid` field of the returned `Service` struct is
set to `false`. Otherwise, if the DID URL identifies an existing service, the `valid` field is set
to `true`.

#### resolveCredentialStatus

```solidity
function resolveCredentialStatus(
    string calldata credentialDid,
    string calldata credentialFragment
) public view returns (bool)
```

Returns whether the verifiable credential, having the DID URL `<credentialDid>#<credentialFragment>`
in the `id` field of the `credentialStatus` object, has been revoked or not. In particular, this
method returns `true` is the verifiable credential has been revoked, `false` otherwise.

This method should be used only if the credential status type is `RevocationList2023` (see
[RevocationList2023](#revocationlist2023)).

#### `clear`

```solidity
function clear()
```

Removes all the DID documents stored in the smart contract. This method should be used for
development purposes only.

In production codes, this method should be removed from the smart contract.

### Verifiable credentials and verifiable presentations

The library provides two convenient interfaces to represent verifiable credentials and verifiable
presentations, namely the `VerifiableCredential<T, P>` and `VerifiablePresentation<P>` interfaces.

Both interfaces are generic on the type of the proof, so to uniformly use verifiable credentials and
verifiable presentation using different proofs. In addition, the `VerifiableCredential<T, P>`
interface is generic on the type `T` of the claims contained into the credential.

The library also provides two additional classes, namely `VerifiableCredentialManager<P, C, V, M>`
and `VerifiablePresentationManager<P, C, V, M>`, to create and verify verifiable credentials and
verifiable presentations respectively.

These two classes are generic on:

-   The type `P` of the proof. Any object conforming to the `Proof` interface can be used as proof
    for the verifiable credentials and verifiable presentations;
-   The type `M` of the class generating proofs of type `P`. Any class implementing the
    `CredentialProofManager<P,C,V>` can be used to generate and verify proofs for verifiable
    credentials, while any class implementing the `PresentationProofManager<P,C,V>` can be used to
    generate and verify proofs for verifiable presentations;
-   The type `C` of the options needed by the `CredentialProofManager<P,C,V>` or
    `PresentationProofManager<P,C,V>` to create a valid proof. This type depends on the chosen
    `CredentialProofManager<P,C,V>` or `PresentationProofManager<P,C,V>`;
-   The type `C` of the options needed by the `CredentialProofManager<P,C,V>` or
    `PresentationProofManager<P,C,V>` to create a valid proof. This type depends on the chosen
    `CredentialProofManager<P,C,V>` or `PresentationProofManager<P,C,V>`;

#### JSON-LD contexts

To properly resolve terms into IRIs, and therefore to properly canonicalize a verifiable credential
or verifiable presentation so to compute the final digital signature, it is required to properly
specify the JSON-LD contexts.

However, the library does not require you to public the context definitions on a publicly-available
server. Indeed, you can specify custom contexts in two different ways:

1. Include the context definitions directly in the `@context` field of the verifiable credential or
   verifiable presentation;
2. Provide one or more custom JSON-LD document loader, as described in
   [Custom JSON-LD contexts](#custom-json-ld-contexts).

#### ECDSA secp256k1 signature

The library provides the class `EcdsaSecp256k1ProofManager` that contains an implementation for
generating and verifying proofs conforming to the `EcdsaSecp256k1RecoverySignature2020` data
integrity proof standard. This class can be used with both the
`VerifiableCredentialManager<P, C, V, M>` and the `VerifiablePresentationManager<P, C, V, M>`,
specifying the following types for the generic parameters:

-   `EcdsaSecp256k1Proof` as the generic parameter `P`;
-   `EcdsaSecp256k1CreationOptions` as the generic parameter `C`;
-   `EcdsaSecp256k1VerificationOptions` as the generic parameter `V`;
-   `EcdsaSecp256k1ProofManager` as the generic parameter `M`.

Therefore, a `VerifiableCredentialManager<P, C, V, M>` generating and verifying proofs conforming to
the `EcdsaSecp256k1RecoverySignature2020` standard should be created as follows:

```typescript
// const web3 = new Web3(...);
// const resolver = new DidResolver(...);
// const proofManager = new EcdsaSecp256k1ProofManager(...);
const credentialManager = new VerifiableCredentialManager<
    EcdsaSecp256k1Proof,
    EcdsaSecp256k1CreationOptions,
    EcdsaSecp256k1VerificationOptions,
    EcdsaSecp256k1ProofManager
>(web3, resolver, proofManager);
```

while a `VerifiablePresentationManager<P, C, V, M>` generating and verifying proofs conforming to
the `EcdsaSecp256k1RecoverySignature2020` standard should be created as follows:

```typescript
// const web3 = new Web3(...);
// const resolver = new DidResolver(...);
// const proofManager = new EcdsaSecp256k1ProofManager(...);
const credentialManager = new VerifiablePresentationManager<
    EcdsaSecp256k1Proof,
    EcdsaSecp256k1CreationOptions,
    EcdsaSecp256k1VerificationOptions,
    EcdsaSecp256k1ProofManager
>(web3, resolver, proofManager);
```

If you need to directly work with the JWS contained in a proof conforming to the
`EcdsaSecp256k1RecoverySignature2020` standard, you can use the `JwsManager` class, which provides
methods to encode, decode and verify JWSs.

## RevocationList2023

This type of credential status allows to discover if a verifiable credential has been revoked or
not. In particular, the credential status ID is a DID URL that, once dereferenced, results in the
following JSON-LD object if the credential is revoked;

```json
{
    "@context": ["https://www.ssicot.com/RevocationList2023/"],
    "revoked": true
}
```

while it results in the following JSON-LD object if the credential has not been revoked (hence, it
is valid):

```json
{
    "@context": ["https://www.ssicot.com/RevocationList2023/"],
    "revoked": false
}
```

If used within a verifiable credential in the `credentialStatus` field, the value `type` field must
be `RevocationList2023`, and the verifiable credential must include the JSON-LD context
`https://www.ssicot.com/RevocationList2023/`.

For example, given the following verifiable credential (non-relevant parts omitted):

```json5
{
    "@context": [
        "https://www.w3.org/2018/credentials/v1",
        // ...
        "https://www.ssicot.com/RevocationList2023"
        // ...
    ],
    // ...
    credentialStatus: {
        id: "did:ssi-cot-eth:5777:ebfeb1f712ebcdef12345678bc6f1c276e12ec21#revoc-57",
        type: "RevocationList2023"
    }
    // ...
}
```

dereferencing the DID URL `did:ssi-cot-eth:5777:ebfeb1f712ebcdef12345678bc6f1c276e12ec21#revoc-57`
will result in one of the two JSON-lD objects described above, stating whether the verifiable
credential has been revoked or if it is valid.
