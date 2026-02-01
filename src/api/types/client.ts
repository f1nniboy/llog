import { Awaitable } from "discord.js-selfbot-v13"
import z from "zod"
import {
    VectorEntry,
    VectorInput,
    VectorResult,
    VectorSearchOptions,
} from "./vector.js"
import { Embedding, EmbeddingsEmbedOptions } from "./embeddings.js"
import { SearchQueryData, SearchQueryOptions } from "./search.js"
import { ChatRequest, ChatResult } from "./chat.js"
import { App } from "../../app.js"

export const APIClientTypes = [
    "chat",
    "vector",
    "search",
    "embeddings",
] as const
export type APIClientType = (typeof APIClientTypes)[number]

interface APIClientData<T extends APIClientSettings> {
    /** Which types this client implements */
    types: APIClientType[]

    /** Name of the client */
    name: string

    /** Schema for this API's settings  */
    settings?: z.ZodType<T>
}

export const APIClientSettingsSchema = z.record(z.string(), z.any())
export type APIClientSettings = z.infer<typeof APIClientSettingsSchema>

export interface APIClientValidateOptions<T> {
    data: T
    ctx: z.core.$RefinementCtx
}

export type SpecificAPIClient<T extends keyof APIClient> = APIClient &
    Required<Pick<APIClient, T>>

export interface APIClient {
    runPrompt?<T>(options: ChatRequest): Promise<ChatResult<T>>

    insertVector?<T>(values: VectorInput<T>[]): Promise<VectorEntry<T>[]>
    searchVector?<T>(
        options: VectorSearchOptions<T>,
    ): Promise<VectorResult<T>[]>

    getEmbedding?(options: EmbeddingsEmbedOptions): Promise<Embedding>

    searchQuery?(options: SearchQueryOptions): Promise<SearchQueryData>
}

export abstract class APIClient<
    Settings extends APIClientSettings = APIClientSettings,
> {
    protected readonly app: App
    public loaded: boolean

    /** Information about the plugin & its parameters */
    public readonly options: APIClientData<Settings>

    constructor(app: App, options: APIClientData<Settings>) {
        this.app = app
        this.options = options
        this.loaded = false
    }

    public load(): Awaitable<void> {
        this.loaded = true
    }

    public unload(): Awaitable<void> {
        this.loaded = false
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public validate(options: APIClientValidateOptions<Settings>) {}

    public get settings(): Settings {
        return this.app.config.data.api.settings[this.options.name] as Settings
    }

    protected usedFor(type: APIClientType): boolean {
        return this.app.config.data.api.clients[type] == this.options.name
    }

    public handles(type: APIClientType) {
        return this.options.types.includes(type)
    }
}
