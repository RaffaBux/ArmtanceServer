import BN from "bn.js";
import {AbiItem, PromiEvent, TransactionReceipt} from "ethereum-abi-types-generator";
import {ContextDefinition, LanguageMap} from "jsonld/jsonld";
import Web3 from "web3";
import {Account} from "web3-core";
import {
    CertificationCredentialRequest,
    CertificationResponse,
    ChainOfTrustDidSsi,
    ContractContext,
    MethodConstantReturnContext,
    MethodReturnContext,
    ProofRequest,
    SendOptions,
    ServiceResponse,
    VerificationmethodResponse
} from "../../types/ChainOfTrustDidSsi";
import {EcdsaSecp256k1Proof} from "../credential/proof/ecdsa-secp256k1/EcdsaSecp256k1Proof";
import {
    EcdsaSecp256k1CreationOptions,
    EcdsaSecp256k1ProofManager,
    EcdsaSecp256k1VerificationOptions
} from "../credential/proof/ecdsa-secp256k1/EcdsaSecp256k1ProofManager";
import {CredentialStatus, VerifiableCredential} from "../credential/VerifiableCredential";
import {VerifiableCredentialManager} from "../credential/VerifiableCredentialManager";
import {DateUtils} from "../utils/DateUtils";
import {FileContext, FileContextLoader} from "../utils/FileContextLoader";
import {InvalidArgumentError} from "../utils/InvalidArgumentError";
import {JsonLdContextLoader} from "../utils/JsonLdContextLoader";
import {WithContext} from "../utils/JsonLdTypes";
import {
    AssertionMethodDereferenceResult,
    AuthenticationDereferenceResult,
    ChainResolutionOptions,
    ChainResolutionResult,
    CredentialStatusDereferenceResult,
    DereferenceOptions,
    DereferenceResult,
    DidDocumentMetadata,
    DidResolutionResult,
    DidUrlDereferenceOptions,
    DidUrlDereferenceResult,
    ErrorChainResolutionResult,
    ErrorDereferenceResult,
    ErrorResolutionResult,
    Errors,
    ResolutionOptions,
    ResourceType,
    ServiceDereferenceOptions,
    ServiceDereferenceResult,
    SuccessfulChainResolutionResult,
    SuccessfulMetadata
} from "./DidResolutionTypes";
import {
    DidDocument,
    DidUrl,
    RevocationStatus,
    TrustCertification,
    TrustCertificationStatus,
    VerificationMethod
} from "./DidTypes";
import {DidUtils} from "./DidUtils";
import {InvalidTrustCertification} from "./InvalidTrustCertification";
import {Service, ServiceManager} from "./ServiceTypes";

enum VerificationMethodType {
    AUTHENTICATION,
    ASSERTION_METHOD
}

type ExecutionResult<T, E> =
    | {
          error: true;
          result: E;
      }
    | {error: false; result: T};

type ParameterCheckResult<T> =
    | {
          error: true;
          result: T;
      }
    | {error: false};

export interface TrustCredentialSubject extends LanguageMap {
    id: string;
}

export type TrustCredential = Required<
    Omit<VerifiableCredential<TrustCredentialSubject, EcdsaSecp256k1Proof>, "id">
>;

export type TrustCredentialManager = VerifiableCredentialManager<
    EcdsaSecp256k1Proof,
    EcdsaSecp256k1CreationOptions,
    EcdsaSecp256k1VerificationOptions,
    EcdsaSecp256k1ProofManager
>;

export interface DidContainer {
    did: string;
    address: string;
    privateKey: Buffer;
    account: Account;
}

export class DidResolver {
    public static readonly DID_DOCUMENT_CONTEXT = "https://www.w3.org/ns/did/v1";
    public static readonly ECDSA_SECP256K1_RECOVERY_2020_CONTEXT =
        "https://identity.foundation/EcdsaSecp256k1RecoverySignature2020/lds-ecdsa-secp256k1-recovery2020-2.0.jsonld";
    public static readonly SSI_COT_DID_DOCUMENT_CONTEXT = "https://www.ssicot.com/did-document";
    public static readonly SSI_COT_CHAIN_RESOLUTION_CONTEXT =
        "https://www.ssicot.com/chain-resolution";
    public static readonly REVOCATION_LIST_2023_CONTEXT =
        "https://www.ssicot.com/RevocationList2023/";
    public static readonly RESOLUTION_CONTEXT = "https://w3id.org/did-resolution/v1";
    public static readonly RESOLUTION_ERROR_MESSAGE_CONTEXT =
        "https://www.ssicot.com/did-resolution";

    private web3: Web3;
    private contract: ChainOfTrustDidSsi;
    private readonly gasLimit: number | undefined;
    private trustCredentialManager: TrustCredentialManager;
    private chainId: number;

    constructor(web3: Web3, contractAbi: AbiItem[], contractAddress: string, gasLimit?: number) {
        this.web3 = web3;
        this.contract = (
            new web3.eth.Contract(contractAbi, contractAddress) as unknown as ContractContext
        ).methods;
        this.gasLimit = gasLimit;
        this.trustCredentialManager = new VerifiableCredentialManager(
            this.web3,
            this,
            new EcdsaSecp256k1ProofManager(this.web3, this)
        );
        this.chainId = 0;
    }

