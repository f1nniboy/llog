import assert from "assert"
import { stringToMessageContent } from "../util/chat.js"
import { ChatInputMessage } from "../api/types/chat.js"
import { AIProcessOptions, Tokens } from "./manager.js"
import { AIEnvironment } from "./types/environment.js"
import { ScheduledTask } from "../tasks/index.js"
import { formatDate } from "../util/utils.js"
import { AIMemoryEntry } from "./memory.js"
import { App } from "../app.js"

type InstructionType =
    | "static"
    | "dynamic"
    | "memories"
    | "users"
    | "task"
    | "classify"

interface InstructionOptions {
    app: App
    env: AIEnvironment
    memories?: AIMemoryEntry[]
    request?: AIProcessOptions
}

const Instructions: Record<
    InstructionType,
    (options: InstructionOptions) => (string | undefined)[] | string | undefined
> = {
    static: ({ app, env }) => [
        `you must act as real human Discord user named ${env.self.name}`,
        "you may never break character",
        app.config.data.personality.tone,
        app.config.data.personality.persona,
        "you can make up information about ONLY yourself",
        "you must remember new important information and detailed descriptions",
        `you can insert ${Tokens.SplitInLine} to split message, use sparingly`,
        //`you may insert ${Characters.Ignore} verbatim to completely avoid replying`,
        //"you must save all recent information in chat using saveMemory",
        "you must ONLY reply to last message",
    ],
    dynamic: ({ env }) => [
        `in ${env.guild ? `server ${env.guild.name}, channel #${env.channel.name}` : `DM with ${env.channel.name}`}`,
        `date: ${formatDate()}`,
    ],
    memories: ({ app, memories }) =>
        `previous memories, use if applicable:\n${memories
            ?.map((m) => app.ai.memory.toMemoryPromptString(m))
            .join("\n")}`,
    users: ({ app, env }) =>
        `users currently in chat:\n${env.history.users
            .map(
                (user) =>
                    `${user.name} =\n${app.ai.env.stringify(user, ["name", "self", "bio"])}`,
            )
            .join("\n")}`,
    task: ({ request }) =>
        request?.task
            ? [
                  `you taks is to fulfill following task using tools, added at ${formatDate(new Date(request.task.time))}`,
                  (request.task as ScheduledTask<"work">).context.instructions,
              ]
            : undefined,
    classify: ({ env }) => [
        "you are a chat history classifier.",
        `decide if the latest Discord chat message continues a conversation WITH the user named "${env.self.name}".`,
        `- continuation is true if the message is replying in a way that logically continues an exchange with the user "@${env.self.name}".`,
        `- aboutUser is true if the message mentions or discusses "@${env.self.name}" even if not conversing.`,
        "reply with ONLY a JSON object; no extra text",
    ],
}

function toMessageHistoryMessages(
    app: App,
    env: AIEnvironment,
): ChatInputMessage[] {
    const feat = app.config.feature("history")
    const m: ChatInputMessage[] = []

    if (feat.settings.format == "unified") {
        const lines: string[] = ["chat history of the channel:"]

        for (const m of env.history.messages) {
            lines.push(app.ai.toHistoryEntry(m))
        }

        m.push({
            role: "user",
            content: stringToMessageContent(lines.join("\n\n")),
        })
    } else if (feat.settings.format == "separate") {
        for (const message of env.history.messages) {
            m.push(app.ai.toAPIMessage(env, message))
        }
    }

    return m
}

export class Prompts {
    public static instructions(
        type: InstructionType,
        options: InstructionOptions,
    ): ChatInputMessage[] {
        const raw = Instructions[type](options)

        const result: string[] = Array.isArray(raw)
            ? (raw.filter((i) => i && i.length > 0) as string[])
            : raw
              ? [raw]
              : []

        return [
            {
                role: "system",
                content: stringToMessageContent(result.join("\n")),
            },
        ]
    }

    public static async chat(
        app: App,
        options: AIProcessOptions,
        env: AIEnvironment,
        memories: AIMemoryEntry[],
    ): Promise<ChatInputMessage[]> {
        const m: ChatInputMessage[] = []

        const o: InstructionOptions = {
            app,
            request: options,
            env,
            memories,
        }

        m.push(
            ...Prompts.instructions("static", o),
            ...Prompts.instructions("dynamic", o),
        )

        if (memories.length > 0) m.push(...Prompts.instructions("memories", o))

        if (app.config.feature("users").enable)
            m.push(...Prompts.instructions("users", o))

        m.push(...toMessageHistoryMessages(app, env))

        return m
    }

    public static async work(
        app: App,
        options: AIProcessOptions<"work">,
        env: AIEnvironment,
        memories: AIMemoryEntry[],
    ): Promise<ChatInputMessage[]> {
        assert(options.task)
        assert(options.task.context.instructions)

        const m: ChatInputMessage[] = []

        const o: InstructionOptions = {
            app,
            request: options,
            env,
            memories,
        }

        m.push(
            ...Prompts.instructions("static", o),
            ...Prompts.instructions("dynamic", o),
            ...Prompts.instructions("task", o),
        )

        return m
    }

    public static async classify(
        app: App,
        env: AIEnvironment,
    ): Promise<ChatInputMessage[]> {
        const m: ChatInputMessage[] = []

        const o: InstructionOptions = {
            app,
            env,
        }

        m.push(
            ...Prompts.instructions("classify", o),
            ...toMessageHistoryMessages(app, env),
        )

        return m
    }
}
