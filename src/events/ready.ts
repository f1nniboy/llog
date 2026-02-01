import chalk from "chalk"
import { Event } from "./index.js"
import { App } from "../app.js"

export default class ReadyEvent extends Event<"ready"> {
    constructor(app: App) {
        super(app)
    }

    public run(): void {
        this.app.logger.info(
            `Started on ${chalk.bold(this.app.client.user.username)}.`,
        )
    }
}
