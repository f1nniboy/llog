import { BaseGuildTextChannel, Message, TextChannel } from "discord.js-selfbot-v13";
import chalk from "chalk";

import { ChatMessage, ChatMessageContent, OpenAIChatResult, OpenAIUsage } from "../api/chat/types/chat.js";
import { Plugin, PluginManager, PluginResultData } from "./plugins/index.js";
import { AIFormatter, AIFormatterType, AIFormatters } from "./formatter.js";
import { AIChannel, AIEnvironment } from "./types/environment.js";
import { Environment } from "./environment.js";
import { AIMessage } from "./types/history.js";
import { AIMemory, MemoryEntry, MemoryManager } from "./memory.js";
import { Typo } from "../util/typo.js";
import { App } from "../app.js";
import { inspect } from "util";
import { ChatAPI } from "../api/chat/manager.js";
import { ScheduledTask, TaskContext } from "../tasks/index.js";
import { Prompts } from "./prompt.js";

export interface AIResult {
    /** The generated content */
    content: string | null;

    /** Which plugins were used */
    plugins: PluginResultData[];

    /** Token usage for this request */
    usage: OpenAIUsage;
}

interface AIGenerationOptions {
    /** Messages to pass to the model */
    messages: ChatMessage[];

    /** Which plugins to use */
    plugins: Plugin[];

    /** The current Discord environment */
    environment: AIEnvironment;

    /** Memories fitting for this conversation */
    memories: MemoryEntry[];
}

export interface AIProcessOptions {
    channel: AIChannel;
    message?: Message;
    triggered?: boolean;
    type: "chat" | "work";
    task?: ScheduledTask;
}

export const Characters = {
    Splitting: "---",
    Ignore: "-+-",
    Separator: ">>>",
    Self: "<self>"
}

export type ChanceType = "trigger" | "typo" | "reply"

export class AIManager {
    public readonly app: App;

    /* The plugin manager; responsible for loading & managing all plugins */
    public readonly plugin: PluginManager;

    /* The memory manager; responsible for storing and retrieving memories */
    public readonly memory: MemoryManager;

    /* The environment manager; responsible for fetching everything about the guild, channel, history, etc */
    public readonly env: Environment;

    constructor(app: App) {
        this.app = app;

        this.memory = new MemoryManager(this);
        this.plugin = new PluginManager(this);
        this.env = new Environment(this);
    }

    public async load(): Promise<void> {
        await this.plugin.load();
    }

    public async generate({ messages, environment, plugins }: AIGenerationOptions): Promise<AIResult> {
        /*if (Math.random() > 0) {
            return {
                content: "test message",
                plugins: [],
                usage: { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 }
            };
        }*/
        
        const { temperature, model } = this.app.config.data.settings.api;
        const tools = this.plugin.asAPITools(plugins);

        /* First, try to generate a response to the given messages */
        const first = await this.app.api.chat.completions({
            messages, model, temperature,
            tools: tools.length > 0 ? tools : undefined
        });

        /* Whether the given response contains function calls */
        const toolCalls = this.plugin.extractToolCalls(first.message);

        /* If the first generated message doesn't contain any function calls and is a normal reply, return that */
        if (toolCalls.length == 0) return {
            content: ChatAPI.chatMessageToString(first.message.content), usage: first.usage, plugins: []
        };

        /* Try to execute all of the specified plugins */
        const toolResults = await this.plugin.executeAll(environment, toolCalls);

        /* If the current result can simply be ignored & the reply can be sent without any further content, do that */
        if (toolResults.some(r => r.result.instant)) return {
            content: null, plugins: toolResults, usage: first.usage
        };

        /* After executing all requested plugins, send the results back to the AI to generate a response */
        const last = await this.app.api.chat.completions({
            model, temperature, messages: [
                ...messages, first.message,
                
                // TODO: add back the given instructions to the prompt
                /*...execution !== null && execution.result.instructions ? [
                    { role: "system", content: execution.result.instructions } as ChatMessage
                ] : [],*/

                ...toolResults !== null ? toolResults.map(r => this.plugin.asAPIToolCall(r)) : []
            ]
        });

        return {
            content: ChatAPI.chatMessageToString(last.message.content), usage: {
                completion_tokens: first.usage.completion_tokens + last.usage.completion_tokens,
                prompt_tokens: first.usage.prompt_tokens + last.usage.prompt_tokens,
                total_tokens: first.usage.total_tokens + last.usage.total_tokens
            }, plugins: toolResults 
        };
    }

