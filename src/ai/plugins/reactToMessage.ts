import { RelationshipTypes } from "discord.js-selfbot-v13/typings/enums.js";
import { BaseGuildTextChannel } from "discord.js-selfbot-v13";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    start: string;
    emoji: string;
}

type PluginOutput = string

export default class ReactPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "reactToMessage",
            description: "React to a message in this channel with an emoji, either Unicode or <e:...> emoji (can't remove reactions like this)",
            triggers: [ "react" ],
            parameters: {
                start: { type: "string", description: "Part of a message content to react to in this channel", required: true },
                emoji: { type: "string", description: "Unicode or Discord emoji to react with", required: true }
            }
        });
    }

    public async run({ data, environment }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const { channel: { original: channel } } = environment;

        if (!(channel instanceof BaseGuildTextChannel)) return;
        if (!channel.permissionsFor(this.ai.app.client.user)?.has("ADD_REACTIONS")) throw new Error("Missing permissions");

        const guild = environment.guild?.original;

        const historyEntry = this.ai.env.getByPart(environment, data.start);
        if (!historyEntry) throw new Error("Message is not in this channel");

        const message = channel.messages.cache.get(historyEntry.id);
        if (!message) throw new Error("Message is not in this channel");

        try {
            if (data.emoji.startsWith("<e:")) {
                if (!guild) throw new Error("Cannot use server emojis in DMs");

                /* Name of the guild emoji */
                const name: string = data.emoji.replace("<e:", "").replace(">", "");

                const emoji = guild.emojis.cache.find(e => e.name === name);
                if (!emoji) throw new Error("Server emoji doesn't exist");

                await message.react(emoji.identifier);
            } else await message.react(data.emoji);
            
        } catch (error) {
            if (message.author.relationship === RelationshipTypes.BLOCKED) throw new Error("Can't react to user's messsages as they blocked me");
            throw new Error("Invalid emoji");
        }
    }
}