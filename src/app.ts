import { Client } from "discord.js-selfbot-v13";
import { basename } from "path";
import chalk from "chalk";

import { VectorAPI } from "./api/vector/manager.js";
import { ChatAPI } from "./api/chat/manager.js";
import { TaskManager } from "./tasks/index.js";
import { AIManager } from "./ai/manager.js";
import { Event } from "./events/index.js";
import { Logger } from "./util/logger.js";
import { Utils } from "./util/utils.js";
import { Config } from "./config.js";

export class App {
    public readonly client: Client<true>;

    public readonly config: Config;
    public readonly logger: Logger;
    public readonly ai: AIManager;
    public readonly task: TaskManager;

    public readonly api: {
        chat: ChatAPI;
        vector: VectorAPI;
    };

    constructor() {
        this.config = new Config(this);

        this.task = new TaskManager(this);
        this.ai = new AIManager(this);
        this.logger = new Logger();

        this.api = {
            chat: new ChatAPI(this),
            vector: new VectorAPI(this)
        };

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

        if (this.api.vector) await this.api.vector.load();

        await this.client.login(this.config.data.discord.token);
        
        await this.task.load();
        await this.ai.load();

        /*await this.task.add({
            time: Date.now() + 1500,
            type: "ai",
            context: {
                channelId: '1413920137869791262',
                guildId: '880075253416603819',
                userId: '747682664135524403',
                instructions: "change your status to mmfg and say something nice"
            }
        });*/

        /*await this.task.add({
            time: Date.now() + 1500,
            type: "deadChat",
            context: {
                channelId: '1413920137869791262',
                guildId: '880075253416603819'
            }
        });*/
    }

    public get name() {
        return this.client.user.username;
    }

    public get id() {
        return this.client.user.id;
    }
}