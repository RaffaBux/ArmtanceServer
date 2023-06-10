import {LanguageMap} from "jsonld/jsonld";
import Web3 from "web3";
import {CredentialStatusDereferenceResult, ResourceType} from "../resolver/DidResolutionTypes";
import {DidResolver} from "../resolver/DidResolver";
import {RevocationStatus, TrustCertification, TrustCertificationStatus} from "../resolver/DidTypes";
import {DidUtils} from "../resolver/DidUtils";
import {DateUtils} from "../utils/DateUtils";
import {InvalidArgumentError} from "../utils/InvalidArgumentError";
import {JsonLdContexts} from "../utils/JsonLdTypes";
import {InvalidVerifiableCredentialError} from "./InvalidVerifiableCredentialError";
import {CredentialProofManager} from "./proof/CredentialProofManager";
import {Proof} from "./proof/Proof";
import {ProofVerificationMethodUtils} from "./utils/ProofVerificationMethodUtils";
import {Credential, CredentialStatus, VerifiableCredential} from "./VerifiableCredential";

export interface CredentialCreationOptions<T extends LanguageMap> {
    additionalContexts: JsonLdContexts;
    id?: string;
    additionalTypes: string | string[];
    credentialSubject: T;
    issuer: string;
    expirationDate?: Date;
    credentialStatus?: CredentialStatus;
}

export interface CredentialVerificationOptions<P extends Proof> {
    verifiableCredential: VerifiableCredential<any, P>;
    trustedIssuers: Set<string>;
    onRevokedCertification?: (
        trustCertification: TrustCertification,
        isTrusted: boolean
    ) => boolean;
}

export class VerifiableCredentialManager<
    P extends Proof,
    C,
    V,
    M extends CredentialProofManager<P, C, V>
