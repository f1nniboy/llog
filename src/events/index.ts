import { Awaitable, ClientEvents } from "discord.js-selfbot-v13"
import { App } from "../app.js"

export abstract class Event<T extends keyof ClientEvents = keyof ClientEvents> {
    protected readonly app: App

    constructor(app: App) {
        this.app = app
    }

    /* Function to execute when the event has been emitted */
    public abstract run(...args: ClientEvents[T]): Awaitable<void>
}
