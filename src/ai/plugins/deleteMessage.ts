import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    start: string;
}

type PluginOutput = string

export default class DeleteMessagePlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "deleteMessagee",
            description: "Delete a message from this channel",
            triggers: [ "delete" ],
            parameters: {
                start: { type: "string", description: "Part of a message content to delete, to identify it", required: true }
            }
        });
    }

    public async run({ data: { start }, environment }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const { history, channel: { original: channel } } = environment;
        
        //if (!channel.permissionsFor(this.ai.app.client.user)?.has("MANAGE_MESSAGES")) throw new Error("Missing permissions");

        const historyEntry = this.ai.env.getByPart(environment, start);
        if (!historyEntry) throw new Error("Message is not in this channel");

        const message = channel.messages.cache.get(historyEntry.id);
        if (!message) throw new Error("Message is not in this channel");

        await message.delete();
    }
}