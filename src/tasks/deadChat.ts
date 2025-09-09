import { TaskHandler, TaskRunOptions } from "./index.js";
import { AIChannel } from "../ai/types/environment.js";
import { App } from "../app.js";

export default class DeadChatHandler extends TaskHandler {
    constructor(app: App) {
        super(app, {
            name: "deadChat",
            settings: {
                maxQueue: 1
            }
        });
    }

    public async run({ task, context }: TaskRunOptions) {
        if (!context.channel.isText()) throw new Error("not a text channel");

        await this.app.ai.process({
            type: "work",
            channel: context.channel as AIChannel,
            message: context.message,
            task: {
                id: task.id,
                time: task.time,
                type: task.type,
                context: {
                    ...task.context,
                    instructions: "The current channel has been inactive for a while. You will revive it by saying a generic greeting, asking people what they're doing or by starting a monologue about some topic you enjoy or just want to talk about randomly. You must say something interesting. You will say something that might provoke discussion or get people talking, but start a new topic and don't simply continue old messages."
                }
            }
        });
    }
}