import { Collection } from "discord.js-selfbot-v13";
import { basename } from "path";
import chalk from "chalk";

import { APIClient, APIClientType, ChatAPIClient, SearchAPIClient, VectorAPIClient } from "./types/client.js";
import { Utils } from "../util/utils.js";
import { App } from "../app.js";
import { ConfigError } from "../error/config.js";

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
        const name = this.app.config.data.api[type]?.client;
        if (!name) throw new ConfigError({
            message: `Missing settings for ${type} API`,
            key: `api.${type}`
        })

        const client = this.clients.get(name);

        if (!client) throw new ConfigError({
            message: `Invalid client configured for ${type} API`,
            key: `api.${type}.client`
        });

        if (client.options.type != type) throw new ConfigError({
            message: `The client '${client.options.name}' is not usable with ${type} API`,
            key: `api.${type}.client`
        });

        return client as T;
    }

    public async load() {
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

        for (const client of this.clients.values()) {
            await client.load();
        }

        this.app.logger.debug("Loaded", chalk.bold(this.clients.size), "API clients.");
    }
}