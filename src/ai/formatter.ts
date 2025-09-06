import { Awaitable } from "discord.js-selfbot-v13";

import { AIEnvironment } from "./types/environment.js";
import { AIManager, Characters } from "./manager.js";

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
                const username = input.replace("<u:", "").replace(">", "");
                const user = guild.members.cache.find(m => m.user.username === username);

                return user ? `<@${user.id}>` : null;
            }
        },

        input: {
            match: /<@(\d+)>/gm,
            replacer: async (ai, { guild: { original: guild } }, input) => {
                const id = input.replace("<@", "").replace(">", "");

                const user = guild.members.cache.find(m => m.user.id === id);

                return user ? ` @${user.user.username}` : null;
            }
        }
    },

    {
        name: "Custom emojis",

        output: {
            match: /<e:(.*?)>/gm,
            replacer: async (_, { guild: { original: guild } }, input) => {
                const name = input.replace("<e:", "").replace(">", "");
    
                const emoji = guild.emojis.cache.find(e => e.name === name);
                return emoji ? emoji.toString() : null;
            }
        },

        input: {
            match: /<(a)?:([\w_]+):(\d+)>/gm,
            replacer: async (_, { guild: { original: guild } }, input) => {
                const [ name, id ] = input.replace("<a:", "").replace("<:", "").replace(">", "").split(":");
                if (!name || !id) return null;
    
                /* Matching guild emoji */
                const emoji = guild.emojis.cache.find(e => e.id === id);
                return emoji ? `<e:${emoji.name}>` : null;
            }
        }
    },

    {
        name: "Channels",

        output: {
            match: /<c:(.*?)>/gm,
            replacer: async (_, { guild: { original: guild } }, input) => {
                const name = input.replace("<c:", "").replace(">", "");
    
                const channel = guild.channels.cache.find(c => c.name === name && c.type !== "GUILD_CATEGORY");
                return channel ? `<#${channel.id}>` : null;
            }
        },

        input: {
            match: /<#(\d+)>/gm,
            replacer: async (_, { guild: { original: guild } }, input) => {
                const id = input.replace("<#", "").replace(">", "");
    
                const channel = guild.channels.cache.find(c => c.id === id);
                return channel ? `#${channel.name}` : null;
            }
        }
    }
]