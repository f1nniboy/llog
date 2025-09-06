import { Snowflake } from "discord.js-selfbot-v13";
import { readFile, watch } from "fs/promises";
import chalk from "chalk";
import JSON5 from "json5";

import { ChatModel } from "./api/chat/types/chat.js";
import { ChanceType } from "./ai/manager.js";
import { App } from "./app.js";
import { AIError, AIErrorType } from "./error/base.js";
import { ConfigError } from "./error/config.js";

interface ConfigJSON {
    discord: {
        /** The token of the Discord account to use as a self-bot */
        token: string;
    }

    keys: {
        /** OpenAI API key */
        openai: string;

        /** Pinecone API key, optionally used for persistent memory */
        pinecone: string;
    }

    settings: {
        api: {
            /** Base URL of an OpenAI-compatible API */
            baseUrl?: string;

            /** Which chat model to use */
            model: ChatModel;

            /** How creative the AI is */
            temperature?: number;
        };

        history: {
            /** How many messages to fetch for the chat history */
            length: number;
        };

        features: {
            /** Should a list of users in the chat history be given to the bot */
            users: boolean;
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
}

interface LoadConfigOptions {
    reload?: boolean;
    fatal?: boolean;
}

export class Config {
    private readonly app: App;

    /* The actual config JSON data */
    private _data: ConfigJSON | null;

    constructor(app: App) {
        this.app = app;
        this._data = null;

        this.watch();
    }

    public async load({ reload, fatal }: LoadConfigOptions = {}): Promise<void> {
        try {
            const raw = (await readFile(this.path)).toString();
            const data: any = JSON5.parse(raw);

            /* If no configuration changes were detected when reloading, simply abort. */
            if (reload && this._data && JSON.stringify(this._data) === JSON.stringify(data)) return;

            const error = this.validate(data);
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

    private validate(data: ConfigJSON): ConfigError | undefined {
        /* ... */
        return;
    }

    public get data(): ConfigJSON {
        if (this._data === null) throw new Error("Configuration has not been loaded yet");
        return this._data;
    }

    private get path(): string {
        return "./src/config.json5";
    }
}