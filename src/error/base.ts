export enum AIErrorType {
    /** An error occurred during the generation of a response */
    Generation = "Generation",

    /** An error occurred with a request to the API */
    API = "API",

    /** An error occurred while loading the configuration */
    Config = "Config",

    /** Any other miscellaneous error occurred */
    Other = "Other",
}

/** Extended data of the error */
export type AIErrorData<T> = T

export interface AIErrorOptions<T> {
    /** Which type of error occurred */
    type: AIErrorType;

    /** Data of the error message */
    data: AIErrorData<T>;
}

export class AIError<T> extends Error {
    public options: AIErrorOptions<T>;

    constructor(opts: AIErrorOptions<T>) {
        super();
        this.options = opts;
    }

    public get name(): string { return this.constructor.name; }
    public get message(): string { return this.toString(); }

    public toString(): string {
        return "AI error";
    }
}