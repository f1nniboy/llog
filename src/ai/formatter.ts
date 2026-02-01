import { BaseGuildTextChannel } from "discord.js-selfbot-v13"
import { AIEnvironment } from "./types/environment.js"
import { AIManager } from "./manager.js"

export type AIReplacer = (
    ai: AIManager,
    environment: AIEnvironment,
    input: string,
) => string | undefined
export type AIFormatterType = "input" | "output"

export interface AIFormatter {
    match: RegExp
    replacer: AIReplacer
}

export type AIFormatterPair = Partial<Record<AIFormatterType, AIFormatter>> & {
    name: "mentions" | "emojis" | "channels"
}

export const AIFormatters: AIFormatterPair[] = [
    {
        name: "mentions",

        output: {
            match: /@(\w+)/gm,
            replacer: (ai, environment, input) => {
                if (!environment.guild) return
                const username = input.replace("@", "")
                const user = ai.app.client.users.cache.find(
                    (u) => u.username == username,
                )

                return user ? `<@${user.id}>` : undefined
            },
        },

        input: {
            match: /<@(\d+)>/gm,
            replacer: (ai, environment, input) => {
                if (!environment.guild) return
                const id = input.replace("<@", "").replace(">", "")

                const user = ai.app.client.users.cache.find((u) => u.id == id)
                return user ? `@${user.username}` : undefined
            },
        },
    },

    {
        name: "channels",

        output: {
            match: /#(\w+)/gm,
            replacer: (ai, environment, input) => {
                if (!environment.guild) return
                const channelName = input.replace("#", "")

                const channel = ai.app.client.channels.cache.find(
                    (c) =>
                        c instanceof BaseGuildTextChannel &&
                        c.name == channelName,
                ) as BaseGuildTextChannel | undefined

                if (!channel?.viewable) return
                return channel ? `<#${channel.id}>` : undefined
            },
        },

        input: {
            match: /<#(\d+)>/gm,
            replacer: (ai, environment, input) => {
                if (!environment.guild) return
                const id = input.replace("<#", "").replace(">", "")

                const channel = ai.app.client.channels.cache.find(
                    (c) => c instanceof BaseGuildTextChannel && c.id == id,
                ) as BaseGuildTextChannel | undefined

                return channel ? `#${channel.name}` : undefined
            },
        },
    },
]
