import { Collection, MessageAttachment, StickerResolvable } from "discord.js-selfbot-v13";
import { basename } from "path";
import chalk from "chalk";

import { OpenAIChatFunction, OpenAIChatFunctionCall, OpenAIChatFunctionParameter } from "../../api/chat/types/function.js";
import { AIEnvironment } from "../types/environment.js";
import { ChatMessage } from "../../api/chat/types/chat.js";
import { AIMessage } from "../types/history.js";
import { Utils } from "../../util/utils.js";
import { AIManager } from "../manager.js";

export type PluginParameter = Omit<OpenAIChatFunctionParameter, "required"> & {
    required?: boolean;
}

interface PluginData<Input> {
    /** Name of the plugin */
    name: string;

    /** Description of the plugin */
    description: string;

    /* Trigger words for this plugin */
    triggers: (string | RegExp)[];

    /** Parameters of the plugin */
    parameters: Record<keyof Input, PluginParameter> | null;
}

export interface PluginRunOptions<Input> {
    environment: AIEnvironment;
    data: Input;
}

export type PluginResponse<T> = Promise<PluginRawResponse<T> | void>

export type PluginRawResponse<T = any> = {
    /** Data to pass to the AI again */
    data?: T;

    /** Additional instructions to give to the AI */
    instructions?: string;

    /** Stickers to send */
    stickers?: StickerResolvable[];

    /** Attachments to send */
    attachments?: MessageAttachment[];

    /** Whether the result can instantly be sent */
    instant?: boolean;
}

export interface PluginResultData {
    input: object;
    result: Required<Omit<PluginRawResponse, "instructions">> & Pick<PluginRawResponse, "instructions">;
    error: Error | null;
    plugin: Plugin;
}

export abstract class Plugin<Input = any, Output = any> {
    protected readonly ai: AIManager;

    /** Information about the plugin & its parameters */
    public readonly options: PluginData<Input>;

    constructor(ai: AIManager, options: PluginData<Input>) {
        this.ai = ai;
        this.options = options;
    }

    /**
     * Execute the function with the given parameters, and return a result.
     * @param options Options to pass to the plugin, like environment information & the input data
     * 
     * @returns Data to pass to the AI again, as the function result
     */
    public abstract run(options: PluginRunOptions<Input>): PluginResponse<Output>;
}

export class PluginManager {
    private ai: AIManager;

    /** Collection of all plugins */
    private readonly plugins: Collection<string, Plugin>;

    constructor(manager: AIManager) {
        this.ai = manager;
        this.plugins = new Collection();
    }

    private hasTriggeredPlugin(message: AIMessage, plugin: Plugin): boolean {
        if (Math.random() > 0) return true;
        
        for (const trigger of plugin.options.triggers) {
            if (typeof trigger === "object") {
                const matches = Array.from(message.content.matchAll(trigger));
                if (matches.length > 0) return true;

            } else if (typeof trigger === "string" && message.content.includes(trigger)) return true; 
        }

        return false;
    }

    public triggeredPlugins(environment: AIEnvironment): Plugin[] {
        const all = Array.from(this.plugins.values());
        const arr: Plugin[] = [];

        for (const message of environment.history.messages) {
            for (const plugin of all) {
                if (this.hasTriggeredPlugin(message, plugin) && !arr.find(p => p.options.name === plugin.options.name)) {
                    arr.push(plugin);
                }
            }
        }

        return arr;
    }

    /**
     * Execute all of the specified plugins & get back their results.
     * @param map function name -> parameters map
     * 
     * @returns An object with each 
     */
    public async execute(environment: AIEnvironment, { name, data }: OpenAIChatFunctionCall): Promise<PluginResultData | null> {
        /* Try to get the specified plugin. */
        const plugin = this.get(name);

        if (plugin === null) {
            this.ai.app.logger.warn(`Tried to call non-existent function ${chalk.bold(name)}.`);
            return null;
        }

        /* Try to execute the plugin & save its result. */
        try {
            const result = await plugin.run({
                environment, data
            });

            if (!result) return {
                plugin, error: null, input: data, result: {
                    data: "Success", attachments: [], stickers: [], instant: false
                }
            };

            return {
                plugin, error: null, input: data, result: {
                    attachments: result.attachments ?? [],
                    stickers: result.stickers ?? [],
                    instant: result.instant ?? false,

                    instructions: result.instructions,
                    data: result.data ?? "Success"
                }
            };

        } catch (err) {
            const error = err as Error;

            return {
                plugin, error, input: data, result: {
                    data: `"The action I (the human-like bot) tried to run failed with this error: ${error.toString()}\n I will try to incorporate this failure into my response naturally but never say the error messaage directly.`,
                    attachments: [], stickers: [], instant: false
                }
            };
        }
    }
    
    public asOpenAIFunctionCall(result: PluginResultData): ChatMessage {
        return {
            role: "function",
            name: result.plugin.options.name,
            content: JSON.stringify(result.result.data)
        };
    }

    public asOpenAIFunctions(plugins: Plugin[]): OpenAIChatFunction[] {
        const functions: OpenAIChatFunction[] = [];

        for (const p of Array.from(plugins.values())) {
            const empty: boolean = p.options.parameters === null || Object.keys(p.options.parameters).length === 0;
            const parameters: Record<string, OpenAIChatFunctionParameter> = {};

            /* Required parameters */
            const required: string[] = [];

            if (!empty) for (const [ key, param ] of Object.entries(p.options.parameters!)) {
                if (param.required) required.push(key);
                delete param.required;

                parameters[key] = param as OpenAIChatFunctionParameter;
            }

            functions.push({
                name: p.options.name, description: p.options.description,
                parameters: {
                    type: "object", properties: parameters, required
                }
            });
        }

        return functions;
    }

    public extractFunctionCall(message: ChatMessage): OpenAIChatFunctionCall | null {
        /* If the response contains a properly formatted function call, ... */
        if (message.function_call) {
            return {
                name: message.function_call.name,
                data: JSON.parse(message.function_call.arguments)
            };
        }

        if (message.content.startsWith("functions.")) {
            const lines = message.content.split("\n");

            /* Name of the function to execute */
            const name: string = lines.shift()!.replaceAll("functions.", "").trim();

            try {
                /* Data to pass to the function */
                const data: object = JSON.parse(lines.join("\n"));
                return { name, data };

            } catch (_) {
                return null;
            }
        }

        return null;
    }

    public get<T extends Plugin = Plugin>(name: string): T | null {
        return this.plugins.get(name) as T ?? null;
    }

    public async load(): Promise<void> {
        const files: string[] = await Utils.search("./build/ai/plugins");
        
        await Promise.all(files.map(async path => {
            /* Name of the plugin */
            const name: string = basename(path).split(".")[0];

            await import(path)
                .then((data: { [key: string]: Plugin }) => {
                    const plugin: Plugin = new (data.default as any)(this.ai);
                    this.plugins.set(plugin.options.name, plugin);
                })
                .catch(error => this.ai.app.logger.warn("Failed to load plugin", chalk.bold(name), "->", error));
        }));

        this.ai.app.logger.debug("Loaded", chalk.bold(this.plugins.size), "plugins.");
    }
}