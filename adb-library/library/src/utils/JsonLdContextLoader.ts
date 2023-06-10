import JsonLd from "jsonld";
import {RemoteDocument, Url} from "jsonld/jsonld-spec";

export type DocumentLoader = (url: Url) => Promise<RemoteDocument>;
export type ChainableContextLoader = (nextLoader: DocumentLoader) => DocumentLoader;

export class JsonLdContextLoader {
    public static readonly DEFAULT_DOCUMENT_LOADER = (url: Url) =>
        JsonLd.documentLoaders.node()(url);

    /*

    private static readonly DID_DOCUMENT_LOADER_FUNCTION =
    private static readonly CHAIN_RESOLUTION_LOADER_FUNCTION =

    private static readonly CERTIFICATION_CREDENTIAL_LOADER_FUNCTION =

    private static readonly DID_RESOLUTION_LOADER_FUNCTION =

    private static readonly REVOCATION_LIST_LOADER_FUNCTION =


    */

    public static concatenateLoaders(
        loaders: ChainableContextLoader[],
        lastDocumentLoader = JsonLdContextLoader.DEFAULT_DOCUMENT_LOADER
    ): DocumentLoader {
        let result = lastDocumentLoader;

        for (const loader of loaders) {
            result = loader(result);
        }

        return result;
    }
}
