import { Awaitable, GuildBasedChannel, GuildEmoji, GuildMember } from "discord.js-selfbot-v13";

import { AIEnvironment } from "./types/environment.js";
import { AIManager } from "./manager.js";

export type AIReplacer = (ai: AIManager, environment: AIEnvironment, input: string) => Awaitable<string | null>
export type AIFormatterType = "input" | "output"

export interface AIFormatter {
    /* RegEx's to match */
    match: RegExp;

    /* The replacement callbacks to replace the matched string */
    replacer: AIReplacer;
}

export type AIFormatterPair = Partial<Record<AIFormatterType, AIFormatter>> & {
    /* Name of this formatter pair */
    name: "User mentions" | "Custom emojis" | "Channels";
}

export const AIFormatters: AIFormatterPair[] = [
    {
        name: "User mentions",

        output: {
            match: /<u:(.*?)>/gm,
            replacer: async (_, { guild: { original: guild } }, input) => {
                const username: string = input.replace("<u:", "").replace(">", "");
                const user: GuildMember | null = guild.members.cache.find(m => m.user.username === username) ?? null;

                return user !== null ? `<@${user.id}>` : null;
            }
        },

        input: {
            match: /<@(\d+)>/gm,
            replacer: async (_, { guild: { original: guild } }, input) => {
                const id: string = input.replace("<@", "").replace(">", "");

                const user: GuildMember | null = guild.members.cache.find(m => m.user.id === id) ?? null;
                return user !== null ? `@${user.user.username}` : null;
            }
        }
    },

    {
        name: "Custom emojis",

        output: {
            match: /<e:(.*?)>/gm,
            replacer: async (_, { guild: { original: guild } }, input) => {
                /* Name of the custom emoji */
                const name: string = input.replace("<e:", "").replace(">", "");
    
                /* Matching guild emoji */
                const emoji: GuildEmoji | null = guild.emojis.cache.find(e => e.name === name) ?? null;
                return emoji !== null ? emoji.toString() : null;
            }
        },

        input: {
            match: /<(a)?:([\w_]+):(\d+)>/gm,
            replacer: async (_, { guild: { original: guild } }, input) => {
                const [ name, id ] = input.replace("<a:", "").replace("<:", "").replace(">", "").split(":");
                if (!name || !id) return null;
    
                /* Matching guild emoji */
                const emoji: GuildEmoji | null = guild.emojis.cache.find(e => e.id === id) ?? null;
                return emoji !== null ? `<e:${emoji.name}>` : null;
            }
        }
    },

    {
        name: "Channels",

        output: {
            match: /<c:(.*?)>/gm,
            replacer: async (_, { guild: { original: guild } }, input) => {
                const name: string = input.replace("<c:", "").replace(">", "");
    
                const channel: GuildBasedChannel | null = guild.channels.cache.find(c => c.name === name && c.type !== "GUILD_CATEGORY") ?? null;
                return channel !== null ? `<#${channel.id}>` : null;
            }
        },

        input: {
            match: /<#(\d+)>/gm,
            replacer: async (_, { guild: { original: guild } }, input) => {
                const id: string = input.replace("<#", "").replace(">", "");
    
                const channel: GuildBasedChannel | null = guild.channels.cache.find(c => c.id === id) ?? null;
                return channel !== null ? `#${channel.name}` : null;
            }
        }
    }
]