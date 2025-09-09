import { TaskHandler, TaskRunOptions } from "./index.js";
import { AIChannel } from "../ai/types/environment.js";
import { App } from "../app.js";

export default class WorkTaskHandler extends TaskHandler {
    constructor(app: App) {
        super(app, {
            name: "ai",
            settings: {
                maxQueue: 3
            }
        });
    }

    public async run({ task, context }: TaskRunOptions) {
        if (!context.channel.isText()) throw new Error("not a text channel");
        if (!context.instructions) throw new Error("no instructions");

        await this.app.ai.process({
            type: "work",
            channel: context.channel as AIChannel,
            message: context.message,
            task
        });
    }
}