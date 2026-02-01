import { Message, User } from "discord.js-selfbot-v13"
import assert from "assert"
import chalk from "chalk"
import z from "zod"
import { Plugin, PluginManager, PluginResultData } from "./plugins/index.js"
import { AIFormatter, AIFormatterType, AIFormatters } from "./formatter.js"
import { AIUsableChannel, AIEnvironment } from "./types/environment.js"
import { ClassifyResult, ClassifySchema } from "./types/classify.js"
import { randomNumber, randomValue } from "../util/utils.js"
import { ScheduledTask, TaskType } from "../tasks/index.js"
import { AIMemoryEntry, MemoryManager } from "./memory.js"
import { chatMessageToString } from "../util/chat.js"
import { ChatMessage } from "../api/types/chat.js"
import { AIMessage } from "./types/history.js"
import { ChanceType } from "./types/chance.js"
import { Environment } from "./environment.js"
import { AIResult } from "./types/result.js"
import { DelayType } from "./types/delay.js"
import { Typo } from "../util/typo.js"
import { Prompts } from "./prompt.js"
import { App } from "../app.js"

type AIGenerationType = "chat" | "work"

interface AIGenerateOptions {
    prompt: ChatMessage[]
    plugins: Plugin[]
    environment: AIEnvironment
    memories?: AIMemoryEntry[]
    type: AIGenerationType
}

interface AIClassifyOptions {
    environment: AIEnvironment
}

export interface AIGenerateMemoriesOptions {
    environment: AIEnvironment
    result: AIResult
}

export interface AIProcessOptions<T extends TaskType = TaskType> {
    channel: AIUsableChannel
    triggers?: Message[]
    author?: User
    type: AIGenerationType
    task?: ScheduledTask<T>
}

export const Tokens = {
    SplitInLine: "---",
    IgnoreReply: "<ignore>",
    MessageSeparator: ">>>",
}

export class AIManager {
    public readonly app: App

    /* The manager responsible for loading & managing all plugins */
    public readonly plugin: PluginManager

    /* The manager responsible for storing and retrieving memories */
    public readonly memory: MemoryManager

    /* The manager responsible for fetching everything about the guild, channel, etc. */
    public readonly env: Environment

    constructor(app: App) {
        this.app = app

        this.memory = new MemoryManager(this)
        this.plugin = new PluginManager(this)
        this.env = new Environment(this)
    }

    public async load(): Promise<void> {
        await this.plugin.load()
    }

    public async classify({
        environment,
    }: AIClassifyOptions): Promise<ClassifyResult> {
        const prompt = await Prompts.classify(this.app, environment)

        const result = await this.app.api.chat.runPrompt<
            z.infer<typeof ClassifySchema>
        >({
            messages: prompt,
            environment,
            schema: ClassifySchema,
        })

        this.app.logger.debug(
            chalk.bold("Classification result"),
            "->",
            result.object,
        )

        if (!result.object) return { continuation: false }

        return {
            continuation: result.object.continuation,
        }
    }

    public async generate({
        prompt: messages,
        environment,
        plugins,
    }: AIGenerateOptions): Promise<AIResult> {
        const tools = this.plugin.asAPITools(plugins)

        /* First, try to generate a response to the given messages */
        let result = await this.app.api.chat.runPrompt({
            messages,
            tools: this.app.config.data.features.plugins ? tools : undefined,
            environment,
        })

        assert(result.message)

        const toolResults: PluginResultData[] = []

        /* If the model chose to call tools, ... */
        if (result.message.toolCalls && result.message.toolCalls.length > 0) {
            /* Try to execute all of the specified plugins */
            toolResults.push(
                ...(await this.plugin.executeAll(
                    environment,
                    result.message.toolCalls,
                )),
            )

            /* After executing all requested plugins, send the results back to the AI to generate a response */
            if (toolResults.length > 0) {
                result = await this.app.api.chat.runPrompt({
                    environment,
                    messages: [
                        ...messages,
                        result.message,
                        this.plugin.asAPIToolResult(toolResults),
                    ],
                })

                assert(result.message)
            }
        }

        return {
            content: chatMessageToString(result.message),
            plugins: toolResults,
        }
    }

