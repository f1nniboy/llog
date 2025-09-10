import { readFile, watch } from "fs/promises";
import z, { ZodError } from "zod";
import chalk from "chalk";
import JSON5 from "json5";

import { APIClientTypes } from "./api/types/client.js";
import { ChanceTypes } from "./ai/types/chance.js";
import { ConfigError } from "./error/config.js";
import { App } from "./app.js";

export const ConfigSchema = z.object({
    discord: z.object({
        token: z.string(),
    }),

    api: z.record(z.enum(APIClientTypes), z.object({
        client: z.string(),
        settings: z.any(),
    })),

    history: z.object({
        length: z.number(),
    }),

    memory: z.object({
        length: z.number(),
    }),

    plugins: z.object({
        blacklist: z.array(z.string()).optional(),
    }),

    features: z.record(
        z.enum([ "users", "plugins" ]),
        z.boolean()
    ),

    chances: z.record(z.enum(ChanceTypes), z.number().lt(1, {
        error: "Chance can't be higher than 1"
    })),

    blacklist: z.record(
        z.enum([ "guilds", "users" ]),
        z.array(z.string()).optional()
    ).optional(),

    nickname: z.union([
        z.array(z.string()),
        z.string(),
        z.undefined()
    ]),

    personality: z.object({
        tone: z.string().optional(),
        persona: z.string().optional(),
    }),
});

export type ConfigType = z.infer<typeof ConfigSchema>;

interface LoadConfigOptions {
    reload?: boolean;
    fatal?: boolean;
}

export class Config {
    private readonly app: App;

    /** The actual config JSON data */
    private _data?: ConfigType;

    private lastTimestamp?: number;

    constructor(app: App) {
        this.app = app;
        this.watch();
    }

    public async load({ reload, fatal }: LoadConfigOptions = {}): Promise<void> {
        const now = Date.now();

        /* Fix this.load() being called twice */
        if (now - (this.lastTimestamp ?? 0) < 500) return;
        this.lastTimestamp = now;

        try {
            const raw = (await readFile(this.path)).toString();
            const newData = JSON5.parse(raw);

            /* If no configuration changes were detected when reloading, simply abort */
            if (reload && this._data && this.compare(this._data, newData)) return;

            const error = await this.validate(newData);
            if (error) throw ConfigError.fromZod(error);

            this.app.logger.debug(`${reload ? "Reloaded" : "Loaded"} configuration ${chalk.bold(this.path)}.`);
            this._data = newData;

        } catch (error) {
            if (error instanceof SyntaxError) {
                const { lineNumber, columnNumber } = error as any;
                this.app.logger.error(`Configuration ${chalk.bold(this.path)} contains syntax error at ${chalk.bold(lineNumber)}:${chalk.bold(columnNumber)} ->`, error.message);

            } else if (error instanceof ConfigError) {
                this.app.logger.error("Failed to load configuration,", error.toString());
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

    private async validate(data: ConfigType): Promise<ZodError | undefined> {
        let error: ZodError | undefined = ConfigSchema.safeParse(data)?.error;
        if (error) return error;

        error = await this.app.api.validateAll(data);
        if (error) return error;
    }

    private compare(a: ConfigType, b: ConfigType) {
      return JSON.stringify(a) == JSON.stringify(b);
    }

    public get data(): ConfigType {
        if (!this._data) throw new Error("Configuration has not been loaded yet");
        return this._data;
    }

    private get path(): string {
        if (process.env.CONFIG_FILE) return process.env.CONFIG_FILE;
        else return "./src/config.json5";
    }
}