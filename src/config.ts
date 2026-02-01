import { readFile, watch } from "fs/promises"
import z, { ZodError } from "zod"
import assert from "assert"
import JSON5 from "json5"
import chalk from "chalk"
import { APIClientSettingsSchema, APIClientTypes } from "./api/types/client.js"
import { ChanceTypes } from "./ai/types/chance.js"
import { DelayTypes } from "./ai/types/delay.js"
import { ConfigError } from "./error/config.js"
import { App } from "./app.js"

function setting<T extends object>(t?: z.ZodType<T>) {
    if (!t)
        return z.object({
            enable: z.boolean(),
            settings: z.object({}).default({}),
        })

    return z.object({
        enable: z.boolean(),

        /* hacky way to use defaults if settings object is not specified */
        settings: t.default(t.parse({})),
    })
}

export const ConfigSchema = z.object({
    discord: z.object({
        token: z.string(),
    }),

    api: z.object({
        settings: z.record(z.string(), APIClientSettingsSchema),
        clients: z.record(z.enum(APIClientTypes), z.nullable(z.string())),
    }),

    features: z
        .object({
            memory: setting(
                z.object({
                    length: z.number().default(5),
                }),
            ).describe(
                "Allow the bot to retrieve and store permanent memories by itself, and pass a list of related memories for each interaction",
            ),

            history: setting(
                z.object({
                    length: z.number().default(5),
                    format: z
                        .enum(["unified", "separate"])
                        .default("separate")
                        .describe(
                            "How to pass messages to the model; 'unified' passes all messages as one system prompt, 'separate' passes each message as a separate prompt (may cause issues with models expecting alternating user-assistant messages)",
                        ),
                    groupByAuthor: z
                        .boolean()
                        .default(true)
                        .describe(
                            "Whether messages should be grouped by message author; this allows more messages to fit into the context window",
                        ),
                }),
            ).describe(
                "Pass previous messages in the current channel to the bot",
            ),

            users: setting().describe(
                "Pass a list of all users in the current chat history window to the bot (includes nickname, status, activities, etc.)",
            ),

            plugins: setting(
                z.object({
                    blacklist: z.array(z.string()).default([]),
                }),
            ).describe(
                "Allow the bot to call various tools to update itself or retrieve external information",
            ),

            classify: setting().describe(
                "Classify *all* received messages whether they are related to an existing exchange with the bot; recommended to disable with external APIs due to privacy concerns",
            ),
        })
        .superRefine((data, ctx) => {
            if (data.classify.enable && !data.history.enable)
                ctx.addIssue("'history' is required for 'classify' feature")
        }),

    delays: z
        .record(
            z.enum(DelayTypes),
            z
                .object({
                    min: z.number(),
                    max: z.number(),
                })
                .optional()
                .superRefine((data, ctx) => {
                    if (data && data.min > data.max)
                        ctx.addIssue("min can't be higher than max")
                }),
        )
        .superRefine((data, ctx) => {
            const totalOther = (data.start?.max ?? 0) + (data.typing?.max ?? 0)

            if (data.collector && totalOther > data.collector.max)
                ctx.addIssue(
                    "'collector' delay must be higher than all other delays combined",
                )
        }),

    chances: z.record(
        z.enum(ChanceTypes),
        z.number().lte(1, {
            error: "chance can't be higher than 1",
        }),
    ),

    blacklist: z
        .record(z.enum(["guilds", "users"]), z.array(z.string()).optional())
        .optional(),

    nickname: z.union([z.array(z.string()), z.string(), z.undefined()]),

    personality: z.object({
        tone: z.string().optional(),
        persona: z.string().optional(),
    }),
})

export type ConfigType = z.infer<typeof ConfigSchema>

export type ConfigPath = PropertyKey[]

interface LoadConfigOptions {
    reload?: boolean
    fatal?: boolean
}

export class Config {
    private readonly app: App

    /** The actual config JSON data */
    private _data?: ConfigType

    private lastTimestamp?: number

    constructor(app: App) {
        this.app = app
        this.watch()
    }

    public async load({ reload, fatal }: LoadConfigOptions): Promise<void> {
        const now = Date.now()

        /* Fix this.load() being called twice */
        if (now - (this.lastTimestamp ?? 0) < 500) return
        this.lastTimestamp = now

        try {
            const raw = (await readFile(this.path)).toString()
            const rawData = JSON5.parse(raw)

            /* If no configuration changes were detected when reloading, simply abort */
            if (reload && this._data && this.compare(this._data, rawData))
                return

            const result = await this.validate(rawData)
            if (result.error) throw ConfigError.fromZod(result.error)

            assert(result.data)

            this.app.logger.debug(
                `${reload ? "Reloaded" : "Loaded"} configuration ${chalk.bold(this.path)}.`,
            )
            this._data = result.data

            if (reload) await this.handleChange()
        } catch (error) {
            if (error instanceof SyntaxError) {
                const { lineNumber, columnNumber } = error as unknown as {
                    lineNumber: number
                    columnNumber: number
                }
                this.app.logger.error(
                    `Configuration ${chalk.bold(this.path)} contains syntax error at ${chalk.bold(lineNumber)}:${chalk.bold(columnNumber)} ->`,
                    error.message,
                )
            } else if (error instanceof ConfigError) {
                this.app.logger.error(
                    "Failed to load configuration,",
                    error.toString(),
                )
            } else {
                this.app.logger.error(
                    "Failed to load configuration",
                    chalk.bold("->"),
                    error,
                )
            }

            if (fatal) throw error
        }
    }

    private async handleChange() {
        /* Reload all API clients */
        await this.app.api.loadAll()
    }

    public async watch(): Promise<void> {
        const watcher = watch(this.path)

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of watcher) {
            await this.load({ reload: true })
        }
    }

    private async validate(data: ConfigType): Promise<{
        error?: ZodError | undefined
        data?: ConfigType
    }> {
        const result = ConfigSchema.safeParse(data)

        let error: ZodError | undefined = result?.error
        if (error) return { error }

        error = await this.app.api.validateAll(data)
        if (error) return { error }

        return { data: result.data }
    }

    private compare(a: ConfigType, b: ConfigType) {
        return JSON.stringify(a) == JSON.stringify(b)
    }

    public feature<T extends keyof ConfigType["features"]>(
        name: T,
    ): ConfigType["features"][T] {
        return this.data.features[name]
    }

    public get data(): ConfigType {
        if (!this._data)
            throw new Error("Configuration has not been loaded yet")
        return this._data
    }

    private get path(): string {
        if (process.env.CONFIG_FILE) return process.env.CONFIG_FILE
        else return "./src/config.json5"
    }
}
