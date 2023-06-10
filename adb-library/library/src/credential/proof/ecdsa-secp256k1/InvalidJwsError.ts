export class InvalidJwsError extends Error {
    constructor(message: string, cause?: unknown) {
        super(message, {
            cause
        });
    }
}
