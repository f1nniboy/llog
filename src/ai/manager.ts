import { Message } from "discord.js-selfbot-v13";
import { inspect } from "util";
import chalk from "chalk";

import { Plugin, PluginManager, PluginResultData } from "./plugins/index.js";
import { AIFormatter, AIFormatterType, AIFormatters } from "./formatter.js";
import { ChatMessage, ChatContentPart } from "../api/types/chat.js";
import { AIChannel, AIEnvironment } from "./types/environment.js";
import { ScheduledTask } from "../tasks/index.js";
import { ChanceType } from "./types/chance.js";
import { Environment } from "./environment.js";
import { AIMessage } from "./types/history.js";
import { ModelType } from "./types/model.js";
import { AIResult } from "./types/result.js";
import { AIMemoryEntry, MemoryManager } from "./memory.js";
import { Typo } from "../util/typo.js";
import { Prompts } from "./prompt.js";
import { App } from "../app.js";
import { ChatAPIClient } from "../api/types/client.js";
import { chatMessageToString } from "../util/chat.js";

type AIGenerationType = "chat" | "work"

interface AIGenerateOptions {
    messages: ChatMessage[];
    plugins: Plugin[];
    environment: AIEnvironment;
    memories?: AIMemoryEntry[];
    type: AIGenerationType;
}

export interface AIGenerateMemoriesOptions {
    environment: AIEnvironment;
    result: AIResult;
}

export interface AIProcessOptions {
    channel: AIChannel;
    message?: Message;
    triggered?: boolean;
    type: AIGenerationType;
    task?: ScheduledTask;
}

export const Characters = {
    Splitting: "---",
    Ignore: "-+-",
    Separator: ">>>",
    Self: "<self>"
}

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

    public async generate({ messages, environment, plugins }: AIGenerateOptions): Promise<AIResult> {
        /*if (Math.random() > 0) {
            return {
                content: "test message",
                plugins: [],
                usage: { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 }
            };
        }*/
        
        const tools = this.plugin.asAPITools(plugins);

        /* First, try to generate a response to the given messages */
        let result = await this.app.api.chat.run({
            messages, tools
        });

        const toolResults: PluginResultData[] = [];

        /* If the model chose to call tools, ... */
        if (result.message.tools && result.message.tools.length > 0) {
            /* Try to execute all of the specified plugins */
            toolResults.push(
                ...await this.plugin.executeAll(environment, result.message.tools)
            );

            /* If the current result can simply be ignored & the reply can be sent without any further content, do that */
            if (toolResults.some(r => r.result.instant)) return {
                content: undefined, plugins: toolResults
            };

            /* After executing all requested plugins, send the results back to the AI to generate a response */
            result = await this.app.api.chat.run({
                messages: [
                    ...messages,
                    result.message,
                    ...toolResults !== null ? toolResults.map(r => this.plugin.asAPIToolResult(r)) : []
                ]
            });
        }

        return {
            content: chatMessageToString(result.message),
            plugins: toolResults 
        };
    }

    public async process(options: AIProcessOptions): Promise<void> {
        const { type, channel, message, triggered } = options;

        if (!options.task && !message) return;
        if (message && message.author.id == this.app.id) return;

        /* Add a small random delay, to make the bot feel more human-like */
        if (type == "chat") await this.delay(this.typingDelay());

        const environment = await this.env.fetch(
            channel, triggered ? message : undefined
        );

        const trigger = options.triggered
            ? environment.history.messages[environment.history.messages.length - 1]
            : undefined;

        /* Figure out which plugins to use */
        const plugins = this.plugin.triggeredPlugins(environment);

        /* Prevent infinite schedule loops */
        if (type == "work") {
            const idx = plugins.findIndex(p => p.options.name == "scheduleTask");
            plugins.splice(idx, 1);
        }

        const memories = await this.memory.getRelatedMemories(environment, trigger);

        const messages = await Prompts[type == "work" ? "work" : "chat"](
            this.app, options, environment, memories
        );

        try {
            const data = await this.generate({
                messages, environment, plugins, memories, type
            });
            
            this.app.logger.debug(chalk.bold("Result"), "->", data);
            
            /* Final, formatted result */
            const formatted = await this.format(environment, data.content ?? "", "output");

            const chatMessages = Array.from(channel.messages.cache.values());
            const recentMessages = trigger
                ? chatMessages.slice(chatMessages.findIndex(m => m.id === trigger.id))
                : undefined;

            /* Whether the bot should reply to the trigger message, so that the reply actually makes sense */
            const shouldReply = recentMessages && recentMessages.length > 1;
            let replied = false;

            const parts = formatted
                /* sometimes the AI won't listen and use the proper splitting character */
                .replaceAll("\n", Characters.Splitting)
                /* hack to cut off the ai trying to imitiate the conversation history format */
                .split(Characters.Separator).at(-1)!
                /* split the message into the intended parts by the ai */
                .split(Characters.Splitting)
                .map(l => l.replaceAll(Characters.Ignore, ""))
                .map(l => l.trim())
                .filter(l => !l.includes(Characters.Ignore) && l.length > 0);

            if (parts.length == 0) parts.push("");

            for (let part of parts) {
                if (data.plugins.length > 0) {
                    let totalLength = 0;
                    for (const plugin of data.plugins) {
                        totalLength += plugin.result.stickers.length + plugin.result.attachments.length + part.length;
                    }
                    if (totalLength == 0) return;
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

                const result = await formatter.replacer(this, environment, matched);
                if (result !== null) final = final.replace(matched, result);
            }
        }

        return final;
    }

    public toHistoryEntry(message: Pick<AIMessage, "author" | "replyTo" | "content">): string {
        //const date = new Date(message.when);
        //const formattedTime = `${date.getUTCHours().toString().padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")}`;

        // [${formattedTime}]
        // ${message.mentioned ? `[pinged you] ` : ""}

        // ${message.tags.length > 0 ? `${message.tags.map(t => `[${t.name}: ${Array.isArray(t.content) ? t.content.join(", ") : t.content}]`).join(" ")}; ` : ""}

        return `${message.author.name}${message.author.nick ? ` (${message.author.nick})` : ""}${message.replyTo ? ` [reply to ${message.replyTo.author.name}: '${message.replyTo.content}']` : ""}${Characters.Separator}${message.content}`;
    }

    public async toAPIMessage(environment: AIEnvironment, message: AIMessage) {
        const data: ChatMessage = {
            role: message.self ? "assistant" : "user",
            content: []
        };

        const content: ChatContentPart[] = [];

        content.push({
            type: "text",
            text: await this.format(environment, this.toHistoryEntry(message), "input")
        });

        /* TODO: fix "Failed to extract 1 image(s)" with gemini (issue with the temporary discord cdn links?) */
        /*if (message.attachments.length > 0) {
            content.push(...message.attachments.map(a => ({
                type: "image_url",
                image_url: {
                    "url": a.url
                }
            }) as ChatMessageContent));
        }*/
        
        data.content = content;
        return data;
    }

    /** The delay for sending a reply, after it's been generated */
    private sendingDelay(content: string): number {
        return Math.max(2000, content.length * 35) + Math.random() * 1500;
    }

    /** The delay for actually acknowledging a message first & then generating a reply */
    private typingDelay(): number {
        return (Math.random() * 1.5 + 1) * 1000;
    }

    public chance(type: ChanceType): boolean {
        return Math.random() > 1 - this.app.config.data.chances[type];
    }

    public delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}