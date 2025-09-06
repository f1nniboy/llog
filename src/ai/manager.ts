import { BaseGuildTextChannel, Message } from "discord.js-selfbot-v13";
import chalk from "chalk";

import { ChatMessage, OpenAIChatResult, OpenAIChatUsage } from "../api/chat/types/chat.js";
import { Plugin, PluginManager, PluginResultData } from "./plugins/index.js";
import { AIFormatter, AIFormatterType, AIFormatters } from "./formatter.js";
import { AIEnvironment } from "./types/environment.js";
import { Environment } from "./environment.js";
import { AIMessage } from "./types/history.js";
import { AIMemory, MemoryEntry, MemoryManager } from "./memory.js";
import { Typo } from "../util/typo.js";
import { App } from "../app.js";

export interface AIResult {
    /** The generated content */
    content: string | null;

    /** Which plugin was used */
    plugin: PluginResultData | null;

    /** Token usage for this request */
    usage: OpenAIChatUsage;
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

export const Characters = {
    Splitting: "---",
    Ignore: "-+-",
    Self: "<self>"
}

/* How many entries can wait in the queue at a time */
const QueueMaxSize: number = 2

export type ChanceType = "trigger" | "typo" | "reply"

export class AIManager {
    public readonly app: App;

    /* The plugin manager; responsible for loading & managing all plugins */
    private readonly plugin: PluginManager;

    /* The memory manager; responsible for storing and retrieving memories */
    private readonly memory: MemoryManager;

    /* The environment manager; responsible for fetching everything about the guild, channel, history, etc. */
    public readonly env: Environment;

    /* Whether the bot is currently processing something */
    private processing: boolean;

    /* List of messages that are still waiting to be processed */
    private queue: Message[];

    constructor(app: App) {
        this.app = app;

        this.memory = new MemoryManager(this);
        this.plugin = new PluginManager(this);
        this.env = new Environment(this);

        this.processing = false;
        this.queue = [];
    }

    public async load(): Promise<void> {
        await this.plugin.load();
        await this.startQueue();
    }

    public add(message: Message): void {
        if (this.queue.length >= QueueMaxSize) return;

        if (
            !message.guildId || !message.member || message.author.bot || message.author.id === this.app.id || message.channel.type === "DM" || message.channel.type === "GROUP_DM" || !message.channel.isText()
        ) return;

        if (this.app.config.data.settings.blacklist.users.includes(message.author.id)) return;
        if (this.app.config.data.settings.blacklist.guilds.includes(message.guildId)) return;

        if (!message.channel.permissionsFor(this.app.client.user)?.has("SEND_MESSAGES")) return;

        this.queue.push(message);
    }

    public async startQueue(): Promise<void> {
        setInterval(async () => {
            if (this.queue.length === 0 || this.processing) return;
            const message = this.queue.shift()!;

            const nicknames: string[] | null = this.app.config.data.settings.nickname !== null ?
                typeof this.app.config.data.settings.nickname === "string"
                    ? [ this.app.config.data.settings.nickname ]
                    : this.app.config.data.settings.nickname
                : null;

            /* Whether the bot was explicitly triggered by a mention or reply */
            const triggered: boolean = message.mentions.has(this.app.client.user)
                || (nicknames !== null
                    ? nicknames.some(name => message.content.toLowerCase().includes(name))
                    : false
                )
                || message.content.toLowerCase().includes(this.app.client.user.username);

            if ((!triggered && !this.chance("trigger")) || (!triggered && this.processing)) return;

            try {
                this.processing = true;
                await this.process(message, triggered);
            } catch (error) {
                this.app.logger.error(chalk.bold("An error occured while processing the queue"), "->", error);
            } finally {
                this.processing = false;
            }
        }, 1000);
    }

