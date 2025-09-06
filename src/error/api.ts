import { AIError, AIErrorType } from "./base.js";
import { APIPath } from "../api/chat/manager.js";

export type APIErrorType = "server_error"

export interface APIErrorData {
    type: APIErrorType;
    message: string;
}

export type APIErrorOptions<T> = {
    body: { error: APIErrorData } | null;
    endpoint: APIPath;
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