    public async process(options: AIProcessOptions): Promise<void> {
        const { type, channel, message, triggered } = options;

        if (!options.task && !message) return;

        if (
            message && (!message.guildId || !message.member || message.author.bot || message.author.id === this.app.id || !(message.channel instanceof BaseGuildTextChannel))
        ) return;


        /* Add a small random delay, to make the bot feel more human-like */
        if (type == "chat") await this.delay(this.typingDelay());

        const environment = await this.env.fetch(
            channel, triggered ? message : undefined
        );

        const trigger = environment.history.messages[environment.history.messages.length - 1];

        /* Figure out which plugins to use */
        const plugins = this.plugin.triggeredPlugins(environment, type);

        /* Prevent infinite schedule loops */
        if (type == "work") {
            const idx = plugins.findIndex(p => p.options.name == "scheduleTask");
            plugins.splice(idx);
        }

        const memories = type == "chat" ? await this.memory.retrieve({
            query: trigger.content,
            limit: this.app.config.data.settings.memory.length
        }) : [];

        const messages
            = await Prompts[type](this.app, options, environment, memories);

        try {

            const data = await this.generate({
                messages, environment, plugins, memories
            });

            this.app.logger.debug(chalk.bold("Result"), "->", data);

            if (type == "chat") await this.memory.insert({
                environment, trigger, result: data
            });

            /* Final, formatted result */
            const formatted = await this.format(environment, data.content ?? "", "output");

            const chatMessages = Array.from(channel.messages.cache.values());
            const recentMessages = chatMessages.slice(chatMessages.findIndex(m => m.id === trigger.id));

            /* Whether the bot should reply to the trigger message, so that the reply actually makes sense */
            const shouldReply = recentMessages.length > 1;
            let replied = false;

            const parts = formatted
                /* sometimes the AI won't listen */
                .replaceAll("\n", Characters.Splitting)
                /* hack to cut off the ai trying to imitiate the conversation history format */
                .split(Characters.Separator).at(-1)!
                /* split the message into the intended parts by the ai */
                .split(Characters.Splitting)
                .map(l => l.trim())
                //.filter((l, i) => i > 0 ? l.length > 0 && !l.includes(Characters.Ignore) : true)
                .map(l => l.replaceAll(Characters.Ignore, "").trim());

            for (let part of parts) {
                if (data.plugins.length > 0) {
                    for (const plugin of data.plugins) {
                        if (plugin.result.stickers.length + plugin.result.attachments.length + part.length === 0) return;
                    }
                } else {
                    if (part.length === 0) return;
                }

                const result = part;

                const makeTypo = this.chance("typo");
                if (makeTypo && part.length > 0) part = Typo.add(part);

                await this.delay(this.typingDelay());
                if (part.length > 0) await channel.sendTyping();
                await this.delay(this.sendingDelay(part));
                
                const reply = await channel.send({
                    reply: (this.chance("reply") || shouldReply) && !replied && triggered && message ? { messageReference: message, failIfNotExists: false } : undefined,
                
                    files: data.plugins.length > 0 && !replied ? data.plugins.flatMap(r => r.result.attachments ?? []) : undefined,
                    stickers: data.plugins.length > 0 && !replied ? data.plugins.flatMap(r => r.result.stickers ?? []) : undefined,

                    content: part.length > 0 ? part : undefined
                });

                if (makeTypo && result !== part) {
                    await this.delay(this.typingDelay());
                    await reply.edit(result);
                }

                replied = true;
            }

        } catch (error) {
            this.app.logger.error(chalk.bold("An error occured while generation"), "->", error);
            throw error;
        }
    }

    public async format(environment: AIEnvironment, message: string, type: AIFormatterType = "output"): Promise<string> {
        /* Final, formatted output string */
        let final = message;

        for (const pair of AIFormatters.filter(formatter => formatter[type] !== undefined)) {
            const formatter: AIFormatter = pair[type]!;

            const matches = Array.from(final.matchAll(formatter.match));
            if (matches === null || matches.length === 0) continue;

            for (const match of matches) {
                /* Which string actually matched & we want to use */
                const matched = match[0];

                const result: string | null = await formatter.replacer(this, environment, matched);
                if (result !== null) final = final.replace(matched, result);
            }
        }

        return final;
    }

    public toHistoryEntry(message: AIMessage & { index?: number }): string {
        //const date = new Date(message.when);
        //const formattedTime = `${date.getUTCHours().toString().padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")}`;

        // [${formattedTime}]
        // ${message.mentioned ? `[pinged you] ` : ""}

        // ${message.tags.length > 0 ? `${message.tags.map(t => `[${t.name}: ${Array.isArray(t.content) ? t.content.join(", ") : t.content}]`).join(" ")}; ` : ""}

        return `${message.author.name}${message.author.nick ? ` (${message.author.nick})` : ""}${message.replyTo ? ` [reply to ${message.replyTo.author.name}: '${message.replyTo.content}']` : ""}${Characters.Separator}${message.content}`;
    }

    public async toAPIMessage(environment: AIEnvironment, message: AIMessage & { index?: number }) {
        const data: ChatMessage = {
            role: message.self ? "assistant" : "user",
            content: []
        };

        const content: ChatMessageContent[] = [];

        content.push({
            type: "text",
            text: await this.format(environment, this.toHistoryEntry(message), "input")
        });

        if (message.attachments.length > 0) {
            content.push(...message.attachments.map(a => ({
                type: "image_url",
                image_url: {
                    "url": a.url
                }
            }) as ChatMessageContent));
        }
        
        data.content = content;
        return data;
    }

    /** The delay for sending a reply, after it's been generated */
    private sendingDelay(content: string): number {
        return Math.max(2000, content.length * 55) + Math.random() * 1500;
    }

    /** The delay for actually acknowledging a message first & then generating a reply */
    private typingDelay(): number {
        return (Math.random() * 1.5 + 1) * 1000;
    }

    public chance(type: ChanceType): boolean {
        return Math.random() > 1 - this.app.config.data.settings.chances[type];
    }

    public delay(ms: number): Promise<void> {
        // TODO: only for dev
        //return new Promise(resolve => resolve());
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}