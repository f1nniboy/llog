import { AIError, AIErrorType } from "./base.js";

export interface ConfigErrorData {
    key: string;
    message: string;
}

export class ConfigError extends AIError<ConfigErrorData> {
    constructor(opts: ConfigErrorData) {
        super({
            data: opts, type: AIErrorType.Config
        });
    }

    public get data(): ConfigErrorData {
        return this.options.data;
    }

    public toString(): string {
        return `At config key '${this.data.key}': ${this.data.message}`;
    }
}