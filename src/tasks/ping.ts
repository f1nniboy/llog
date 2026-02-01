import { AIUsableChannel } from "../ai/types/environment.js"
import { TaskHandler, TaskRunOptions } from "./index.js"
import { App } from "../app.js"

export default class PingTaskHandler extends TaskHandler<"ping"> {
    constructor(app: App) {
        super(app, {
            name: "ping",
            settings: {
                maxQueue: 2,
            },
        })
    }

    public async run({ task: { context } }: TaskRunOptions<"ping">) {
        if (!context.channel.isText()) throw new Error("not a text channel")

        await this.app.ai.process({
            type: "chat",
            channel: context.channel as AIUsableChannel,
            triggers: context.messages,
            author: context.author,
        })
    }
}
