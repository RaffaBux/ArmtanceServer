import {InvalidArgumentError} from "../utils/InvalidArgumentError";
import {
    AssertionMethodDereferenceResult,
    AuthenticationDereferenceResult,
    ChainResolutionResult,
    CredentialStatusDereferenceResult,
    DereferenceResult,
    DidDocumentMetadata,
    DidResolutionResult,
    DidUrlDereferenceResult,
    ErrorChainResolutionResult,
    ErrorDereferenceResult,
    ErrorResolutionResult,
    ResourceType,
    ServiceDereferenceResult,
    SuccessfulDereferenceResult
} from "./DidResolutionTypes";
import {DidDocument, DidUrl} from "./DidTypes";

export class DidUtils {
    public static isValidUrl(url: string) {
        return this.parseUrl(url) !== null;
    }

    public static isValidDid(did: string, chainId: number): boolean {
        if (this.isValidDidMethod(did)) {
            const remaining = did.slice(16).split(":");
            if (remaining.length === 2) {
                return (
                    remaining[0] === `${chainId}` &&
                    (remaining[1] || "").match(/[0-9a-f]{40}/g) !== null
                );
            }
        }
        return false;
    }

    public static isValidDidMethod(did: string): boolean {
        return did.slice(0, 16) === "did:ssi-cot-eth:";
    }

    public static isValidDidUrl(didUrl: DidUrl | null, chainId: number): didUrl is DidUrl {
        return didUrl !== null && DidUtils.isValidDid(didUrl.did, chainId);
    }

    /*
    hash:"#auth-key-1"
    host:""
    hostname:""
    href:"did:ssi-cot-eth:5777:ebfeb1f712ebcdef12345678bc6f1c276e12ec21?service=abc#auth-key-1"
    origin:"null"
    password:""
    pathname:"ssi-cot-eth:5777:ebfeb1f712ebcdef12345678bc6f1c276e12ec21"
    port:""
    protocol:"did:"
    search:"?service=abc"
    searchParams: URLSearchParams {size: 1}
    username:""
     */

    public static parseDidUrl(didUrl: string): DidUrl | null {
        const parsedUrl = this.parseUrl(didUrl);

        if (parsedUrl === null) {
            return null;
        }

        return {
            did: `${parsedUrl.protocol}${parsedUrl.pathname}`,
            query: parsedUrl.searchParams,
            fragment: parsedUrl.hash.slice(1)
        };
    }

    private static parseUrl(url: string): URL | null {
        try {
            return new URL(url);
        } catch (e: unknown) {
            return null;
        }
    }

    public static isResolutionErrored(
        resolutionResult: DidResolutionResult
    ): resolutionResult is ErrorResolutionResult {
        return "error" in resolutionResult.didResolutionMetadata;
    }

    public static isChainResolutionErrored(
        chainResolutionResult: ChainResolutionResult
    ): chainResolutionResult is ErrorChainResolutionResult {
        return "error" in chainResolutionResult.resolutionMetadata;
    }

    public static isDereferenceErrored(
        dereferenceResult: DidUrlDereferenceResult
    ): dereferenceResult is ErrorDereferenceResult {
        return "error" in dereferenceResult.dereferencingMetadata;
    }

    public static isAuthentication(
        dereferenceResult: SuccessfulDereferenceResult
    ): dereferenceResult is AuthenticationDereferenceResult {
        return (
            !this.isDidDocument(dereferenceResult) &&
            dereferenceResult.contentMetadata.resourceType === ResourceType.AUTHENTICATION
        );
    }

    public static isAssertionMethod(
        dereferenceResult: SuccessfulDereferenceResult
    ): dereferenceResult is AssertionMethodDereferenceResult {
        return (
            !this.isDidDocument(dereferenceResult) &&
            dereferenceResult.contentMetadata.resourceType === ResourceType.ASSERTION_METHOD
        );
    }

    public static isService(
        dereferenceResult: SuccessfulDereferenceResult
    ): dereferenceResult is ServiceDereferenceResult {
        return (
            !this.isDidDocument(dereferenceResult) &&
            dereferenceResult.contentMetadata.resourceType === ResourceType.SERVICE
        );
    }

    public static isCredentialStatus(
        dereferenceResult: SuccessfulDereferenceResult
    ): dereferenceResult is CredentialStatusDereferenceResult {
        return (
            !this.isDidDocument(dereferenceResult) &&
            dereferenceResult.contentMetadata.resourceType === ResourceType.CREDENTIAL_STATUS
        );
    }

    public static isDidDocument(
        dereferenceResult: SuccessfulDereferenceResult
    ): dereferenceResult is DereferenceResult<DidDocument, DidDocumentMetadata> {
        return !("resourceType" in dereferenceResult.contentMetadata);
    }

    public static async eip155ToAddress(eip155Address: string) {
        if (!eip155Address.startsWith("eip155:")) {
            throw new InvalidArgumentError(`${eip155Address} is not a valid EIP-155 address`);
        }
        return `0x${eip155Address.slice(-40)}`;
    }
}
