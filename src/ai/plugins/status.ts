import { CustomStatus } from "discord.js-selfbot-v13";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    text: string;
    emoji: string;
}

type PluginOutput = string

export default class ChangeStatusPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "status",
            description: "Change your status, displayed on your profile. Do not use this to tell what you are doing or to change your presence",
            triggers: [ "status" ],
            parameters: {
                text: { type: "string", description: "Text of the status", required: true },
                emoji: { type: "string", description: "Emoji next to the status", required: false }
            }
        });
    }

    public async run({ data: { text, emoji } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        this.ai.app.client.user.setActivity(
            new CustomStatus(this.ai.app.client)
                .setState(text.slice(undefined, 32)).setEmoji(emoji)
        );

        return {
            data: `Changed status to "${text}"${emoji ? ` with emoji ${emoji}`: ""}`
        };
    }
}