    public async generate({ messages, environment, plugins }: AIGenerationOptions): Promise<AIResult> {
        /*if (Math.random() > 0) {
            return {
                content: "test message",
                plugin: null,
                usage: { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 }
            };
        }*/
        
        const { temperature, model } = this.app.config.data.settings.api;

        /* Convert all of the plugins into OpenAI functions. */
        const functions = this.plugin.asOpenAIFunctions(plugins);

        /* First, try to generate a response to the given messages. */
        const first: OpenAIChatResult = await this.app.api.chat.chat({
            messages, model, temperature,

            functions: functions.length > 0 ? functions : undefined,
            function_call: functions.length > 0 ? "auto" : undefined
        });

        /* Whether the given response contains function calls */
        const functionCall = this.plugin.extractFunctionCall(first.message);

        /* If the first generated message doesn't contain any function calls and is a normal reply, return that. */
        if (functionCall === null) return {
            content: first.message.content, usage: first.usage, plugin: null
        };

        /* Try to execute all of the specified plugins. */
        const execution = await this.plugin.execute(environment, functionCall);

        /* If the current result can simply be ignored & the reply can be sent without any further content, do that. */
        if (execution !== null && execution.result.instant) return {
            content: null, plugin: execution, usage: first.usage
        };

        /* After executing all requested plugins, send the results back to the AI to generate a response. */
        const last = await this.app.api.chat.chat({
            model, temperature, messages: [
                ...messages, first.message,
                
                ...execution !== null && execution.result.instructions ? [
                    { role: "system", content: execution.result.instructions } as ChatMessage
                ] : [],

                ...execution !== null ? [ this.plugin.asOpenAIFunctionCall(execution) ] : []
            ]
        });

        return {
            content: last.message.content, usage: {
                completion_tokens: first.usage.completion_tokens + last.usage.completion_tokens,
                prompt_tokens: first.usage.prompt_tokens + last.usage.prompt_tokens,
                total_tokens: first.usage.total_tokens + last.usage.total_tokens
            }, plugin: execution 
        };
    }

