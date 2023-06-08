import {DataIntegrityProof, ProofPurpose} from "../DataIntegrityProof";

export interface EcdsaSecp256k1Proof extends DataIntegrityProof {
    type: "EcdsaSecp256k1RecoverySignature2020";
    created: string;
    verificationMethod: string;
    proofPurpose: ProofPurpose;
    jws: string;
    domain?: string;
    challenge?: string;
}
