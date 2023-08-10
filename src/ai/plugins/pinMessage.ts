import { Message } from "discord.js-selfbot-v13";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIMessage } from "../types/history.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    id: number;
}

type PluginOutput = string

export default class PinMessagePlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "pin",
            description: "Pin a message in this channel, you may pin worthy or really funny messages, pin the referenced message when applicable",
            triggers: [ "pin", "mark" ],
            parameters: {
                id: { type: "number", description: "ID of the message to pin", required: true }
            }
        });
    }

    public async run({ data: { id }, environment: { history, channel: { original: channel } } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        if (!channel.permissionsFor(this.ai.app.client.user)?.has("MANAGE_MESSAGES")) throw new Error("Missing permissions");

        const historyEntry: AIMessage | null = history.messages.find((_, index) => index === id) ?? null;
        if (historyEntry === null) throw new Error("Message is not in this channel");

        const message: Message | null = channel.messages.cache.get(historyEntry.id) ?? null;
        if (message === null) throw new Error("Message is not in this channel");

        await message.contextMenu("1136086090898493460", "pin");
        return { data: `Pinned message "${message.content}"` };
    }
}