    public async process(message: Message, triggered: boolean): Promise<void> { 
        if (
            !message.guildId || !message.member || message.author.bot || message.author.id === this.app.id || !(message.channel instanceof BaseGuildTextChannel)
        ) return;

        /* Add a small random delay, to make the bot feel more human-like. */
        await this.delay(this.typingDelay());

        /* Fetch the environment of the guild. */
        const environment: AIEnvironment = await this.env.fetch(
            message.channel, triggered ? message : undefined
        );

        /* The chat message, which triggered this interaction */
        const trigger: AIMessage = environment.history.messages[environment.history.messages.length - 1];

        /* Figure out which plugins to use */
        const plugins: Plugin[] = this.plugin.triggeredPlugins(environment);

        const memories = await this.memory.retrieve({
            query: trigger.content,
            limit: 4
        });

        const messages: ChatMessage[] = [
            ...await this.prompts(environment, memories)
        ];

        try {

            const data = await this.generate({
                messages, environment, plugins, memories
            });

            this.app.logger.debug(chalk.bold("Result"), "->", data);

            await this.memory.insert({
                trigger, result: data
            });

            /* Final, formatted result */
            const formatted = await this.format(environment, data.content ?? "", "output");

            const chatMessages = Array.from(message.channel.messages.cache.values());
            const recentMessages = chatMessages.slice(chatMessages.findIndex(m => m.id === trigger.id));

            /* Whether the bot must reply to the trigger message, so that the reply actually makes sense */
            const mustReply: boolean = recentMessages.length > 1;
            let replied: boolean = false;

            const parts = formatted
                .replaceAll("\n", Characters.Splitting)
                .split(Characters.Splitting).map(l => l.trim())
                .filter((l, i) => i > 0 ? l.length > 0 && !l.includes(Characters.Ignore) : true)
                .filter(l => !l.includes("functions."))
                .map(l => l.replaceAll(Characters.Ignore, "").trim());

            for (let part of parts) {
                if (data.plugin && data.plugin.result) {
                    if (data.plugin.result.stickers.length + data.plugin.result.attachments.length + part.length === 0) return;
                } else {
                    if (part.length === 0) return;
                }

                const result: string = part;

                const makeTypo: boolean = this.chance("typo");
                if (makeTypo && part.length > 0) part = Typo.add(part);

                await this.delay(this.typingDelay());
                if (part.length > 0) await message.channel.sendTyping();
                await this.delay(this.sendingDelay(part));
                
                const reply = await message.channel.send({
                    reply: (this.chance("reply") || mustReply) && !replied && triggered ? { messageReference: message, failIfNotExists: false } : undefined,
                
                    files: data.plugin && data.plugin.result && !replied ? data.plugin.result.attachments : undefined,
                    stickers: data.plugin && data.plugin.result && !replied ? data.plugin.result.stickers : undefined,

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

    public async format(environment: AIEnvironment, message: AIMessage & { index: number } | string, type: AIFormatterType = "output"): Promise<string> {
        /* Final, formatted output string */
        let final: string = typeof message === "object" ? message.content : message;

        /* Apply all formatters. */
        for (const pair of AIFormatters.filter(formatter => formatter[type] !== undefined)) {
            const formatter: AIFormatter = pair[type]!;

            /* Find all matches in the string, for this formatter. */
            const matches = Array.from(final.matchAll(formatter.match));
            if (matches === null || matches.length === 0) continue;

            for (const match of matches) {
                /* Which string actually matched & we want to use */
                const matched: string = match[0];

                const result: string | null = await formatter.replacer(this, environment, matched);
                if (result !== null) final = final.replace(matched, result);
            }
        }

        if (typeof message === "object") final = message.content = final;

        return typeof message === "object"
            ? this.toHistoryEntry(message) : final;
    }

    public toHistoryEntry(message: AIMessage & { index?: number }): string {
        return `${message.mentioned ? `(mentioned you) ` : ""}[${message.author.id == this.app.id ? Characters.Self : message.author.name}]${message.index != undefined ? ` <${message.index}>`: ""}${message.replyTo ? `[reply to ${message.replyTo.author.name}: '${message.replyTo.content}']` : ""}: ${message.tags.length > 0 ? `${message.tags.map(t => `[${t.name}: ${Array.isArray(t.content) ? t.content.join(", ") : t.content}]`).join(" ")}; ` : ""}${message.content}`;
    }

    private async prompts(environment: AIEnvironment, memories: AIMemory): Promise<ChatMessage[]> {
        const messages: ChatMessage[] = [];
        const self = this.app.client.user;

        const {
            tone, persona, interests, dislikes
        } = this.app.config.data.settings.prompts;

        const features = this.app.config.data.settings.features;
        const nickname = this.app.config.data.settings.nickname;

        if (features.users) messages.push({
            role: "system", content: `USERS IN CHAT:\n${environment.history.users.map(user => `${user.name} =\n${this.env.stringify(user, [ "name", "self", "bio" ])}`).join("\n")}`
        });

        if (memories.length > 0) messages.push({
            role: "system", content: `Use these previous interactions (memories) if relevant:\n${memories.map(m => this.memory.toMemoryEntry(m)).join("\n")}`
        });

        messages.push({
            role: "system", content: `
you must be a discord user called ${self.username}: an internet user & 100% real human.
you MAY NEVER break character.
fully act like a human and type like one AT ALL TIMES.
current time and date: ${this.formatDate(new Date())}

keep your responses very concise, with no punctuation (except , and ?) and in all lowercase.
${tone !== null ? `your tone will be ${tone} throughout the convo.` : ""}
${persona ? ` you will act like this: ${persona}.` : ""}
${interests.length > 0 ? `you have interests in the following: ${interests.join(", ")}.` : ""}
${dislikes.length > 0 ? `you dislike all of these things: ${dislikes.join(", ")}.` : ""}

you are on the server "${environment.guild.name}", in the ${environment.channel.name} ${environment.channel.type} channel.
${nickname !== null ? typeof nickname === "string" ? `your nickname is "${nickname}".` : `your nicknames are: ${nickname.join(", ")}.` : null}

can add "${Characters.Splitting}" at any point in your reply, to split it at that point into multiple.

message history format: "[user](<msg id): content". simply reply in raw text without this format.
messages sent by "${Characters.Self}" were sent by you.

ONLY REPLY to A SINGLE message in chat at a time. the LAST message in history is the latest.
if wish to ignore the message & not reply, reply with "${Characters.Ignore}" VERBATIM.
`.split("\n").map(l => l.trim()).filter(l => l.length > 0).join("\n").replaceAll("\n", " ").trim()
        });

        /* Concatenated history */
        let history: string = "";

        for (let i = 0; i < environment.history.messages.length; i++) {
            const message = environment.history.messages[i];

            const formatted = await this.format(environment, {
                ...message, index: i
            }, "input");

            history += `${formatted}\n`;
        }

        history += `${self.username}<response>:\n`;

        messages.push({
            role: "user", content: history
        });

        return messages;
    }

    private formatDate(date: Date) {
        const dateString = date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC"
        });
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        
        return `${dateString}, ${hours}:${minutes} UTC`;
    }

    /** The delay for sending a reply, after it's been generated */
    private sendingDelay(content: string): number {
        return Math.max(2000, content.length * 55) + Math.random() * 1500;
    }

    /** The delay for actually acknowledging a message first & then generating a reply */
    private typingDelay(): number {
        return (Math.random() * 1.5 + 1) * 1000;
    }

    private chance(type: ChanceType): boolean {
        return Math.random() > 1 - this.app.config.data.settings.chances[type];
    }

    private delay(ms: number): Promise<void> {
        // TODO: only for dev
        //return new Promise(resolve => resolve());
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}