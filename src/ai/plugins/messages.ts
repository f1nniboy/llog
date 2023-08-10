import { AnyChannel } from "discord.js-selfbot-v13";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    name: string;
    amount?: number;
}

type PluginOutput = string

export default class GetChannelMessagesPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "messages",
            description: "Fetch the last X messages from a channel, to view them",
            triggers: [ /(fetch|read|get)\s+.*?\s+messages\s+.*?/g ],
            parameters: {
                name: { type: "string", description: "Name of the channel", required: true },
                amount: { type: "number", description: "How many messages to get", required: false }
            }
        });
    }

    public async run({ data: { name, amount }, environment: { guild: { original: guild } } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const channel: AnyChannel | null = guild.channels.cache.find(c => c.name === name) ?? null;

        if (channel === null) throw new Error("Channel doesn't exist");
        if (!channel.isText()) throw new Error("Channel is not a text channel");

        /* Get the latest X messages in the channel. */
        const history = await this.ai.env.history({
            channel, count: amount ?? 5
        });

        return {
            data: `Last ${amount} messages in the channel ${channel.name}:\n${history.messages.map(m => this.ai.toHistoryEntry(m)).join("\n")}`
        };
    }
}