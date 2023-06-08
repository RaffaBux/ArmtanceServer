# `ssi-cot-eth` DID resolution library

This library acts as a DID resolver for the `ssi-cot-eth` DID method. For additional details
about how the library works, see [did-method-specification.md](../did-method-specification.md).

## Build the library

To build the library, you need to install the following development dependencies:

-   `@types/bn.js`;
-   `@types/jsonld`;
-   `@types/node`
-   `ethereum-abi-types-generator`
-   `typescript`

and you need to install the following runtime dependencies:

-   `jsonld`
-   `web3`

If you are using NPM, you can execute the following two commands to install all the required
dependencies:

```shell
npm install jsonld web3
npm install --save-dev @types/bn.js @types/jsonld @types/node ethereum-abi-types-generator typescript
```
