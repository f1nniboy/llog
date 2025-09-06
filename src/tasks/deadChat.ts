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
                    instructions: "The current channel has been inactive for a while. I will 'revive' it by saying a generic greeting (hi, hello, hey) or asking people what they're doing (wyad, wyd, what are you up to), or by starting a monologue about some topic I enjoy or just want to talk about randomly. I must say something interesting. Say something that might provoke discussion or get people talking, but start a new topic and don't simply continue old messages."
                }
            }
        });
    }
}