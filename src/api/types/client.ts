import { Awaitable } from "discord.js-selfbot-v13";
import z from "zod";

import { VectorEntry, VectorInput, VectorResult, VectorSearchOptions } from "./vector.js";
import { SearchQueryData, SearchQueryOptions } from "./search.js";
import { ChatRequest, ChatResult } from "./chat.js";
import { App } from "../../app.js";

export const APIClientTypes = [ "chat", "vector", "search" ] as const
export type APIClientType = typeof APIClientTypes[number]

interface APIClientData<T extends APIClientSettings> {
    /** Type of client */
    type: APIClientType;

    /** Name of the client */
    name: string;

    /** Schema for this API's settings  */
    settings: z.ZodType<T>;
}

const APIClientSettingsSchema = z.record(z.string(), z.any())
type APIClientSettings = z.infer<typeof APIClientSettingsSchema>

export interface APIClientValidateOptions<T> {
    data: T;
    ctx: z.core.$RefinementCtx;
}

export abstract class APIClient<Settings extends APIClientSettings = APIClientSettings> {
    protected readonly app: App;

    /** Information about the plugin & its parameters */
    public readonly options: APIClientData<Settings>;

    constructor(app: App, options: APIClientData<Settings>) {
        this.app = app;
        this.options = options;
    }

    public load(): Awaitable<void> {}
    public validate(options: APIClientValidateOptions<Settings>) {}

    public get settings(): Settings {
        return this.app.config.data.api[this.options.type].settings;
    }
}

export abstract class ChatAPIClient<Settings extends APIClientSettings = APIClientSettings> extends APIClient<Settings> {
    constructor(app: App, name: string, settings: z.ZodType<Settings>) {
        super(app, {
            type: "chat", name, settings
        });
    }
    
    public abstract run(options: ChatRequest): Promise<ChatResult>;
}

export abstract class VectorAPIClient<Settings extends APIClientSettings = APIClientSettings> extends APIClient<Settings> {
    constructor(app: App, name: string, settings: z.ZodType<Settings>) {
        super(app, {
            type: "vector", name, settings
        });
    }

    public abstract insert<T>(values: VectorInput<T>[]): Promise<VectorEntry<T>[]>;
    public abstract search<T>(options: VectorSearchOptions<T>): Promise<VectorResult<T>[]>;
}

export abstract class SearchAPIClient<Settings extends APIClientSettings = APIClientSettings> extends APIClient<Settings> {
    constructor(app: App, name: string, settings: z.ZodType<Settings>) {
        super(app, {
            type: "search", name, settings
        });
    }

    public abstract search(options: SearchQueryOptions): Promise<SearchQueryData>;
}