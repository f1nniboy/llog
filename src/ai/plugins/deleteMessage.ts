import { Message } from "discord.js-selfbot-v13";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIMessage } from "../types/history.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    id: number;
}

type PluginOutput = string

export default class DeleteMessagePlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "deleteMsg",
            description: "Delete a message from this channel",
            triggers: [ "delete" ],
            parameters: {
                id: { type: "number", description: "ID of the message to delete", required: true }
            }
        });
    }

    public async run({ data: { id }, environment: { history, channel: { original: channel } } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        if (!channel.permissionsFor(this.ai.app.client.user)?.has("MANAGE_MESSAGES")) throw new Error("Missing permissions");

        const historyEntry: AIMessage | null = history.messages.find((_, index) => index === id) ?? null;
        if (historyEntry === null) throw new Error("Message is not in this channel");

        const message: Message | null = channel.messages.cache.get(historyEntry.id) ?? null;
        if (message === null) throw new Error("Message is not in this channel");

        await message.delete();
    }
}