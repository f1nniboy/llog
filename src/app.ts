import { Client } from "discord.js-selfbot-v13";
import { basename } from "path";

import { Event } from "./events/index.js";
import { Logger } from "./util/logger.js";
import { Utils } from "./util/utils.js";
import { Config } from "./config.js";
import chalk from "chalk";

export class App {
    public readonly client: Client<true>;

    public readonly config: Config;
    public readonly logger: Logger;

    constructor() {
        this.config = new Config(this);
        this.logger = new Logger();

        this.client = new Client({
            ws: {
                properties: { browser: "Discord iOS" }
            },

            presence: { status: "online" },
            checkUpdate: false
        });
    }

    public async setup(): Promise<void> {
        /* Load the configuration JSON. */
        await this.config.load();

        /* Register various Discord events. */
        Utils.search("./build/events")
            .then(files => files.forEach(path => {
                /* Name of the event */
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
                    .catch(error => this.logger.warn("Failed to run event", chalk.bold(name), "->", error));
            }));

        /* Connect the Discord client. */
        await this.client.login(this.config.data.discord.token);
    }
}