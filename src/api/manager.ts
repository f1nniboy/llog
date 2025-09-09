import { Collection } from "discord.js-selfbot-v13";
import { basename } from "path";
import chalk from "chalk";

import { APIClient, APIClientType, ChatAPIClient, VectorAPIClient } from "./types/client.js";
import { Utils } from "../util/utils.js";
import { App } from "../app.js";

export class APIManager {
    private readonly app: App;

    private readonly clients: Collection<string, APIClient>;

    constructor(app: App) {
        this.app = app;
        this.clients = new Collection();
    }

    public get chat() {
        const client = this.get<ChatAPIClient>("chat");

        if (!client) throw new Error("No chat client available");
        else return client;
    }

    public get vector() {
        const client = this.get<VectorAPIClient>("vector");

        if (!client) throw new Error("No vector client available");
        else return client;
    }

    private get<T extends APIClient>(type: APIClientType): T | undefined {
        const name = this.app.config.data.api[type].client;

        const client = this.clients.get(name);
        if (!client) return;

        if (client.options.type != type) return;
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