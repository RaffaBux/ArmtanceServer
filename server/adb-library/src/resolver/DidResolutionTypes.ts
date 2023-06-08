import {JsonLdContexts, WithContext} from "../utils/JsonLdTypes";
import {DidDocument, RevocationStatus, TrustCertification, VerificationMethod} from "./DidTypes";
import {Service, ServiceManager} from "./ServiceTypes";

export interface ChainResolutionOptions {
    accept: "application/did+ld+json" | string;
}

export interface DereferenceOptions extends ChainResolutionOptions {}

export interface ResolutionOptions extends DereferenceOptions {
    additionalContexts?: JsonLdContexts;
    serviceManagers?: ServiceManager<Service, any>[];
}

export interface ServiceDereferenceOptions extends ResolutionOptions {
    serviceManagers: ServiceManager<Service, any>[];
}

export interface DidUrlDereferenceOptions extends ResolutionOptions {
    omitCredentialStatus: boolean;
}

export type Errors =
    | "notFound"
    | "representationNotSupported"
    | "methodNotSupported"
    | "internalError";

export type DidResolutionResult = ErrorResolutionResult | SuccessfulResolutionResult;

export interface SuccessfulResolutionResult {
    "@context": ["https://w3id.org/did-resolution/v1", ...string[]];
    didResolutionMetadata: SuccessfulMetadata;
    didDocumentStream: DidDocument;
    didDocumentMetadata: DidDocumentMetadata;
}

export interface ErrorResolutionResult {
    "@context": [
        "https://w3id.org/did-resolution/v1",
        "https://www.ssicot.com/did-resolution",
        ...string[]
    ];
    didResolutionMetadata: ErrorMetadata<"invalidDid">;
    didDocumentStream: {};
    didDocumentMetadata: {};
}

export interface DidDocumentMetadata {
    created: string;
    updated: string;
    deactivated: boolean;
}

export type DidUrlDereferenceResult = ErrorDereferenceResult | SuccessfulDereferenceResult;

export type SuccessfulDereferenceResult =
    | AuthenticationDereferenceResult
    | AssertionMethodDereferenceResult
    | ServiceDereferenceResult
    | CredentialStatusDereferenceResult
    | DereferenceResult<DidDocument, DidDocumentMetadata>;

export type AuthenticationDereferenceResult = DereferenceResult<
    WithContext<VerificationMethod>,
    ContentMetadata<ResourceType.AUTHENTICATION>
>;
export type AssertionMethodDereferenceResult = DereferenceResult<
    WithContext<VerificationMethod>,
    ContentMetadata<ResourceType.ASSERTION_METHOD>
>;

export type ServiceDereferenceResult = DereferenceResult<
    WithContext<Service>,
    ContentMetadata<ResourceType.SERVICE>
>;

export type CredentialStatusDereferenceResult = DereferenceResult<
    WithContext<RevocationStatus>,
    ContentMetadata<ResourceType.CREDENTIAL_STATUS>
>;

/*export interface SuccessfulDidDocumentResolution {
    "@context": "https://w3id.org/did-resolution/v1";
    dereferencingMetadata: SuccessfulMetadata;
    contentStream: DidDocument;
    contentMetadata: DidDocumentMetadata
}*/

/*

// dereferencingMetadata: As others
// contentStream: JSON-LD DID document
// contentMetadata: didDocumentMetadata

 */

// (dereferencingMetadata, contentStream, contentMetadata)
// dereferencingMetadata:
//  contentType?: ....,
//   error?: invalidDidUrl | notFound
// contentStream: JSON-LD object
// contentMetadata: any because it is not a DID document

export interface DereferenceResult<T, M> {
    "@context": ["https://w3id.org/did-resolution/v1", ...string[]];
    dereferencingMetadata: SuccessfulMetadata;
    contentStream: T;
    contentMetadata: M;
}

export interface ErrorDereferenceResult {
    "@context": [
        "https://w3id.org/did-resolution/v1",
        "https://www.ssicot.com/did-resolution",
        ...string[]
    ];
    dereferencingMetadata: ErrorMetadata<"invalidDidUrl">;
    contentStream: {};
    contentMetadata: {};
}

export type ChainResolutionResult = SuccessfulChainResolutionResult | ErrorChainResolutionResult;

export interface SuccessfulChainResolutionResult {
    "@context": ["https://www.ssicot.com/chain-resolution", ...string[]];
    resolutionMetadata: SuccessfulMetadata;
    chainStream: TrustCertificationChain;
    chainMetadata: {};
}

export interface ErrorChainResolutionResult {
    "@context": [
        "https://www.ssicot.com/chain-resolution",
        "https://www.ssicot.com/did-resolution",
        ...string[]
    ];
    resolutionMetadata: ErrorMetadata<"invalidDid">;
    chainStream: {};
    chainMetadata: {};
}

export interface SuccessfulMetadata {
    contentType: "application/did+ld+json";
}

export interface ErrorMetadata<T extends string> {
    error: T | Errors;
    errorMessage: string;
}

export interface ContentMetadata<R extends ResourceType> {
    resourceType: R;
}

export interface TrustCertificationChain {
    "@context": [
        "https://www.ssicot.com/chain-resolution",
        "https://www.ssicot.com/did-document",
        ...string[]
    ];
    trustChain: TrustCertification[];
}

export enum ResourceType {
    AUTHENTICATION,
    ASSERTION_METHOD,
    SERVICE,
    CREDENTIAL_STATUS
}
