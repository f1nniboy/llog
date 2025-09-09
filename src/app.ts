import { Client } from "discord.js-selfbot-v13";
import { basename } from "path";
import chalk from "chalk";

import { TaskManager } from "./tasks/index.js";
import { APIManager } from "./api/manager.js";
import { AIManager } from "./ai/manager.js";
import { Event } from "./events/index.js";
import { Logger } from "./util/logger.js";
import { Utils } from "./util/utils.js";
import { Config } from "./config.js";
import { randomUUID } from "crypto";

export class App {
    public readonly client: Client<true>;

    public readonly config: Config;
    public readonly logger: Logger;

    public readonly task: TaskManager;
    public readonly api: APIManager;
    public readonly ai: AIManager;

    constructor() {
        this.config = new Config(this);

        this.task = new TaskManager(this);
        this.api = new APIManager(this);
        this.ai = new AIManager(this);
        this.logger = new Logger();


        this.client = new Client({
            ws: {
                properties: { browser: "Discord iOS" }
            },

            presence: { status: "online" }
        });
    }

    public async setup(): Promise<void> {
        try {
            await this.config.load({ fatal: true });
        } catch (error) {
            return process.exit(1);
        };

        await Utils.search("./build/events")
            .then(files => files.forEach(path => {
                const name: string = basename(path).split(".")[0];

                import(path)
                    .then((data: { [key: string]: Event }) => {
                        const event: Event = new (data.default as any)(this);
                        
                        this.client.on(name, async (...args: any[]) => {
                            try {
                                await event.run(...args as any);
                            } catch (error) {
                                this.logger.error("Failed to run event", chalk.bold(name), "->", error);
                            }
                        });
                    })
                    .catch(error => this.logger.warn("Failed to load event", chalk.bold(name), "->", error));
            }));

        await this.api.load();
        await this.task.load();
        await this.ai.load();

        await this.client.login(this.config.data.discord.token);
    }

    public get name() {
        return this.client.user.username;
    }

    public get id() {
        return this.client.user.id;
    }
}