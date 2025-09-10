import { Collection, GuildChannel, Message, User } from "discord.js-selfbot-v13";

import { Event } from "./index.js";
import { App } from "../app.js";

interface CollectorData {
    userId: string;
    channelId: string;
    guildId?: string;
    last: Message;
    timeout?: NodeJS.Timeout;
    waitMs: number;
}

export default class MessageCreateEvent extends Event<"messageCreate"> {
    private readonly collectors: Collection<string, CollectorData>;

    constructor(app: App) {
        super(app);
        this.collectors = new Collection();
    }

    private getExistingCollector(user: User) {
        return this.collectors.get(user.id);
    }

    private collect(message: Message, triggered: boolean) {
        let data = this.getExistingCollector(message.author);
        
        if (data) {
            if (data.timeout) clearTimeout(data.timeout);
            data.last = message;
        } else {
            data = {
                guildId: message.guildId ?? undefined,
                channelId: message.channelId,
                userId: message.author.id,
                last: message,
                waitMs: this.app.ai.delay("collector")
            };
        }

        data.timeout = setTimeout(() => {
            this.collectors.delete(data.userId);

            this.app.task.add({
                time: Date.now(),
                type: "ping",
                context: {
                    channelId: data.channelId,
                    guildId: message.guildId ?? undefined,
                    messageId: data.last.id,
                    userId: data.userId
                }
            });
        }, data.waitMs);

        this.collectors.set(message.author.id, data);
    }

    public async run(message: Message): Promise<void> {      
        if (message.author.id == this.app.id || !message.channel.isText()) return;

        if (this.app.config.data.blacklist?.users?.includes(message.author.id)) return;
        if (message.guild && this.app.config.data.blacklist?.guilds?.includes(message.guild.id)) return;

        if (
            message.channel instanceof GuildChannel
            && !message.channel.permissionsFor(this.app.client.user)?.has("SEND_MESSAGES")
        ) return;

        /* Whether the bot was explicitly triggered by a mention or reply */
        const triggered = message.mentions.has(this.app.client.user)
            || this.app.ai.nicknames.some(name => message.content.toLowerCase().includes(name))
            || message.content.toLowerCase().includes(this.app.client.user.username);

        const collector = this.getExistingCollector(message.author);

        if (triggered) this.collect(message, triggered);
        else if (!triggered && collector?.channelId == message.channelId) this.collect(message, triggered);
    }
}