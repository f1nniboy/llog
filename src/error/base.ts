export enum AppErrorType {
    /** An error occurred while loading the configuration */
    Config = "Config",

    /** Any other miscellaneous error occurred */
    Other = "Other",
}

/** Extended data of the error */
export type AIErrorData<T> = T

export interface AppErrorOptions<T> {
    /** Which type of error occurred */
    type: AppErrorType

    /** Data of the error message */
    data: AIErrorData<T>
}

export class AppError<T> extends Error {
    public options: AppErrorOptions<T>

    constructor(opts: AppErrorOptions<T>) {
        super()
        this.options = opts
    }

    public get name(): string {
        return this.constructor.name
    }
    public get message(): string {
        return this.toString()
    }

    public toString(): string {
        return "App error"
    }
}
