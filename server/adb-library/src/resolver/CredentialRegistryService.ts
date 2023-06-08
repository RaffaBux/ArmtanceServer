import {DidResolver} from "./DidResolver";
import {Service, ServiceManager} from "./ServiceTypes";
import {WithContext} from "../utils/JsonLdTypes";

export interface Registries {
    registries: string[];
}

export interface CredentialRegistryService extends Service {
    type: "CredentialRegistry",
    serviceEndpoint: string | Registries;
}

export class CredentialRegistryServiceManager implements ServiceManager<CredentialRegistryService,
    "CredentialRegistry"> {

    public static readonly CREDENTIAL_REGISTRY_CONTEXT = "https://ssi.eecc.de/api/registry/context/credentialregistry";

    public canHandleType(serviceType: string): serviceType is "CredentialRegistry" {
        return serviceType === "CredentialRegistry";
    }

    public async parseEndpoint(
        serviceId: string,
        serviceType: "CredentialRegistry",
        serviceEndpoint: string
    ): Promise<WithContext<CredentialRegistryService>> {
        let endpoint: string | Registries;

        const serviceEndpoints = serviceEndpoint.split("|");
        if (serviceEndpoints.length === 1) {
            endpoint = serviceEndpoints[0] || "";
        } else {
            endpoint = {registries: serviceEndpoints};
        }
        return {
            "@context": [
                DidResolver.DID_DOCUMENT_CONTEXT,
                CredentialRegistryServiceManager.CREDENTIAL_REGISTRY_CONTEXT
            ],
            id: serviceId,
            type: serviceType,
            serviceEndpoint: endpoint
        };
    }

    public async stringifyEndpoint(service: CredentialRegistryService): Promise<string> {
        const serviceEndpoint = service.serviceEndpoint;

        if (CredentialRegistryServiceManager.isRegistry(serviceEndpoint)) {
            return serviceEndpoint.registries.join("|");
        }

        return serviceEndpoint;
    }

    private static isRegistry(serviceEndpoint: string | Registries): serviceEndpoint is Registries {
        return typeof serviceEndpoint !== "string";
    }
}
