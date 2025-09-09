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
            name: "setStatus",
            description: "Change your Discord status, displayed on your profile",
            parameters: {
                text: { type: "string", description: "Text of the status", required: true },
                emoji: { type: "string", description: "Emoji next to the status" }
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