import { GuildEmoji, Message } from "discord.js-selfbot-v13";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIMessage } from "../types/history.js";
import { AIManager } from "../manager.js";
import { RelationshipTypes } from "discord.js-selfbot-v13/typings/enums.js";

interface PluginInput {
    id: number;
    emoji: string;
}

type PluginOutput = string

export default class ReactPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "react",
            description: "React to a message in this channel with an emoji, either Unicode or <e:...> emoji",
            triggers: [ "react" ],
            parameters: {
                id: { type: "number", description: "ID of the message to react to in this channel", required: true },
                emoji: { type: "string", description: "Unicode or Discord emoji to react with", required: true }
            }
        });
    }

    public async run({ data, environment: { history, channel: { original: channel }, guild: { original: guild } } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        if (!channel.permissionsFor(this.ai.app.client.user)?.has("ADD_REACTIONS")) throw new Error("Missing permissions");

        const historyEntry: AIMessage | null = history.messages.find((_, index) => index === data.id) ?? null;
        if (historyEntry === null) throw new Error("Message is not in this channel");

        const message: Message | null = channel.messages.cache.get(historyEntry.id) ?? null;
        if (message === null) throw new Error("Message is not in this channel");

        try {
            if (data.emoji.startsWith("<e:")) {
                /* Name of the guild emoji */
                const name: string = data.emoji.replace("<e:", "").replace(">", "");

                const emoji: GuildEmoji | null = guild.emojis.cache.find(e => e.name === name) ?? null;
                if (emoji === null) throw new Error("Guild emoji doesn't exist");

                await message.react(emoji.identifier);
            } else await message.react(data.emoji);

            return {
                data: `Reacted with ${data.emoji} to the message`
            };
            
        } catch (error) {
            if (message.author.relationship === RelationshipTypes.BLOCKED) throw new Error("Can't react to user's messsages as they blocked me");
            throw new Error("Invalid emoji");
        }
    }
}