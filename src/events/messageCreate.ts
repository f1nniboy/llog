import { Message } from "discord.js-selfbot-v13";

import { Event } from "./index.js";
import { App } from "../app.js";

export default class ReadyEvent extends Event<"messageCreate"> {
    constructor(app: App) {
        super(app);
    }

    public async run(message: Message): Promise<void> {
        this.app.ai.add(message);
    }
}