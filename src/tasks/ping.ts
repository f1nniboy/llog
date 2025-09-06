import { TaskCheckOptions, TaskHandler, TaskRunOptions } from "./index.js";
import { AIChannel } from "../ai/types/environment.js";
import { App } from "../app.js";

export default class PingTaskHandler extends TaskHandler {
    constructor(app: App) {
        super(app, {
            name: "ping",
            settings: {
                maxQueue: 2
            }
        });
    }

    public async run({ context }: TaskRunOptions) {
        if (!context.message) throw new Error("no message");
        if (!context.channel.isText()) throw new Error("not a text channel");

        const { message } = context;

        await this.app.ai.process({
            type: "chat",
            channel: context.channel as AIChannel,
            message: context.message,
            triggered: context.triggered
        });
    }

    public check({ context: { messageId, guildId, userId } }: TaskCheckOptions): boolean {
        if (!messageId) return false;
        return true;
    }
}   