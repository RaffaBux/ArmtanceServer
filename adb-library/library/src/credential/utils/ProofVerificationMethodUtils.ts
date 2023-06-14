import {
    AssertionMethodDereferenceResult,
    AuthenticationDereferenceResult,
    CredentialStatusDereferenceResult,
    DereferenceOptions,
    ErrorDereferenceResult
} from "../../resolver/DidResolutionTypes";
import {DidResolver} from "../../resolver/DidResolver";
import {DidUtils} from "../../resolver/DidUtils";

export type ResolutionFunction<T> = (
    didResolver: DidResolver,
    didUrl: string,
    dereferenceOptions: DereferenceOptions
) => Promise<ErrorDereferenceResult | T>;

export class ProofVerificationMethodUtils {
    public static async checkForDereferencingErrors<
        T extends
            | AuthenticationDereferenceResult
            | AssertionMethodDereferenceResult
            | CredentialStatusDereferenceResult,
        E extends Error
    >(
        didResolver: DidResolver,
        didUrl: string,
        resolutionFunction: ResolutionFunction<T>,
        invalidDidUrlErrorMessage: string,
        notFoundErrorMessage: string,
        errorConstructor: {new (message: string): E}
    ): Promise<T> {
        const dereferencingResult = await resolutionFunction(didResolver, didUrl, {
            accept: "application/did+ld+json"
        });

        if (DidUtils.isDereferenceErrored(dereferencingResult)) {
            const dereferencingError = dereferencingResult.dereferencingMetadata.error;
            let errorMessage: string;
            switch (dereferencingError) {
                case "invalidDidUrl":
                    errorMessage = invalidDidUrlErrorMessage;
                    break;
                case "notFound":
                    errorMessage = "The verification method specified in the proof cannot be found";
                    break;
                case "methodNotSupported":
                    const dividedDid = didUrl.split(":");
                    errorMessage = `The DID method 'did:${dividedDid[1]} is not supported`;
                    break;
                default:
                    errorMessage = `Unable to dereference the DID URL '${didUrl}: ${dereferencingResult.dereferencingMetadata.errorMessage}`;
            }
            throw new errorConstructor(errorMessage);
        }

        return dereferencingResult;
    }
}
