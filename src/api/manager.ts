import { Collection } from "discord.js-selfbot-v13"
import { ZodIssueCode } from "zod/v3"
import { ZodError } from "zod"
import chalk from "chalk"
import {
    APIClient,
    APIClientType,
    APIClientTypes,
    SpecificAPIClient,
} from "./types/client.js"
import { loadInstances } from "../util/load.js"
import { ConfigType } from "../config.js"
import { App } from "../app.js"

export class APIManager {
    private readonly app: App

    private readonly clients: Collection<string, APIClient>

    constructor(app: App) {
        this.app = app
        this.clients = new Collection()
    }

    public get chat(): SpecificAPIClient<"runPrompt"> {
        return this.type("chat")
    }

    public get vector(): SpecificAPIClient<"insertVector" | "searchVector"> {
        return this.type("vector")
    }

    public get search(): SpecificAPIClient<"searchQuery"> {
        return this.type("search")
    }

    private type<T extends APIClient>(type: APIClientType): T | null {
        const name = this.app.config.data.api.clients[type]
        if (!name) return null

        return this.clients.get(name) as T
    }

    private get<T extends APIClient>(name: string) {
        return this.clients.get(name) as T
    }

    public async validateAll(data: ConfigType) {
        for (const type of APIClientTypes) {
            const name = data.api.clients[type]
            if (!name) continue

            const client = this.get(name)

            if (!client)
                return new ZodError([
                    {
                        code: ZodIssueCode.custom,
                        message: "Client doesn't exist",
                        path: ["api", "clients", type],
                    },
                ])

            if (!client.handles(type))
                return new ZodError([
                    {
                        code: ZodIssueCode.custom,
                        message: `Client doesn't support API type '${type}'`,
                        path: ["api", "clients", type],
                    },
                ])

            const error = await this.validate(client, data)
            if (error) return error
        }
    }

    private async validate(
        client: APIClient,
        data: ConfigType,
    ): Promise<ZodError | undefined> {
        if (!client.options.settings) return

        const result = await client.options.settings
            .superRefine((data, ctx) => client.validate({ data, ctx }))
            .safeParseAsync(data.api.settings[client.options.name])

        if (result.error)
            for (const i of result.error.issues) {
                i.path.unshift("api", "settings", client.options.name)
            }

        return result.error
    }

    public async loadAll() {
        const set = new Set(Object.values(this.app.config.data.api.clients))

        const clients = Array.from(set)
            .filter((name) => name != null)
            .map((name) => this.get(name))

        const toLoad = clients.filter((c) => !c.loaded)

        const toUnload = this.clients
            .filter((c) => c.loaded && !clients.includes(c))
            .values()
            .toArray()

        /* Unload now disabled clients */
        for (const client of toUnload) {
            await client.unload()
        }

        /* Load newly enabled clients */
        for (const client of toLoad) {
            try {
                await client.load()
            } catch (error) {
                this.app.logger.error(
                    "Failed to load API client",
                    chalk.bold(client.options.name),
                    "->",
                    error,
                )
                return false
            }
        }

        if (toLoad.length > 0)
            this.app.logger.info(
                "Loaded",
                chalk.bold(toLoad.length),
                "API clients.",
            )
        return true
    }

    public async init() {
        await loadInstances<APIClient>(
            "./build/api/clients",
            (cls) => new cls(this.app),
            (cls) => this.clients.set(cls.options.name, cls),
        )
    }
}
