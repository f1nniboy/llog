import { Awaitable } from "discord.js-selfbot-v13";

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
    name: "mentions" | "emojis" | "channels";
}

export const AIFormatters: AIFormatterPair[] = [
    {
        name: "mentions",

        output: {
            match: /@(\w+)/gm,
            replacer: async (_, environment, input) => {
                if (!environment.guild) return null;
                const { guild: { original: guild } } = environment;

                const username = input.replace("@", "");
                const user = guild.members.cache.find(m => m.user.username === username);

                return user ? `<@${user.id}>` : null;
            }
        },

        input: {
            match: /<@(\d+)>/gm,
            replacer: async (_, environment, input) => {
                if (!environment.guild) return null;
                const { guild: { original: guild } } = environment;
                const id = input.replace("<@", "").replace(">", "");

                const user = guild.members.cache.find(m => m.user.id === id);
                return user ? `@${user.user.username}` : null;
            }
        }
    },

    {
        name: "emojis",

        output: {
            match: /<e:(.*?)>/gm,
            replacer: async (_, environment, input) => {
                if (!environment.guild) return null;
                const { guild: { original: guild } } = environment;
                const name = input.replace("<e:", "").replace(">", "");
    
                const emoji = guild.emojis.cache.find(e => e.name === name);
                return emoji ? emoji.toString() : null;
            }
        },

        input: {
            match: /<(a)?:([\w_]+):(\d+)>/gm,
            replacer: async (_, environment, input) => {
                if (!environment.guild) return null;
                const { guild: { original: guild } } = environment;
                const [ name, id ] = input.replace("<a:", "").replace("<:", "").replace(">", "").split(":");
                if (!name || !id) return null;
    
                const emoji = guild.emojis.cache.find(e => e.id === id);
                return emoji ? `<e:${emoji.name}>` : null;
            }
        }
    },

    {
        name: "channels",

        output: {
            match: /#(\w+)/gm,
            replacer: async (_, environment, input) => {
                if (!environment.guild) return null;
                const { guild: { original: guild } } = environment;

                const channelName = input.replace("#", "");
                const channel = guild.channels.cache.find(c => c.name === channelName && c.type !== "GUILD_CATEGORY");

                if (!channel?.viewable) return null;
                return channel ? `<#${channel.id}>` : null;
            }
        },

        input: {
            match: /<#(\d+)>/gm,
            replacer: async (_, environment, input) => {
                if (!environment.guild) return null;
                const { guild: { original: guild } } = environment;
                const id = input.replace("<#", "").replace(">", "");
    
                const channel = guild.channels.cache.find(c => c.id === id);
                return channel ? `#${channel.name}` : null;
            }
        }
    }
]