    public async createNewDid(entropy?: string): Promise<DidContainer> {
        const creationResult = this.web3.eth.accounts.create(entropy);

        return this.createNewDidFromAccount(creationResult);
    }

    public async createNewDidFromAccount(account: Account): Promise<DidContainer> {
        const did = `did:ssi-cot-eth:${await this.getChainId()}:${account.address
            .slice(2)
            .toLowerCase()}`;

        return {
            did,
            address: account.address,
            privateKey: Buffer.from(account.privateKey.slice(2), "hex"),
            account
        };
    }

    public async updateTrustCertification(
        trustCredential: TrustCredential,
        trustedCredentialIssuers: Set<string>,
        loader: FileContextLoader,
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        // Check the validity
        await this.trustCredentialManager.verifyCredential(
            {
                verifiableCredential: trustCredential,
                trustedIssuers: trustedCredentialIssuers
            },
            {
                chainId: await this.getChainId(),
                expectedProofPurpose: "assertionMethod",
                documentLoader: JsonLdContextLoader.concatenateLoaders([
                    loader.createContextLoader(FileContext.CERTIFICATION_CREDENTIAL_LOADER),
                    loader.createContextLoader(FileContext.REVOCATION_LIST_LOADER)
                ])
            }
        );

        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);
        if (userAuth.did !== trustCredential.credentialSubject.id) {
            throw new InvalidTrustCertification(
                "The trust certification has not been issued to the specified user"
            );
        }

        if (!this.authenticateUser(userAuth.did, senderAccount)) {
            throw new InvalidArgumentError(
                "The specified user account cannot modify the specified DID"
            );
        }

        const signature = Buffer.from(trustCredential.proof.jws.split(".")[2] || "", "base64url");
        const proof: ProofRequest = {
            issuerAssertionMethodFragment: (
                await this.parseDidUrlWithFragment(trustCredential.proof.verificationMethod)
            ).fragment,
            createdTimestamp: this.isoDateToSolidityTimestamp(trustCredential.proof.created),
            jwsSignatureR: this.web3.utils.bytesToHex(Array.from(signature.subarray(0, 32))),
            jwsSignatureS: this.web3.utils.bytesToHex(Array.from(signature.subarray(32, 64))),
            jwsSignatureV: signature[64] || 0
        };

