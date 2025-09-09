import type { Snowflake } from "discord.js-selfbot-v13";
import type { DeepPartial } from "tsdef";

import { readFile, watch } from "fs/promises";
import chalk from "chalk";
import JSON5 from "json5";

import type { ChanceType } from "./ai/types/chance.js";
import type { ModelType } from "./ai/types/model.js";
import type { App } from "./app.js";

import { ConfigError } from "./error/config.js";
import { APIClientType } from "./api/types/client.js";

interface ConfigChatAPI {
    baseUrl?: string;
    key: string;
    temperature?: number;
}

interface ConfigVectorAPI {
    key: string;
}

export interface ConfigJSON {
    discord: {
        /** The token of the Discord account to use as a self-bot */
        token: string;
    }

    api: Record<APIClientType, {
        client: string;
        settings: any;
    }>;

    models: Record<ModelType, string | undefined>;

    history: {
        /** How many messages to fetch for the chat history */
        length: number;
    };

    memory: {
        /** How many memories to fetch for an interaction */
        length: number;
    };

    plugins: {
        /** Which plugins to fully disable */
        blacklist: string[];
    };

    features: {
        /** Should a list of users in the chat history be given to the bot */
        users: boolean;

        /** Should the bot be able to interact with various tools */
        // TODO: actually toggle in code
        plugins: boolean;
    };

    /** Chances of various events occuring */
    chances: Record<ChanceType, number>;

    /** Blacklisted guilds & users */
    blacklist: Record<"guilds" | "users", Snowflake>;

    /** Nicknames of the bot, which trigger it */
    nickname: string[] | string | null;

    /** Various prompts used for the AI */
    prompts: {
        /** The tone of the AI when chatting */
        tone: string | null;

        /** How the AI acts */
        persona: string | null;

        /** Which things the AI is interested in */
        interests: string[];

        /** Which things the AI absolutely dislikes */
        dislikes: string[];
    };
}

interface LoadConfigOptions {
    reload?: boolean;
    fatal?: boolean;
}

export class Config {
    private readonly app: App;

    /* The actual config JSON data */
    private _data?: ConfigJSON;

    constructor(app: App) {
        this.app = app;
        this.watch();
    }

    public api<T extends keyof ConfigJSON["api"]>(name: T): ConfigJSON["api"][T] {
        return this.data.api[name];
    }

    public async load({ reload, fatal }: LoadConfigOptions = {}): Promise<void> {
        try {
            const raw = (await readFile(this.path)).toString();
            const data: any = JSON5.parse(raw);

            /* If no configuration changes were detected when reloading, simply abort */
            if (reload && this._data && JSON.stringify(this._data) === JSON.stringify(data)) return;

            const error = await this.validate(data);
            if (error) throw error;

            this.app.logger.debug(`${reload ? "Reloaded" : "Loaded"} configuration ${chalk.bold(this.path)}.`);
            this._data = data;

        } catch (error) {
            if (error instanceof SyntaxError) {
                const { lineNumber, columnNumber } = error as any;
                this.app.logger.error(`Configuration ${chalk.bold(this.path)} contains syntax error at ${chalk.bold(lineNumber)}:${chalk.bold(columnNumber)} ->`, error.message);

            } else {
                this.app.logger.error("Failed to load configuration", chalk.bold("->"), error);
            }

            if (fatal) throw error;
        }
    }

    public async watch(): Promise<void> {
        const watcher = watch(this.path);

        for await (const _ of watcher) {
            await this.load({ reload: true });
        }
    }

    private async validate(data: DeepPartial<ConfigJSON>): Promise<ConfigError | undefined> {
        /* ... */
        return undefined;
    }

    public get data(): ConfigJSON {
        if (!this._data) throw new Error("Configuration has not been loaded yet");
        return this._data;
    }

    private get path(): string {
        if (process.env.CONFIG_FILE) return process.env.CONFIG_FILE;
        else return "./src/config.json5";
    }
}