import {WithContext} from "../utils/JsonLdTypes";

export interface Service {
    id: string;
    type: string,
    serviceEndpoint: string | object | string[] | object[];

    [key: string]: any;
}

export interface ServiceManager<S extends Service, T extends string> {
    canHandleType(serviceType: string): serviceType is T;

    stringifyEndpoint(service: S): Promise<string>;

    parseEndpoint(
        serviceId: string,
        serviceType: T,
        serviceEndpoint: string
    ): Promise<WithContext<S>>;
}