> {
    private static readonly VERIFIABLE_CREDENTIALS_CONTEXT =
        "https://www.w3.org/2018/credentials/v1";
    private readonly didResolver: DidResolver;
    private proofManager: M;

    constructor(web3: Web3, didResolver: DidResolver, proofManager: M) {
        this.didResolver = didResolver;
        this.proofManager = proofManager;
    }

    public async createVerifiableCredential<T extends LanguageMap>(
        options: CredentialCreationOptions<T>,
        proofCreationOptions: C
    ): Promise<VerifiableCredential<T, P>> {
        // Check the parameters
        const chainId = await this.didResolver.getChainId();
        if (!DidUtils.isValidDid(options.issuer, chainId)) {
            throw new InvalidArgumentError("The issuer DID is not a valid DID");
        }
        if (options.credentialStatus !== undefined) {
            const credentialStatusDidUrl = DidUtils.parseDidUrl(options.credentialStatus.id);
            if (!DidUtils.isValidDidUrl(credentialStatusDidUrl, chainId)) {
                throw new InvalidArgumentError(
                    "The credential status id property is not a valid DID URL"
                );
            }
        }

        const credential: Credential<T> = {
            "@context": [VerifiableCredentialManager.VERIFIABLE_CREDENTIALS_CONTEXT],
            type: ["VerifiableCredential"],
            credentialSubject: options.credentialSubject,
            issuer: options.issuer,
            issuanceDate: DateUtils.toIsoDate(new Date())
        };
        // Add additional contexts
        credential["@context"].push(...options.additionalContexts);
        // Add additional types
        credential.type.push(...options.additionalTypes);
        // Add optional fields
        VerifiableCredentialManager.addOptionalField(options.id, credential, "id");
        if (options.expirationDate !== undefined) {
            credential.expirationDate = DateUtils.toIsoDate(options.expirationDate);
        }
        VerifiableCredentialManager.addOptionalField(
            options.credentialStatus,
            credential,
            "credentialStatus"
        );

        // Generate the proof
        const proof = await this.proofManager.createCredentialProof(credential, proofCreationOptions);
        // Add the proof
        const credentialWithProof = credential as VerifiableCredential<T, P>;
        credentialWithProof.proof = proof;

        return credentialWithProof;
    }

    private static addOptionalField<V>(
        optionValue: V | undefined,
        credential: Credential<any>,
        keyName: keyof Credential<any>
    ) {
        if (optionValue !== undefined) {
            credential[keyName] = optionValue;
        }
    }

    public async verifyCredential(
        options: CredentialVerificationOptions<P>,
        proofVerificationOptions: V
    ) {
        const verifiableCredential = options.verifiableCredential;
        const chainId = await this.didResolver.getChainId();

        // Check the context
        if (
            verifiableCredential["@context"].length === 0 ||
            verifiableCredential["@context"][0] !==
                VerifiableCredentialManager.VERIFIABLE_CREDENTIALS_CONTEXT
        ) {
            throw new InvalidVerifiableCredentialError(
                `Any valid verifiable credential must specify '${VerifiableCredentialManager.VERIFIABLE_CREDENTIALS_CONTEXT}' as the first context`
            );
        }
        // Check the type
        if (!verifiableCredential.type.includes("VerifiableCredential")) {
            throw new InvalidVerifiableCredentialError(
                "Any valid verifiable credential must contain the type 'VerifiableCredential'"
            );
        }
        // Check the issuer
        if (!DidUtils.isValidDid(verifiableCredential.issuer, chainId)) {
            throw new InvalidVerifiableCredentialError("The issuer is not a valid DID");
        }

        // Check the issuance date
        const issuanceDate = Date.parse(verifiableCredential.issuanceDate);
        if (isNaN(issuanceDate)) {
            throw new InvalidVerifiableCredentialError(
                "Invalid verifiable credential issuance date"
            );
        }
        if (issuanceDate > Date.now()) {
            throw new InvalidVerifiableCredentialError(
                "The verifiable credential was issued in the future"
            );
        }
        // Check the expiration date
        if (verifiableCredential.expirationDate !== undefined) {
            const expirationDate = Date.parse(verifiableCredential.expirationDate);
            if (isNaN(expirationDate)) {
                throw new InvalidVerifiableCredentialError(
                    "Invalid verifiable credential expiration date"
                );
            }
            if (expirationDate < Date.now()) {
                throw new InvalidVerifiableCredentialError("The verifiable credential is expired");
            }
        }
        // Check the credential status
        if (verifiableCredential.credentialStatus !== undefined) {
            const credentialStatus = verifiableCredential.credentialStatus;
            const credentialStatusDidUrl = DidUtils.parseDidUrl(credentialStatus.id);
            if (!DidUtils.isValidDidUrl(credentialStatusDidUrl, chainId)) {
                throw new InvalidVerifiableCredentialError(
                    "The 'credentialStatus.id' is not a valid DID URL"
                );
            }
            if (credentialStatus.type !== "RevocationList2023") {
                throw new InvalidVerifiableCredentialError(
                    `Unsupported credential status '${credentialStatus.type}. Only RevocationList2023 is supported`
                );
            }
            const dereferencingResult =
                await ProofVerificationMethodUtils.checkForDereferencingErrors(
                    this.didResolver,
                    credentialStatus.id,
                    (resolver, url, options) => resolver.resolveCredentialStatus(url, options),
                    "The 'credentialStatus.id' is not a valid DID URL",
                    "The credential status cannot be found",
                    InvalidVerifiableCredentialError
                );
            if (
                dereferencingResult.contentMetadata.resourceType !== ResourceType.CREDENTIAL_STATUS
            ) {
                throw new InvalidVerifiableCredentialError(
                    "The 'credentialStatus.id' DID URL does not resolve to a valid resource"
                );
            }
            const revocationStatus = dereferencingResult.contentStream as RevocationStatus;
            if (revocationStatus.revoked) {
                throw new InvalidVerifiableCredentialError(
                    "The verifiable credential has been revoked"
                );
            }
        }

        // Extract the issuer
        const issuer = verifiableCredential.issuer;
        const trustedIssuers = options.trustedIssuers;

        // Retrieve the issuer chain
        const issuerChainResult = await this.didResolver.resolveChain(issuer);
        if (DidUtils.isChainResolutionErrored(issuerChainResult)) {
            throw new InvalidVerifiableCredentialError(
                `Cannot retrieve the chain of trust of the DID '${issuer}: ${issuerChainResult.resolutionMetadata.errorMessage}`
            );
        }

        // Check the chain
        let isIssuerTrusted = trustedIssuers.has(issuer);
        if (!isIssuerTrusted) {
            for (const issuerTrustCertification of issuerChainResult.chainStream.trustChain) {
                isIssuerTrusted = trustedIssuers.has(issuerTrustCertification.issuer);

                if (
                    issuerTrustCertification.certificationStatus ===
                    TrustCertificationStatus.REVOKED
                ) {
                    if (options.onRevokedCertification !== undefined) {
                        isIssuerTrusted = options.onRevokedCertification(
                            issuerTrustCertification,
                            isIssuerTrusted
                        );
                    } else {
                        throw new InvalidVerifiableCredentialError(
                            "The issuer may be trusted, but at least one certification hin its trust chain been revoked"
                        );
                    }
                } else if (trustedIssuers.has(issuerTrustCertification.issuer)) {
                    isIssuerTrusted = true;
                    break;
                }
            }
        }

        if (!isIssuerTrusted) {
            throw new InvalidVerifiableCredentialError(
                "The issuer of the verifiable credential is not trusted"
            );
        }

        // Verify the proof
        if (
            !(await this.proofManager.verifyCredentialProof(verifiableCredential, proofVerificationOptions))
        ) {
            throw new InvalidVerifiableCredentialError(
                "The integrity of the verifiable credential cannot be validated"
            );
        }
    }
}
