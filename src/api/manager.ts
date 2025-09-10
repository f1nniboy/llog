import { Collection } from "discord.js-selfbot-v13";
import { basename } from "path";
import chalk from "chalk";

import { APIClient, APIClientType, APIClientTypes, ChatAPIClient, SearchAPIClient, VectorAPIClient } from "./types/client.js";
import { ConfigError } from "../error/config.js";
import { Utils } from "../util/utils.js";
import { App } from "../app.js";
import { ZodError } from "zod";
import { ZodIssueCode } from "zod/v3";
import { ConfigType } from "../config.js";

export class APIManager {
    private readonly app: App;

    private readonly clients: Collection<string, APIClient>;

    constructor(app: App) {
        this.app = app;
        this.clients = new Collection();
    }

    public get chat() {
        return this.get<ChatAPIClient>("chat");
    }

    public get vector() {
        return this.get<VectorAPIClient>("vector");
    }

    public get search() {
        return this.get<SearchAPIClient>("search");
    }

    private get<T extends APIClient>(type: APIClientType): T {
        const name = this.app.config.data.api[type].client;
        return this.clients.get(name) as T;
    }

    public async validateAll(data: ConfigType) {
        for (const type of APIClientTypes) {
            const name = data.api[type].client;
            const client = this.clients.get(name);

            if (!client) return new ZodError([ {
                code: ZodIssueCode.custom,
                message: "Client doesn't exist",
                path: [ "api", type, "client" ]
            } ]);

            if (client.options.type != type) return new ZodError([ {
                code: ZodIssueCode.custom,
                message: "Invalid client for API type",
                path: [ "api", type, "client" ]
            } ]);

            const error = await this.validate(client, data);
            if (error) return error;
        }
    }

    private async validate(client: APIClient, data: ConfigType): Promise<ZodError | undefined> {
        const result = await client.options.settings
            .superRefine((data, ctx) => client.validate({ data, ctx }))
            .safeParseAsync(data.api[client.options.type]?.settings);

        if (result.error) for (const i of result.error.issues) {
            i.path.unshift("api", client.options.type, "settings");
        }

        return result.error;
    }

    public async load() {
        for (const client of this.clients.values()) {
            try {
                await client.load();
            } catch (error) {
                this.app.logger.error("Failed to load API client", chalk.bold(client.options.name), "->", error);
                return false;
            }
        }

        this.app.logger.debug("Loaded", chalk.bold(this.clients.size), "API clients.");
        return true;
    }

    public async init() {
        const files = await Utils.search("./build/api/clients");
        
        await Promise.all(files.map(async path => {
            const name = basename(path).split(".")[0];

            await import(path)
                .then((data: { [key: string]: APIClient }) => {
                    const client: APIClient = new (data.default as any)(this.app);
                    this.clients.set(client.options.name, client);
                })
                .catch(error => this.app.logger.warn("Failed to load API client", chalk.bold(name), "->", error));
        }));
    }
}