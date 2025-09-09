import { Awaitable } from "discord.js-selfbot-v13";

import { VectorEntry, VectorInput, VectorResult, VectorSearchOptions } from "./vector.js";
import { ChatRequest, ChatResult } from "./chat.js";
import { App } from "../../app.js";

export type APIClientType =
    "chat" | "vector"

interface APIClientData {
    /** Type of client */
    type: APIClientType;

    /** Name of the client */
    name: string;
}

type APIClientSettings = Record<string, any>

export abstract class APIClient<Settings extends APIClientSettings = any> {
    protected readonly app: App;

    /** Information about the plugin & its parameters */
    public readonly options: APIClientData;

    constructor(app: App, options: APIClientData) {
        this.app = app;
        this.options = options;
    }

    public load(): Awaitable<void> {}

    protected get settings(): Settings {
        return this.app.config.data.api[this.options.type].settings;
    }
}

export abstract class ChatAPIClient<Settings extends APIClientSettings = any> extends APIClient<Settings> {
    constructor(app: App, name: string) {
        super(app, {
            type: "chat", name
        });
    }
    
    public abstract run(options: ChatRequest): Promise<ChatResult>;
}

export abstract class VectorAPIClient<Settings extends APIClientSettings = any> extends APIClient<Settings> {
    constructor(app: App, name: string) {
        super(app, {
            type: "vector", name
        });
    }

    public abstract insert<T>(values: VectorInput<T>[]): Promise<VectorEntry<T>[]>;
    public abstract search<T>(options: VectorSearchOptions): Promise<VectorResult<T>[]>;
}