    public async process(options: AIProcessOptions): Promise<void> {
        const { type, channel, author: user, triggers } = options

        if (!options.task && !triggers) return
        if (triggers && user && user.id == this.app.id) return

        /* Add a small random delay, to make the bot feel more human-like */
        if (type == "chat") await this.wait(this.delay("start"))

        const environment = await this.env.fetch(channel, triggers)

        const trigger = triggers
            ? environment.history.messages[
                  environment.history.messages.length - 1
              ]
            : undefined

        /* Figure out which plugins to use */
        const plugins = this.plugin.triggeredPlugins(environment)

        /* Prevent infinite schedule loops */
        if (type == "work") {
            const idx = plugins.findIndex((p) => p.options.name == "remindTask")
            plugins.splice(idx, 1)
        }

        const memories = await this.memory.getRelatedMemories(
            environment,
            trigger,
        )

        const prompt = await Prompts[type == "work" ? "work" : "chat"](
            this.app,
            options as AIProcessOptions<never>,
            environment,
            memories,
        )

        try {
            const data = await this.generate({
                prompt: prompt,
                environment,
                plugins,
                memories,
                type,
            })

            const formatted = this.format(
                environment,
                data.content ?? "",
                "output",
            )

            const parts = this.rawResultToParts(formatted)

            console.log(data.content)

            this.app.logger.debug(chalk.bold("Result"), "->", {
                result: parts,
                plugins: data.plugins,
            })

            const chatMessages = Array.from(channel.messages.cache.values())
            const recentMessages = trigger
                ? chatMessages.slice(
                      chatMessages.findIndex((m) => m.id == trigger.id),
                  )
                : undefined

            /* Explicitly reply to the trigger message, if another user sent a message during the generation */
            const shouldReply = recentMessages && recentMessages.length >= 1
            let replied = false

            /* Pick random trigger message to reply to */
            const toReply = options.triggers
                ? randomValue(options.triggers)
                : undefined

            for (let part of parts) {
                if (data.plugins.length > 0) {
                    let totalLength = 0
                    for (const plugin of data.plugins) {
                        totalLength +=
                            plugin.result.stickers?.length ??
                            0 +
                                (plugin.result.attachments?.length ?? 0) +
                                part.length
                    }
                    if (totalLength == 0) return
                } else {
                    if (part.length == 0) return
                }

                const result = part

                const makeTypo = this.chance("typo")
                if (makeTypo && part.length > 0) part = Typo.add(part)

                await this.wait(this.delay("start"))
                await Promise.all([
                    channel.sendTyping(),
                    this.wait(this.delay("typing")),
                ])

                const reply = await channel.send({
                    reply:
                        (this.chance("reply") || shouldReply) &&
                        !replied &&
                        toReply
                            ? {
                                  messageReference: toReply,
                                  failIfNotExists: false,
                              }
                            : undefined,

                    files:
                        data.plugins.length > 0 && !replied
                            ? data.plugins.flatMap(
                                  (r) => r.result.attachments ?? [],
                              )
                            : undefined,
                    stickers:
                        data.plugins.length > 0 && !replied
                            ? data.plugins.flatMap(
                                  (r) => r.result.stickers ?? [],
                              )
                            : undefined,

                    content: part.length > 0 ? part : undefined,
                })

                if (makeTypo && result != part) {
                    await this.wait(this.delay("start"))
                    await reply.edit(result)
                }

                replied = true
            }
        } catch (error) {
            this.app.logger.error(
                chalk.bold("An error occured during generation"),
                "->",
                error,
            )
        }
    }

    /* TODO: somehow keep newlines */
    private rawResultToParts(raw: string): string[] {
        const messages = raw
            /*
                `a (b) >>> foo
                a (b) >>> bar`
                ===>
                [ `a (b) >>> foo`, `a (b) >>> bar` ]
            */
            .split("\n")
            .filter((l) => l.trim().length > 0)

            /*
                [ `a (b) >>> foo`, `a (b) >>> bar` ]
                ===>
                [ `foo`, `bar` ]
            */
            .map<string>((l) => l.split(Tokens.MessageSeparator).at(-1)!)

            /* split the message into the intended parts */
            .reduce<string[]>((prev, curr) => {
                prev.push(...curr.split(Tokens.SplitInLine))
                return prev
            }, [])

            /* get rid of ignore tokens */
            .filter((l) => !l.includes(Tokens.IgnoreReply))

            /* clean up trailing whitespace */
            .map((l) => l.trim())
            .filter((l) => l.length > 0)

        return messages
    }

    private format(
        environment: AIEnvironment,
        message: string,
        type: AIFormatterType = "output",
    ): string {
        /* Final, formatted output string */
        let final = message

        for (const pair of AIFormatters.filter(
            (formatter) => formatter[type] != undefined,
        )) {
            const formatter: AIFormatter = pair[type]!

            const matches = Array.from(final.matchAll(formatter.match))
            if (matches == null || matches.length == 0) continue

            for (const match of matches) {
                /* Which string actually matched & we want to use */
                const matched = match[0]

                const result = formatter.replacer(this, environment, matched)
                if (result) final = final.replace(matched, result)
            }
        }

        return final
    }

    public toHistoryEntry(
        message: Pick<
            AIMessage,
            "author" | "replyTo" | "content" | "mentioned"
        >,
    ): string {
        return `
${message.mentioned ? "[pinged you]" : ""}
${message.author.name}
${message.author.nick ? ` (${message.author.nick})` : ""}
${message.replyTo ? ` [reply to ${message.replyTo.author.name}: '${message.replyTo.content}']` : ""}
${Tokens.MessageSeparator}
${message.content}
        `
            .trim()
            .split("\n")
            .join("")
    }

    public toAPIMessage(environment: AIEnvironment, message: AIMessage) {
        const data: ChatMessage = {
            role: message.self ? "assistant" : "user",
            content: [
                {
                    type: "text",
                    text: this.format(
                        environment,
                        this.toHistoryEntry(message),
                        "input",
                    ),
                },
            ],
        }

        return data
    }

    public chance(type: ChanceType): boolean {
        return Math.random() > 1 - this.app.config.data.chances[type]
    }

    public wait(ms: number): Promise<void> {
        if (ms <= 0) return new Promise((resolve) => resolve())
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    public delay(type: DelayType) {
        const data = this.app.config.data.delays[type]
        if (!data) return 0

        return randomNumber(data.min, data.max)
    }

    public get nicknames() {
        return this.app.config.data.nickname
            ? typeof this.app.config.data.nickname == "string"
                ? [this.app.config.data.nickname]
                : this.app.config.data.nickname
            : []
    }
}
