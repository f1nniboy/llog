import { AIError, AIErrorType } from "./base.js";

export interface APIErrorData {
    message: string;
}

export type APIErrorOptions<T> = {
    body: { error: APIErrorData } | null;
    endpoint: string;
    code: number;
}

export class APIError<T = any> extends AIError<APIErrorOptions<T>> {
    constructor(opts: APIErrorOptions<T>) {
        super({
            data: opts, type: AIErrorType.API
        });
    }

    public get data(): APIErrorData | null {
        return this.options.data.body ? this.options.data.body.error ?? null : null;
    }

    public toString(): string {
        return `Failed to request API endpoint ${this.options.data.endpoint} with status code ${this.options.data.code}${this.data !== null ? `: ${this.data.message}` : ""}`;
    }
}