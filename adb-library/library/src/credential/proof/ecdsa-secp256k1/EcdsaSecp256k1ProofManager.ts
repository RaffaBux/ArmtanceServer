import JsonLd, {JsonLdDocument} from "jsonld";
import {LanguageMap} from "jsonld/jsonld";
import Web3 from "web3";
import {
    AssertionMethodDereferenceResult,
    AuthenticationDereferenceResult
} from "../../../resolver/DidResolutionTypes";
import {DidResolver} from "../../../resolver/DidResolver";
import {VerificationMethod} from "../../../resolver/DidTypes";
import {DidUtils} from "../../../resolver/DidUtils";
import {InvalidDidError} from "../../../resolver/InvalidDidError";
import {DateUtils} from "../../../utils/DateUtils";
import {DocumentLoader} from "../../../utils/JsonLdTypes";
import {InvalidVerifiableCredentialError} from "../../InvalidVerifiableCredentialError";
import {
    ProofVerificationMethodUtils,
    ResolutionFunction
} from "../../utils/ProofVerificationMethodUtils";
import {Credential, VerifiableCredential} from "../../VerifiableCredential";
import {Presentation, VerifiablePresentation} from "../../VerifiablePresentation";
import {CredentialProofManager} from "../CredentialProofManager";
import {ProofPurpose} from "../DataIntegrityProof";
import {InvalidProofError} from "../InvalidProofError";
import {PresentationProofManager} from "../PresentationProofManager";
import {EcdsaSecp256k1Proof} from "./EcdsaSecp256k1Proof";
import {JwsManager} from "./JwsManager";

export interface EcdsaSecp256k1CreationOptions {
    privateKey: Buffer;
    verificationMethod: string;
    chainId: number;
    proofPurpose: ProofPurpose;
    domain?: string | undefined;
    challenge?: string | undefined;
    documentLoader?: DocumentLoader | undefined;
}

export interface EcdsaSecp256k1VerificationOptions {
    chainId: number;
    expectedProofPurpose: ProofPurpose;
    expectedDomain?: string | undefined;
    expectedChallenge?: string | undefined;
    documentLoader?: DocumentLoader | undefined;
}

