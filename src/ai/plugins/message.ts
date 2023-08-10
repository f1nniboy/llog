import { AnyChannel, GuildMember } from "discord.js-selfbot-v13";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    name: string;
    content: string;
}

type PluginOutput = string

export default class SendMessagePlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "message",
            description: "Send a message in another channel on the server, or DM a user",
            triggers: [ /send(.*?)in/g, "private message", "dm" ],
            parameters: {
                name: { type: "string", description: "Name of the channel or name of user", required: true },
                content: { type: "string", description: "Content of the message to send", required: true }
            }
        });
    }

    public async run({ data: { name, content }, environment: { guild: { original: guild } } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const channel: AnyChannel | null = guild.channels.cache.find(c => c.name === name) ?? null;

        if (channel === null) {
            const user: GuildMember | null = guild.members.cache.find(m => m.user.username === name) ?? null;
            if (user === null) throw new Error("Channel or user doesn't exist");

            const channel = await user.createDM();
            await channel.send(content);

            return;
        }
        
        if (!channel.isText()) throw new Error("Channel is not a text channel");
        if (!channel.permissionsFor(this.ai.app.client.user)?.has("SEND_MESSAGES")) throw new Error("Can't send message due to missing permissions");

        await channel.send(content);
    }
}