import {EcdsaSecp256k1Proof} from "../credential/proof/ecdsa-secp256k1/EcdsaSecp256k1Proof";
import {CredentialStatus} from "../credential/VerifiableCredential";
import {JsonLdContexts} from "../utils/JsonLdTypes";
import {Service} from "./ServiceTypes";

export interface DidUrl {
    did: string;
    query: URLSearchParams;
    fragment: string;
}

export interface DidDocument {
    "@context": JsonLdContexts;
    id: string;
    authentication: VerificationMethod[];
    assertionMethod?: VerificationMethod[];
    service?: Service[];
    trustCertification?: TrustCertification;
}

export interface VerificationMethod {
    id: string;
    type: "EcdsaSecp256k1RecoveryMethod2020";
    controller: string;
    blockchainAccountId: string;
}

export interface RevocationStatus {
    revoked: boolean;
}

export enum TrustCertificationStatus {
    VALID,
    DEACTIVATED,
    REVOKED
}

export interface TrustCertification {
    issuer: string;
    issuanceDate: Date;
    expirationDate: Date;
    credentialStatus: CredentialStatus;
    certificationStatus: TrustCertificationStatus;
    proof: EcdsaSecp256k1Proof;
}
