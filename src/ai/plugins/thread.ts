import { BaseGuildTextChannel } from "discord.js-selfbot-v13";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    name: string;
    starter: string;
}

type PluginOutput = string

export default class CreateThreadPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "startThread",
            description: "Create a thread in the channel",
            triggers: [ "thread", "sub channel" ],
            parameters: {
                name: { type: "string", description: "Name of the thread", required: true },
                starter: { type: "string", description: "Starter message to send in the new thread", required: false }
            }
        });
    }

    public async run({ data: { name, starter }, environment: { channel: { original: channel } } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        if (!(channel instanceof BaseGuildTextChannel)) throw new Error("Cannot create another thread in a thread");
        
        const thread = await channel.threads.create({
            name
        });

        if (starter) await thread.send(starter);
        return { instant: true };
    }
}