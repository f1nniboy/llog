import {
    Collection,
    MessageAttachment,
    StickerResolvable,
} from "discord.js-selfbot-v13"
import chalk from "chalk"
import {
    ChatInputMessage,
    ChatInputTool,
    ChatInputToolCall,
    ChatInputToolParameter,
} from "../../api/types/chat.js"
import { AIEnvironment } from "../types/environment.js"
import { loadInstances } from "../../util/load.js"
import { AIMessage } from "../types/history.js"
import { AIManager } from "../manager.js"

export type PluginParameter = Omit<ChatInputToolParameter, "required"> & {
    required?: boolean
}

interface PluginData<Input> {
    /** Name of the plugin */
    name: string

    /** Description of the plugin */
    description: string

    /* Trigger words for this plugin, always available if no triggers are specified */
    triggers?: (string | RegExp)[]

    /** Parameters of the plugin */
    parameters: Record<keyof Input, PluginParameter> | null
}

export interface PluginRunOptions<Input> {
    environment: AIEnvironment
    data: Input
}

export interface PluginCheckOptions {
    environment: AIEnvironment
}

export type PluginResponse<T extends object | string> =
    Promise<PluginRawResponse<T> | void>

export type PluginRawResponse<T extends object | string = string> = {
    /** Data to pass to the AI again */
    data?: T | string

    /** Stickers to send */
    stickers?: StickerResolvable[]

    /** Attachments to send */
    attachments?: MessageAttachment[]
}

export interface PluginResultData {
    id: string
    input: object
    result: PluginRawResponse
    error?: Error
    plugin: Plugin
}

export abstract class Plugin<
    Input extends object = object,
    Output extends object | string = string,
> {
    protected readonly ai: AIManager

    /** Information about the plugin & its parameters */
    public readonly options: PluginData<Input>

    constructor(ai: AIManager, options: PluginData<Input>) {
        this.ai = ai
        this.options = options
    }

    /**
     * Execute the function with the given parameters, and return a result.
     * @param options Options to pass to the plugin, like environment information & the input data
     *
     * @returns Data to pass to the AI again, as the function result
     */
    public abstract run(
        options: PluginRunOptions<Input>,
    ): PluginResponse<Output>

    /**
     * Check whether a given plugin is available to be used.
     * @returns Whether the plugin is available
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public check(options: PluginCheckOptions): boolean {
        return true
    }
}

export class PluginManager {
    private ai: AIManager

    private readonly plugins: Collection<string, Plugin>

    constructor(manager: AIManager) {
        this.ai = manager
        this.plugins = new Collection()
    }

    private hasTriggeredPlugin(
        environment: AIEnvironment,
        message: AIMessage,
        plugin: Plugin,
    ): boolean {
        const feat = this.ai.app.config.feature("plugins")

        if (
            feat.settings.blacklist.includes(plugin.options.name) ||
            !plugin.check({ environment })
        )
            return false

        if (!plugin.options.triggers || plugin.options.triggers.length == 0)
            return true

        for (const trigger of plugin.options.triggers) {
            if (typeof trigger == "object") {
                const matches = Array.from(message.content.matchAll(trigger))
                if (matches.length > 0) return true
            } else if (
                typeof trigger == "string" &&
                message.content.includes(trigger)
            )
                return true
        }

        return false
    }

    public triggeredPlugins(environment: AIEnvironment): Plugin[] {
        const feat = this.ai.app.config.feature("plugins")
        if (!feat.enable) return []

        const all = Array.from(this.plugins.values())
        const arr: Plugin[] = []

        for (const message of environment.history.messages) {
            for (const plugin of all) {
                if (
                    this.hasTriggeredPlugin(environment, message, plugin) &&
                    !arr.find((p) => p.options.name == plugin.options.name)
                ) {
                    arr.push(plugin)
                }
            }
        }

        return arr
    }

    public async executeAll(
        environment: AIEnvironment,
        calls: ChatInputToolCall[],
    ): Promise<PluginResultData[]> {
        const results: PluginResultData[] = []

        for (const call of calls) {
            const result = await this.execute(environment, call)
            if (result) results.push(result)
        }

        return results
    }

    /**
     * Execute all of the specified plugins & get back their results.
     * @param map function name -> parameters map
     *
     * @returns An object with each
     */
    private async execute(
        environment: AIEnvironment,
        { id, name, data }: ChatInputToolCall,
    ): Promise<PluginResultData | undefined> {
        /* Try to get the specified plugin */
        const plugin = this.get(name)

        if (!plugin) {
            this.ai.app.logger.warn(
                `Tried to call non-existent tool ${chalk.bold(name)}.`,
            )
            return
        }

        /* Try to execute the plugin & save its result */
        try {
            const result = await plugin.run({
                environment,
                data,
            })

            if (!result)
                return {
                    plugin,
                    id,
                    input: data,
                    result: {},
                }

            return {
                plugin,
                id,
                input: data,
                result,
            }
        } catch (err) {
            const error = err as Error

            return {
                plugin,
                error,
                id,
                input: data,
                result: {
                    data: `"The action I tried to run failed with this error: ${error.toString()}`,
                },
            }
        }
    }

    public asAPIToolResult(results: PluginResultData[]): ChatInputMessage {
        return {
            role: "tool",
            content: [],
            toolResults: results.map((r) => ({
                name: r.plugin.options.name,
                id: r.id,
                data: r.result.data ?? "Success",
                error: r.error != undefined,
            })),
        }
    }

    public asAPITools(plugins: Plugin[]): ChatInputTool[] {
        const tools: ChatInputTool[] = []

        for (const p of Array.from(plugins.values())) {
            const empty: boolean =
                p.options.parameters == null ||
                Object.keys(p.options.parameters).length == 0
            const parameters: Record<string, ChatInputToolParameter> = {}

            /* Required parameters */
            const required: string[] = []

            if (!empty)
                for (const [key, param] of Object.entries<PluginParameter>(
                    p.options.parameters!,
                )) {
                    if (param.required) required.push(key)
                    delete param.required

                    parameters[key] = param as ChatInputToolParameter
                }

            tools.push({
                name: p.options.name,
                description: p.options.description,
                parameters: {
                    type: "object",
                    properties: parameters,
                    required,
                },
            })
        }

        return tools
    }

    public get<T extends Plugin = Plugin>(name: string) {
        return this.plugins.get(name) as T | undefined
    }

    public async load(): Promise<void> {
        await loadInstances<Plugin>(
            "./build/ai/plugins",
            (cls) => new cls(this.ai),
            (cls) => this.plugins.set(cls.options.name, cls),
        )

        this.ai.app.logger.info(
            "Loaded",
            chalk.bold(this.plugins.size),
            "plugins.",
        )
    }
}