export class EcdsaSecp256k1ProofManager
    implements
        CredentialProofManager<
            EcdsaSecp256k1Proof,
            EcdsaSecp256k1CreationOptions,
            EcdsaSecp256k1VerificationOptions
        >,
        PresentationProofManager<
            EcdsaSecp256k1Proof,
            EcdsaSecp256k1CreationOptions,
            EcdsaSecp256k1VerificationOptions
        >
{
    private jwsManager: JwsManager;
    private didResolver: DidResolver;

    constructor(web3: Web3, didResolver: DidResolver) {
        this.didResolver = didResolver;
        this.jwsManager = new JwsManager(web3);
    }

    public async createCredentialProof<T extends LanguageMap>(
        credentialData: Credential<T>,
        creationOptions: EcdsaSecp256k1CreationOptions
    ): Promise<EcdsaSecp256k1Proof> {
        return this.createProof(credentialData, creationOptions);
    }

    public async createPresentationProof<T extends LanguageMap>(
        presentationData: Presentation,
        creationOptions: EcdsaSecp256k1CreationOptions
    ): Promise<EcdsaSecp256k1Proof> {
        return this.createProof(presentationData, creationOptions);
    }

    private async createProof(
        jsonLdDocument: JsonLdDocument,
        creationOptions: EcdsaSecp256k1CreationOptions
    ): Promise<EcdsaSecp256k1Proof> {
        // Check the arguments
        const didUrl = DidUtils.parseDidUrl(creationOptions.verificationMethod);
        if (!DidUtils.isValidDidUrl(didUrl, creationOptions.chainId)) {
            throw new InvalidDidError(
                `The DID URL '${creationOptions.verificationMethod}' is not valid`
            );
        }

        // Canonize the payload using the RDF Dataset Canonicalization Algorithm (URDNA2015)
        const canonizedPayload = await JsonLd.canonize(jsonLdDocument, {
            algorithm: "URDNA2015",
            format: "application/n-quads",
            documentLoader: creationOptions.documentLoader
        });

        // Create ths JWS
        const jws = await this.jwsManager.encode(canonizedPayload, creationOptions.privateKey);

        const proof: EcdsaSecp256k1Proof = {
            type: "EcdsaSecp256k1RecoverySignature2020",
            created: DateUtils.toIsoDate(new Date()),
            verificationMethod: creationOptions.verificationMethod,
            proofPurpose: creationOptions.proofPurpose,
            jws
        };
        if (creationOptions.domain !== undefined) {
            proof.domain = creationOptions.domain;
        }
        if (creationOptions.challenge !== undefined) {
            proof.challenge = creationOptions.challenge;
        }

        return proof;
    }

    public async verifyCredentialProof<T extends LanguageMap>(
        verifiableCredential: VerifiableCredential<T, EcdsaSecp256k1Proof>,
        verificationOptions: EcdsaSecp256k1VerificationOptions
    ): Promise<boolean> {
        return this.verifyProof(verifiableCredential, verificationOptions);
    }

    public async verifyPresentationProof<T extends LanguageMap>(
        verifiablePresentation: VerifiablePresentation<EcdsaSecp256k1Proof>,
        verificationOptions: EcdsaSecp256k1VerificationOptions
    ): Promise<boolean> {
        return this.verifyProof(verifiablePresentation, verificationOptions);
    }

    private async verifyProof(
        fullJsonLdDocument: JsonLdDocument & {proof: EcdsaSecp256k1Proof},
        verificationOptions: EcdsaSecp256k1VerificationOptions
    ): Promise<boolean> {
        // Extract the proof object
        const proof = fullJsonLdDocument.proof;

        // CHeck the proof validity
        if (proof.type !== "EcdsaSecp256k1RecoverySignature2020") {
            throw new InvalidProofError(
                `Unsupported proof type '${proof.type}'. Only 'EcdsaSecp256k1RecoverySignature2020' is supported`
            );
        }
        const proofCreationDate = Date.parse(proof.created);
        if (isNaN(proofCreationDate)) {
            throw new InvalidProofError("The proof creating date is not a valid proof");
        }
        if (proofCreationDate > Date.now()) {
            throw new InvalidProofError("The proof was created in the future");
        }
        if (proof.proofPurpose !== verificationOptions.expectedProofPurpose) {
            throw new InvalidProofError(
                `The proof has been created with the '${proof.proofPurpose}' purpose, but '${verificationOptions.expectedProofPurpose}' was expected`
            );
        }
        if (
            verificationOptions.expectedDomain !== undefined &&
            proof.domain !== verificationOptions.expectedDomain
        ) {
            throw new InvalidProofError(
                `The proof has been created for ${
                    proof.challenge === undefined ? "no domain" : `the '${proof.challenge}' domain`
                }, but the '${verificationOptions.expectedChallenge}' domain was expected`
            );
        }
        if (
            verificationOptions.expectedChallenge !== undefined &&
            proof.challenge !== verificationOptions.expectedChallenge
        ) {
            throw new InvalidProofError(
                `The proof has been created for ${
                    proof.challenge === undefined
                        ? "no challenge"
                        : `the challenge '${proof.challenge}'`
                }, but the challenge '${verificationOptions.expectedChallenge}' was expected`
            );
        }

        // Retrieve the verification method
        const verificationMethodUrl = DidUtils.parseDidUrl(proof.verificationMethod);
        if (!DidUtils.isValidDidUrl(verificationMethodUrl, await this.didResolver.getChainId())) {
            throw new InvalidVerifiableCredentialError(
                "The 'proof.verificationMethod' is not a valid DID URL"
            );
        }

        let resolveFunction: ResolutionFunction<
            AuthenticationDereferenceResult | AssertionMethodDereferenceResult
        >;
        if (verificationOptions.expectedProofPurpose === "authentication") {
            resolveFunction = (resolver, url, options) =>
                resolver.resolveAuthentication(url, options);
        } else {
            resolveFunction = (resolver, url, options) =>
                resolver.resolveAssertionMethod(url, options);
        }

        const dereferencingResult = await ProofVerificationMethodUtils.checkForDereferencingErrors(
            this.didResolver,
            proof.verificationMethod,
            resolveFunction,
            "The verification method specified in the proof is not a valid DID URL",
            "The verification method specified in the proof cannot be found",
            InvalidProofError
        );

        const verificationMethod = dereferencingResult.contentStream as VerificationMethod;

        // Copy the secured data document removing the proof
        const jsonldPayload: JsonLdDocument & {proof?: EcdsaSecp256k1Proof} = Object.assign(
            {},
            fullJsonLdDocument
        );
        delete jsonldPayload.proof;

        // Canonize the payload using the RDF Dataset Canonicalization Algorithm (URDNA2015)
        const canonizedPayload = await JsonLd.canonize(jsonldPayload, {
            algorithm: "URDNA2015",
            format: "application/n-quads",
            documentLoader: verificationOptions.documentLoader
        });

        // Verify the signature
        return this.jwsManager.verify(
            fullJsonLdDocument.proof.jws,
            canonizedPayload,
            await DidUtils.eip155ToAddress(verificationMethod.blockchainAccountId)
        );
    }
}