        const certificationCredential: CertificationCredentialRequest = {
            issuer: trustCredential.issuer,
            issuanceTimestamp: this.isoDateToSolidityTimestamp(trustCredential.issuanceDate),
            expirationTimestamp: this.isoDateToSolidityTimestamp(trustCredential.expirationDate),
            credentialStatusFragment: (
                await this.parseDidUrlWithFragment(trustCredential.credentialStatus.id)
            ).fragment,
            proof
        };
        return this.sendTransaction(
            this.contract.updateTrustCertification(
                userAuth.did,
                userAuth.fragment,
                certificationCredential
            ),
            senderAccount,
            gasLimit
        );
    }

    public async removeTrustCertification(
        did: string,
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);

        return this.sendTransaction(
            this.contract.removeTrustCertification(userAuth.did, userAuth.fragment),
            senderAccount,
            gasLimit
        );
    }

    public async addAuthentication(
        authenticationToAddDidUrl: string,
        authenticationToAddAddress: string,
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);
        const authMethod = await this.parseDidUrlWithFragment(authenticationToAddDidUrl);

        if (userAuth.did !== authMethod.did) {
            throw new InvalidArgumentError(
                "Cannot add an authentication method to user different from the sender"
            );
        }

        return this.sendTransaction(
            this.contract.addVerificationMethod(
                userAuth.did,
                userAuth.fragment,
                authMethod.fragment,
                VerificationMethodType.AUTHENTICATION,
                authenticationToAddAddress
            ),
            senderAccount,
            gasLimit
        );
    }

    public async addAssertionMethod(
        assertionMethodToAddDidUrl: string,
        assertionMethodToAddAddress: string,
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);
        const assertMethod = await this.parseDidUrlWithFragment(assertionMethodToAddDidUrl);

        if (userAuth.did !== assertMethod.did) {
            throw new InvalidArgumentError(
                "Cannot add an assertion method to a user different from the sender"
            );
        }
        return this.sendTransaction(
            this.contract.addVerificationMethod(
                userAuth.did,
                userAuth.fragment,
                assertMethod.fragment,
                VerificationMethodType.ASSERTION_METHOD,
                assertionMethodToAddAddress
            ),
            senderAccount,
            gasLimit
        );
    }

    public async addService<S extends Service, T extends string>(
        service: S,
        serviceManager: ServiceManager<S, T>,
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);
        const serviceUrl = await this.parseDidUrlWithFragment(service.id);

        if (userAuth.did !== serviceUrl.did) {
            throw new InvalidArgumentError(
                "Cannot add a service to a user different from the sender"
            );
        }
        if (!serviceManager.canHandleType(service.type)) {
            throw new InvalidArgumentError(
                `The specified service manager cannot handle services with type '${service.type}'`
            );
        }

        return this.sendTransaction(
            this.contract.addService(
                userAuth.did,
                userAuth.fragment,
                serviceUrl.fragment,
                service.type,
                await serviceManager.stringifyEndpoint(service)
            ),
            senderAccount,
            gasLimit
        );
    }

    public async updateAuthentication(
        authenticationToUpdateDidUrl: string,
        authenticationToUpdateAddress: string,
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);
        const authMethod = await this.parseDidUrlWithFragment(authenticationToUpdateDidUrl);

        if (userAuth.did !== authMethod.did) {
            throw new InvalidArgumentError(
                "Cannot update an authentication of a user different from the sender"
            );
        }

        return this.sendTransaction(
            this.contract.updateVerificationMethod(
                userAuth.did,
                userAuth.fragment,
                authMethod.fragment,
                VerificationMethodType.AUTHENTICATION,
                authenticationToUpdateAddress
            ),
            senderAccount,
            gasLimit
        );
    }

    public async updateAssertionMethod(
        assertionMethodToUpdateDidUrl: string,
        assertionMethodToUpdateAddress: string,
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);
        const assertMethod = await this.parseDidUrlWithFragment(assertionMethodToUpdateDidUrl);

        if (userAuth.did !== assertMethod.did) {
            throw new InvalidArgumentError(
                "Cannot update an assertion method of a user different from the sender"
            );
        }

        return this.sendTransaction(
            this.contract.updateVerificationMethod(
                userAuth.did,
                userAuth.fragment,
                assertMethod.fragment,
                VerificationMethodType.ASSERTION_METHOD,
                assertionMethodToUpdateAddress
            ),
            senderAccount,
            gasLimit
        );
    }

    public async updateService<S extends Service, T extends string>(
        service: S,
        serviceManager: ServiceManager<S, T>,
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);
        const serviceUrl = await this.parseDidUrlWithFragment(service.id);

        if (userAuth.did !== serviceUrl.did) {
            throw new InvalidArgumentError(
                "Cannot update a service of a user different from the sender"
            );
        }
        if (!serviceManager.canHandleType(service.type)) {
            throw new InvalidArgumentError(
                `The specified service manager cannot handle services with type '${service.type}'`
            );
        }

        return this.sendTransaction(
            this.contract.updateService(
                userAuth.did,
                userAuth.fragment,
                serviceUrl.fragment,
                service.type,
                await serviceManager.stringifyEndpoint(service)
            ),
            senderAccount,
            gasLimit
        );
    }

    public async removeAuthentication(
        authenticationToRemoveDidUrl: string,
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);
        const authMethod = await this.parseDidUrlWithFragment(authenticationToRemoveDidUrl);

        if (userAuth.did !== authMethod.did) {
            throw new InvalidArgumentError(
                "Cannot remove an authentication of a user different from the sender"
            );
        }

        return this.sendTransaction(
            this.contract.removeVerificationMethod(
                userAuth.did,
                userAuth.fragment,
                authMethod.fragment,
                VerificationMethodType.AUTHENTICATION
            ),
            senderAccount,
            gasLimit
        );
    }

    public async removeAssertionMethod(
        assertionMethodToRemoveDidUrl: string,
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);
        const assertMethod = await this.parseDidUrlWithFragment(assertionMethodToRemoveDidUrl);

        if (userAuth.did !== assertMethod.did) {
            throw new InvalidArgumentError(
                "Cannot remove an assertion method of a user different from the sender"
            );
        }

        return this.sendTransaction(
            this.contract.removeVerificationMethod(
                userAuth.did,
                userAuth.fragment,
                assertMethod.fragment,
                VerificationMethodType.ASSERTION_METHOD
            ),
            senderAccount,
            gasLimit
        );
    }

    public async removeService(
        serviceDidUrl: string,
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);
        const serviceUrl = await this.parseDidUrlWithFragment(serviceDidUrl);

        if (userAuth.did !== serviceUrl.did) {
            throw new InvalidArgumentError(
                "Cannot remove a service of a user different from the sender"
            );
        }

        return this.sendTransaction(
            this.contract.removeService(userAuth.did, userAuth.fragment, serviceUrl.fragment),
            senderAccount,
            gasLimit
        );
    }

    public async revokeVerifiableCredential(
        credentialStatus: CredentialStatus,
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);
        const credentialStatusUrl = await this.parseDidUrlWithFragment(credentialStatus.id);

        if (credentialStatus.type !== "RevocationList2023") {
            throw new InvalidArgumentError(
                "Only 'RevocationList2023' credential status is supported"
            );
        }
        if (userAuth.did !== credentialStatusUrl.did) {
            throw new InvalidArgumentError(
                "Cannot revoke a verifiable credential issued by a user different from the sender"
            );
        }

        return this.sendTransaction(
            this.contract.revokeVerifiableCredential(
                userAuth.did,
                userAuth.fragment,
                credentialStatusUrl.fragment
            ),
            senderAccount,
            gasLimit
        );
    }

    public async deactivate(
        senderAuthenticationMethod: string,
        senderAccount: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        const userAuth = await this.parseDidUrlWithFragment(senderAuthenticationMethod);

        return this.sendTransaction(
            this.contract.deactivate(userAuth.did, userAuth.fragment),
            senderAccount,
            gasLimit
        );
    }

    public async resolveRepresentation(
        did: string,
        resolutionOptions: ResolutionOptions
    ): Promise<DidResolutionResult> {
        const parametersCheck = DidResolver.checkParameters(
            did,
            resolutionOptions,
            DidResolver.composeResolutionErrorResult
        );
        if (parametersCheck.error) {
            return parametersCheck.result;
        }
        if (!DidUtils.isValidDid(did, await this.getChainId())) {
            return DidResolver.composeResolutionErrorResult(
                "invalidDid",
                `The DID ${did} is not valid`
            );
        }

        const executionResult = await this.executeOrInternalError(
            this.contract.resolve(did),
            DidResolver.composeResolutionErrorResult
        );
        if (executionResult.error) {
            return executionResult.result;
        }
        const response = executionResult.result;

        const didResolutionMetadata: SuccessfulMetadata = {
            contentType: "application/did+ld+json"
        };
        const didDocumentMetadata: DidDocumentMetadata = {
            created: this.solidityTimestampToIsoDate(response.createdTimestamp),
            updated: this.solidityTimestampToIsoDate(response.updatedTimestamp),
            deactivated: response.deactivated
        };

        const authentications: VerificationMethod[] = [];
        const assertionMethods: VerificationMethod[] = [];

        for (const verificationMethodResponse of response.verificationMethods) {
            const verificationMethod = await this.composeVerificationMethod(
                did,
                verificationMethodResponse
            );
            if (verificationMethodResponse.methodType === "0") {
                authentications.push(verificationMethod);
            } else {
                assertionMethods.push(verificationMethod);
            }
        }

        const services: Service[] = [];
        const contexts = new Set<string | ContextDefinition>();
        const serviceResponse = response.services;
        if (serviceResponse.length > 0) {
            const serviceManagers = resolutionOptions.serviceManagers;
            if (serviceManagers === undefined) {
                throw new InvalidArgumentError(
                    "The DID document contains services, but resolutionOptions.serviceManagers is undefined"
                );
            }
            for (const service of serviceResponse) {
                const serviceWithContext = await this.createService(serviceManagers, did, service);

                serviceWithContext["@context"].forEach((context) => contexts.add(context));
                const serviceWithoutContext = serviceWithContext as Service & {"@context"?: any};
                delete serviceWithoutContext["@context"];
                services.push(serviceWithoutContext);
            }
        }

        contexts.delete(DidResolver.DID_DOCUMENT_CONTEXT);
        contexts.delete(DidResolver.ECDSA_SECP256K1_RECOVERY_2020_CONTEXT);
        contexts.delete(DidResolver.SSI_COT_DID_DOCUMENT_CONTEXT);

        const contextArray = Array.from(contexts);
        contextArray.unshift(
            DidResolver.DID_DOCUMENT_CONTEXT,
            DidResolver.ECDSA_SECP256K1_RECOVERY_2020_CONTEXT,
            DidResolver.SSI_COT_DID_DOCUMENT_CONTEXT
        );

        const document: DidDocument = {
            "@context": contextArray,
            id: did,
            authentication: authentications
        };
        if (assertionMethods.length !== 0) {
            document.assertionMethod = assertionMethods;
        }
        if (services.length !== 0) {
            document.service = services;
        }
        // Add trust certification
        if (response.certification.valid) {
            document.trustCertification = this.createTrustCertification(
                response.certification,
                response.certificationStatus
            );
        }

        return {
            "@context": [DidResolver.RESOLUTION_CONTEXT],
            didResolutionMetadata,
            didDocumentStream: document,
            didDocumentMetadata
        };
    }

    public async resolveChain(
        did: string,
        chainResolutionOptions: ChainResolutionOptions = {accept: "application/did+ld+json"}
    ): Promise<ChainResolutionResult> {
        const parametersCheck = DidResolver.checkParameters(
            did,
            chainResolutionOptions,
            DidResolver.composeChainResolutionErrorResult
        );
        if (parametersCheck.error) {
            return parametersCheck.result;
        }

        const executionResult = await this.executeOrInternalError(
            this.contract.resolveChain(did),
            DidResolver.composeChainResolutionErrorResult
        );
        if (executionResult.error) {
            return executionResult.result;
        }
        const response = executionResult.result;
        const result: TrustCertification[] = [];

        for (let i = 0; i < response.certifications.length; i++) {
            const certification = response.certifications[i];
            const credentialStatus = response.statuses[i];
            if (
                certification === undefined ||
                credentialStatus === undefined ||
                !certification.valid
            ) {
                break;
            }

            result.push(this.createTrustCertification(certification, credentialStatus));
        }

        return {
            "@context": [DidResolver.SSI_COT_CHAIN_RESOLUTION_CONTEXT],
            resolutionMetadata: {contentType: "application/did+ld+json"},
            chainStream: {
                "@context": [
                    DidResolver.SSI_COT_CHAIN_RESOLUTION_CONTEXT,
                    DidResolver.SSI_COT_DID_DOCUMENT_CONTEXT,
                    DidResolver.ECDSA_SECP256K1_RECOVERY_2020_CONTEXT
                ],
                trustChain: result
            },
            chainMetadata: {}
        } as SuccessfulChainResolutionResult;
    }

    public async resolveDidUrl(
        didUrl: string,
        dereferenceOptions: DidUrlDereferenceOptions
    ): Promise<DidUrlDereferenceResult> {
        const check = await this.checkUrlParameters(didUrl, dereferenceOptions);
        if (check.error) {
            return check.result;
        }
        const parsedDidUrl = check.result;
        const queryParamsCount = parsedDidUrl.query.size;
        const fragmentLength = parsedDidUrl.fragment.length;

        if (queryParamsCount > 1) {
            return DidResolver.composeDereferencingErrorResult(
                "invalidDidUrl",
                "The DID URL to resolve must contain at most 1 query parameter"
            );
        }
        if (queryParamsCount === 1 && fragmentLength !== 0) {
            return DidResolver.composeDereferencingErrorResult(
                "invalidDidUrl",
                "The DID URL to resolve must specify either the query part or the fragment part, but not both"
            );
        }

        if (queryParamsCount === 0 && fragmentLength === 0) {
            // Resolve the DID document
            const didResolutionResult = await this.resolveRepresentation(
                didUrl,
                dereferenceOptions
            );

            if (DidUtils.isResolutionErrored(didResolutionResult)) {
                const error = didResolutionResult.didResolutionMetadata.error;
                let errorString: "invalidDidUrl" | Errors;

                if (error === "invalidDid") {
                    errorString = "invalidDidUrl";
                } else {
                    errorString = error;
                }
                return {
                    "@context": [
                        DidResolver.RESOLUTION_CONTEXT,
                        DidResolver.RESOLUTION_ERROR_MESSAGE_CONTEXT
                    ],
                    dereferencingMetadata: {error: errorString, errorMessage: "Resolution error"},
                    contentStream: {},
                    contentMetadata: {}
                } as ErrorDereferenceResult;
            }
            return {
                "@context": [
                    DidResolver.RESOLUTION_CONTEXT,
                    DidResolver.RESOLUTION_ERROR_MESSAGE_CONTEXT
                ],
                dereferencingMetadata: {contentType: "application/did+ld+json"},
                contentStream: didResolutionResult.didDocumentStream,
                contentMetadata: didResolutionResult.didDocumentMetadata
            } as DereferenceResult<DidDocument, DidDocumentMetadata>;
        }
        if (queryParamsCount === 1) {
            return this.executeServiceResolution(parsedDidUrl, dereferenceOptions.serviceManagers);
        }
        // Try resolving as a verification method
        const verificationMethodResult = await this.exeuteVerificationMethodResolution(
            parsedDidUrl
        );
        if (DidUtils.isDereferenceErrored(verificationMethodResult)) {
            if (dereferenceOptions.omitCredentialStatus) {
                return DidResolver.composeDereferencingErrorResult(
                    "notFound",
                    "The verification method has not been found"
                );
            }
            return this.executeCredentialStatusResolution(parsedDidUrl);
        }
        return verificationMethodResult;
    }

    public async resolveAuthentication(
        didUrl: string,
        dereferenceOptions: DereferenceOptions = {
            accept: "application/did+ld+json"
        }
    ): Promise<ErrorDereferenceResult | AuthenticationDereferenceResult> {
        const result = await this.resolveFromFragment(didUrl, dereferenceOptions, (resolver, url) =>
            resolver.exeuteVerificationMethodResolution(url)
        );
        if (DidUtils.isDereferenceErrored(result)) {
            return result;
        }
        if (DidUtils.isAuthentication(result)) {
            return result;
        }
        return DidResolver.composeDereferencingErrorResult(
            "notFound",
            `The authentication ${didUrl} has not been found`
        );
    }

    public async resolveAssertionMethod(
        didUrl: string,
        dereferenceOptions: DereferenceOptions = {
            accept: "application/did+ld+json"
        }
    ): Promise<ErrorDereferenceResult | AssertionMethodDereferenceResult> {
        const result = await this.resolveFromFragment(didUrl, dereferenceOptions, (resolver, url) =>
            resolver.exeuteVerificationMethodResolution(url)
        );
        if (DidUtils.isDereferenceErrored(result)) {
            return result;
        }
        if (DidUtils.isAssertionMethod(result)) {
            return result;
        }
        return DidResolver.composeDereferencingErrorResult(
            "notFound",
            `The assertion method '${didUrl}' has not been found`
        );
    }

    public async resolveService(didUrl: string, dereferenceOptions: ServiceDereferenceOptions) {
        const check = await this.checkUrlParameters(didUrl, dereferenceOptions);
        if (check.error) {
            return check.result;
        }
        const parsedDidUrl = check.result;
        const queryParamsCount = parsedDidUrl.query.size;
        const fragmentLength = parsedDidUrl.fragment.length;

        if (queryParamsCount !== 1) {
            return DidResolver.composeDereferencingErrorResult(
                "invalidDidUrl",
                "The DID URL to resolve must contain exactly 1 query parameter"
            );
        }

        if (fragmentLength !== 0) {
            return DidResolver.composeDereferencingErrorResult(
                "invalidDidUrl",
                "The DID URL to resolve not specify the fragment part"
            );
        }

        return this.executeServiceResolution(parsedDidUrl, dereferenceOptions.serviceManagers);
    }

    public resolveCredentialStatus(
        didUrl: string,
        dereferenceOptions: DereferenceOptions = {
            accept: "application/did+ld+json"
        }
    ): Promise<ErrorDereferenceResult | CredentialStatusDereferenceResult> {
        return this.resolveFromFragment(didUrl, dereferenceOptions, (resolver, url) =>
            resolver.executeCredentialStatusResolution(url)
        );
    }

    private async resolveFromFragment<T>(
        didUrl: string,
        dereferenceOptions: DereferenceOptions,
        executionFunction: (
            didResolver: DidResolver,
            didUrl: DidUrl
        ) => Promise<ErrorDereferenceResult | T>
    ) {
        const check = await this.checkUrlParameters(didUrl, dereferenceOptions);
        if (check.error) {
            return check.result;
        }
        const parsedDidUrl = check.result;

        if (parsedDidUrl.query.size !== 0) {
            return DidResolver.composeDereferencingErrorResult(
                "invalidDidUrl",
                "The DID URL to resolve must not contain the query part"
            );
        }
        if (parsedDidUrl.fragment.length === 0) {
            return DidResolver.composeDereferencingErrorResult(
                "invalidDidUrl",
                "The DID URL to resolve must contain a fragment part"
            );
        }

        return executionFunction(this, parsedDidUrl);
    }

    private async exeuteVerificationMethodResolution(
        parsedDidUrl: DidUrl
    ): Promise<
        ErrorDereferenceResult | AuthenticationDereferenceResult | AssertionMethodDereferenceResult
    > {
        let resourceType: ResourceType.AUTHENTICATION | ResourceType.ASSERTION_METHOD;

        const result = await this.executeOrInternalError(
            this.contract.resolveVerificationMethod(parsedDidUrl.did, parsedDidUrl.fragment),
            DidResolver.composeDereferencingErrorResult
        );
        if (result.error) {
            return result.result;
        }
        const verificationMethod = result.result;
        if (!verificationMethod.valid) {
            return DidResolver.composeDereferencingErrorResult(
                "notFound",
                `The resource ${parsedDidUrl.did}#${parsedDidUrl.fragment} has not been found`
            );
        }

        if (verificationMethod.methodType === "0") {
            resourceType = ResourceType.AUTHENTICATION;
        } else {
            resourceType = ResourceType.ASSERTION_METHOD;
        }
        return {
            "@context": [DidResolver.RESOLUTION_CONTEXT],
            dereferencingMetadata: {contentType: "application/did+ld+json"},
            contentStream: await this.composeVerificationMethodWithContext(
                parsedDidUrl.did,
                verificationMethod
            ),
            contentMetadata: {resourceType}
        } as AuthenticationDereferenceResult | AssertionMethodDereferenceResult;
    }

    private async executeServiceResolution(
        parsedDidUrl: DidUrl,
        serviceManagers?: ServiceManager<Service, any>[]
    ): Promise<ErrorDereferenceResult | ServiceDereferenceResult> {
        const serviceName = parsedDidUrl.query.get("service");

        if (serviceName === null) {
            return DidResolver.composeDereferencingErrorResult(
                "invalidDidUrl",
                "The only supported DID URL query param is 'service'"
            );
        }
        if (serviceManagers === undefined) {
            throw new InvalidArgumentError(
                "The DID URL resolves to a service, but dereferenceOptions.serviceConstructor is undefined"
            );
        }
        const result = await this.executeOrInternalError(
            this.contract.resolveService(parsedDidUrl.did, serviceName),
            DidResolver.composeDereferencingErrorResult
        );
        if (result.error) {
            return result.result;
        }

        const serviceResponse = result.result;
        if (!serviceResponse.valid) {
            return DidResolver.composeDereferencingErrorResult("notFound", "Service not found");
        }
        const service = await this.createService(
            serviceManagers,
            parsedDidUrl.did,
            serviceResponse
        );

        return {
            "@context": [DidResolver.RESOLUTION_CONTEXT],
            dereferencingMetadata: {contentType: "application/did+ld+json"},
            contentStream: service,
            contentMetadata: {resourceType: ResourceType.SERVICE}
        };
    }

    private async executeCredentialStatusResolution(
        parsedDidUrl: DidUrl
    ): Promise<ErrorDereferenceResult | CredentialStatusDereferenceResult> {
        const result = await this.executeOrInternalError(
            this.contract.resolveCredentialStatus(parsedDidUrl.did, parsedDidUrl.fragment),
            DidResolver.composeDereferencingErrorResult
        );

        if (result.error) {
            return result.result;
        }
        const revoked = result.result;

        const status: WithContext<RevocationStatus> = {
            "@context": [DidResolver.REVOCATION_LIST_2023_CONTEXT],
            revoked
        };
        return {
            "@context": [DidResolver.RESOLUTION_CONTEXT],
            dereferencingMetadata: {contentType: "application/did+ld+json"},
            contentStream: status,
            contentMetadata: {resourceType: ResourceType.CREDENTIAL_STATUS}
        };
    }

    private async createService(
        serviceManagers: ServiceManager<Service, any>[],
        did: string,
        serviceResponse: ServiceResponse
    ) {
        let serviceWithContext: WithContext<Service> | undefined = undefined;
        for (const serviceManager of serviceManagers) {
            if (await serviceManager.canHandleType(serviceResponse.serviceType)) {
                serviceWithContext = await serviceManager.parseEndpoint(
                    `${did}#${serviceResponse.didUrlFragment}`,
                    serviceResponse.serviceType,
                    serviceResponse.endpoint
                );
            }
        }
        if (serviceWithContext === undefined) {
            throw new InvalidArgumentError(
                `The DID document contains a service with type ${serviceResponse.serviceType}, but none of the service managers can handle it`
            );
        }

        return serviceWithContext;
    }

    private static checkParameters<T>(
        did: string,
        resolutionOptions: ChainResolutionOptions,
        errorCreationFunction: (error: Errors, errorMessage: string) => T
    ): ParameterCheckResult<T> {
        if (resolutionOptions.accept !== "application/did+ld+json") {
            return {
                error: true,
                result: errorCreationFunction(
                    "representationNotSupported",
                    `Unsupported representation type '${resolutionOptions.accept}'`
                )
            };
        }
        if (!DidUtils.isValidDidMethod(did)) {
            const splitDid = did.split(":");
            const didMethod =
                splitDid.length > 2 ? `'${splitDid[0]}:${splitDid[1]}'` : `of the DID '${did}'`;

            return {
                error: true,
                result: errorCreationFunction(
                    "methodNotSupported",
                    `The DID method ${didMethod} is not supported by the DID resolver`
                )
            };
        }

        return {error: false};
    }

    private async checkUrlParameters(
        didUrl: string,
        resolutionOptions: ChainResolutionOptions
    ): Promise<ExecutionResult<DidUrl, ErrorDereferenceResult>> {
        if (resolutionOptions.accept !== "application/did+ld+json") {
            return {
                error: true,
                result: DidResolver.composeDereferencingErrorResult(
                    "representationNotSupported",
                    `Unsupported representation type '${resolutionOptions.accept}'`
                )
            };
        }

        // Parse the DID URL
        const parsedDidUrl = DidUtils.parseDidUrl(didUrl);
        if (!DidUtils.isValidDidUrl(parsedDidUrl, await this.getChainId())) {
            return {
                error: true,
                result: DidResolver.composeDereferencingErrorResult(
                    "invalidDidUrl",
                    "The DID URL to resolve is not a valid DID URL"
                )
            };
        }

        return {error: false, result: parsedDidUrl};
    }

    private createTrustCertification(
        certification: CertificationResponse,
        credentialStatus: string
    ): TrustCertification {
        const proof = certification.proof;

        const signatureBytes: number[] = [];
        signatureBytes.push(...this.web3.utils.hexToBytes(proof.jwsSignatureR));
        signatureBytes.push(...this.web3.utils.hexToBytes(proof.jwsSignatureS));
        signatureBytes.push(new BN(proof.jwsSignatureV).toNumber());
        const jwsSignature = Buffer.from(signatureBytes).toString("base64url");

        let status: TrustCertificationStatus;
        if (credentialStatus === "0") {
            status = TrustCertificationStatus.VALID;
        } else if (credentialStatus === "1") {
            status = TrustCertificationStatus.DEACTIVATED;
        } else {
            status = TrustCertificationStatus.REVOKED;
        }

        return {
            issuer: certification.issuer,
            issuanceDate: this.solidityTimestampToDate(certification.issuanceTimestamp),
            expirationDate: this.solidityTimestampToDate(certification.expirationTimestamp),
            credentialStatus: {
                id: `${certification.issuer}#${certification.credentialStatusFragment}`,
                type: "RevocationList2023"
            },
            certificationStatus: status,
            //  element.certificationStatus,
            proof: {
                type: "EcdsaSecp256k1RecoverySignature2020",
                created: DateUtils.toIsoDate(this.solidityTimestampToDate(proof.createdTimestamp)),
                verificationMethod: `${certification.issuer}#${proof.issuerAssertionMethodFragment}`,
                proofPurpose: "assertionMethod",
                jws: `eyJhbGciOiJFUzI1NkstUiIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..${jwsSignature}`
            }
        };
    }

    public async clear(account?: string): Promise<PromiEvent<TransactionReceipt>> {
        return this.sendTransaction(
            this.contract.clear(),
            account || this.web3.eth.defaultAccount || ""
        );
    }

    private async sendTransaction(
        transaction: MethodReturnContext,
        account: string,
        gasLimit?: number
    ): Promise<PromiEvent<TransactionReceipt>> {
        return transaction.send(
            this.getOptions(account || this.web3.eth.defaultAccount || "", gasLimit)
        );
    }

    private isoDateToSolidityTimestamp(isoDate: string): string {
        const milliseconds = Date.parse(isoDate);
        return this.web3.utils.numberToHex(Math.floor(milliseconds / 1000));
    }

    private solidityTimestampToDate(timestamp: string | number): Date {
        return new Date(new BN(timestamp).toNumber() * 1000);
    }

    private solidityTimestampToIsoDate(timestamp: string | number): string {
        const milliseconds = new BN(timestamp);
        return DateUtils.toIsoDate(new Date(milliseconds.toNumber() * 1000));
    }

    public async getChainId(): Promise<number> {
        await this.computeChainId();
        return this.chainId;
    }

    private authenticateUser(did: string, account: string) {
        return did.slice(-40) === account.toLowerCase().slice(2);
    }

    private async computeChainId(): Promise<void> {
        if (this.chainId === 0) {
            this.chainId = await this.web3.eth.getChainId();
        }
    }

    /*private async isValidDid(did: string): Promise<boolean> {
        await this.computeChainId();
        return DidUtils.isValidDid(did, this.chainId);
    }*/

    private async parseDidUrlWithFragment(didUrl: string): Promise<DidUrl> {
        const parsedUrl = DidUtils.parseDidUrl(didUrl);
        if (!DidUtils.isValidDidUrl(parsedUrl, await this.getChainId())) {
            throw new InvalidArgumentError(`The DID URL ${didUrl} is not a valid DID URL`);
        }
        if (parsedUrl.fragment.length === 0) {
            throw new InvalidArgumentError(`The DID URL ${didUrl} must contain the fragment part`);
        }

        return parsedUrl;
    }

    private getOptions(account: string, gasLimit?: number): SendOptions {
        const options: SendOptions = {from: account};

        if (gasLimit !== undefined) {
            options.gas = gasLimit;
        } else if (this.gasLimit !== undefined) {
            options.gas = this.gasLimit;
        }

        return options;
    }

    private async composeVerificationMethodWithContext(
        did: string,
        response: VerificationmethodResponse
    ): Promise<WithContext<VerificationMethod>> {
        const verificationMethod = (await this.composeVerificationMethod(
            did,
            response
        )) as WithContext<VerificationMethod>;
        verificationMethod["@context"] = [
            DidResolver.DID_DOCUMENT_CONTEXT,
            DidResolver.ECDSA_SECP256K1_RECOVERY_2020_CONTEXT
        ];

        return verificationMethod;
    }

    private async composeVerificationMethod(
        did: string,
        response: VerificationmethodResponse
    ): Promise<VerificationMethod> {
        return {
            id: `${did}#${response.didUrlFragment}`,
            type: "EcdsaSecp256k1RecoveryMethod2020",
            controller: did,
            blockchainAccountId: `eip155:${await this.getChainId()}:${response.blockchainAccount.slice(
                2
            )}`
        };
    }

    private static composeResolutionErrorResult(
        error: "invalidDid" | Errors,
        errorMessage: string
    ): ErrorResolutionResult {
        return {
            "@context": [
                DidResolver.RESOLUTION_CONTEXT,
                DidResolver.RESOLUTION_ERROR_MESSAGE_CONTEXT
            ],
            didResolutionMetadata: {
                error,
                errorMessage
            },
            didDocumentStream: {},
            didDocumentMetadata: {}
        };
    }

    private static composeChainResolutionErrorResult(
        error: "invalidDid" | Errors,
        errorMessage: string
    ): ErrorChainResolutionResult {
        return {
            "@context": [
                this.SSI_COT_CHAIN_RESOLUTION_CONTEXT,
                DidResolver.RESOLUTION_ERROR_MESSAGE_CONTEXT
            ],
            resolutionMetadata: {
                error,
                errorMessage
            },
            chainStream: {},
            chainMetadata: {}
        };
    }

    private static composeDereferencingErrorResult(
        error: "invalidDidUrl" | Errors,
        errorMessage: string
    ): ErrorDereferenceResult {
        return {
            "@context": [
                DidResolver.RESOLUTION_CONTEXT,
                DidResolver.RESOLUTION_ERROR_MESSAGE_CONTEXT
            ],
            dereferencingMetadata: {error, errorMessage},
            contentStream: {},
            contentMetadata: {}
        };
    }

    private async executeOrInternalError<T, E>(
        methodToExecute: MethodConstantReturnContext<T>,
        errorCreationFunction: (error: Errors, errorMessage: string) => E
    ): Promise<ExecutionResult<T, E>> {
        try {
            return {error: false, result: await methodToExecute.call()};
        } catch (error: unknown) {
            const message =
                typeof error === "object" && error !== null && "message" in error
                    ? error.message
                    : "Internal error";
            return {
                error: true,
                result: errorCreationFunction(
                    "internalError",
                    `Unable to resolve the DID document: ${message}`
                )
            };
        }
    }
}
