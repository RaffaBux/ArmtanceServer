import {Url} from "jsonld/jsonld-spec";
import * as Path from "node:path";
import {URL} from "node:url";
import {FileUtils} from "./FileUtils";
import {InvalidArgumentError} from "./InvalidArgumentError";
import {ChainableContextLoader, DocumentLoader} from "./JsonLdContextLoader";

export enum FileContext {
    DID_DOCUMENT_LOADER,
    CHAIN_RESOLUTION_LOADER,
    CERTIFICATION_CREDENTIAL_LOADER,
    DID_RESOLUTION_LOADER,
    REVOCATION_LIST_LOADER
}

export class FileContextLoader {
    private readonly contextsPath: string;

    constructor(contextsPath: string) {
        this.contextsPath = Path.resolve(contextsPath);
    }

    public createContextLoader(fileContext: FileContext): ChainableContextLoader {
        switch (fileContext) {
            case FileContext.DID_DOCUMENT_LOADER:
                return FileContextLoader.createLoader(
                    "https://www.ssicot.com/did-document",
                    this.contextsPath,
                    "did-document.jsonld"
                );
            case FileContext.CHAIN_RESOLUTION_LOADER:
                return FileContextLoader.createLoader(
                    "https://www.ssicot.com/chain-resolution",
                    this.contextsPath,
                    "chain-resolution.jsonld"
                );
            case FileContext.CERTIFICATION_CREDENTIAL_LOADER:
                return FileContextLoader.createLoader(
                    "https://www.ssicot.com/certification-credential",
                    this.contextsPath,
                    "certification-credential.jsonld"
                );
            case FileContext.DID_RESOLUTION_LOADER:
                return FileContextLoader.createLoader(
                    "https://www.ssicot.com/did-resolution",
                    this.contextsPath,
                    "did-resolution.jsonld"
                );
            case FileContext.REVOCATION_LIST_LOADER:
                return FileContextLoader.createLoader(
                    "https://www.ssicot.com/RevocationList2023",
                    this.contextsPath,
                    "revocation-list-2023.jsonld"
                );
            default:
                throw new InvalidArgumentError("Unknown file context");
        }
    }

    private static createLoader(
        contextUrl: string,
        contextsPath: string,
        fileName: string
    ): ChainableContextLoader {
        const parsedUrl = new URL(contextUrl);

        return (nextLoader: DocumentLoader) => async (url: Url) => {
            if (this.areUrlEqual(new URL(url), parsedUrl)) {
                return {
                    // this is for a context via a link header
                    contextUrl: undefined,
                    // this is the actual document that was loaded
                    document: JSON.parse(
                        await FileUtils.readFileContent(Path.resolve(contextsPath, fileName))
                    ),
                    // this is the actual context URL after redirects
                    documentUrl: url
                };
            }
            return nextLoader(url);
        };
    }

    private static areUrlEqual(firstUrl: URL, secondUrl: URL): boolean {
        return firstUrl.href === secondUrl.href;
    }

    /*private static removeTrailingSlash(url: string) {
        if (url.endsWith("/")) {
            return url.slice(-1);
        }
        return url;
    }*/
}
