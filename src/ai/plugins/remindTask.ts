import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    instructions: string;
    time: string;
}

type PluginOutput = string

function isoToTimestamp(text: string) {
    const date = new Date(text);
    if (isNaN(date.getTime())) return undefined;

    return Math.floor(date.getTime());
}

export default class RemindTaskPlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "remindTask",
            description: "Remind to do something in a specific amount of time. Describe the task to plan in detail",
            parameters: {
                instructions: { type: "string", description: "What to do when the time comes, detailed explanation for yourself", required: true },
                time: { type: "string", description: "UTC ISO Date string, when to run this task. Use given current time to figure this out", required: true }
            }
        });
    }

    public async run({ environment: { guild, channel, user }, data: { instructions, time: isoStr } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const time = isoToTimestamp(isoStr);
        if (!time) throw new Error("Invalid date given");

        const success = await this.ai.app.task.add({
            type: "ai", time,
            context: {
                guildId: guild?.id,
                channelId: channel.id,
                userId: user?.id,
                instructions
            }
        });

        if (!success) return {
            data: `Couldn't remind myself to do '${instructions}', perhaps I already have too many things to remember`
        };

        return {
            data: `Reminded myself to do '${instructions}' at ${time}`
        };
    }
}