import { AIUsableChannel } from "../ai/types/environment.js"
import { TaskHandler, TaskRunOptions } from "./index.js"
import { App } from "../app.js"

export default class WorkTaskHandler extends TaskHandler<"work"> {
    constructor(app: App) {
        super(app, {
            name: "work",
            settings: {
                maxQueue: 3,
            },
        })
    }

    public async run({ task }: TaskRunOptions<"work">) {
        const { context } = task

        if (!context.channel.isText()) throw new Error("not a text channel")
        if (!context.instructions) throw new Error("no instructions")

        await this.app.ai.process({
            type: "work",
            channel: context.channel as AIUsableChannel,
            author: context.author,
            task,
        })
    }
}
