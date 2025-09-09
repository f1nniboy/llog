import { GuildChannel, Message } from "discord.js-selfbot-v13";

import { Utils } from "../util/utils.js";
import { Event } from "./index.js";
import { App } from "../app.js";

function timeUntilInactivity() {
    return Utils.randomNumber(60 * 15, 3600 * 60) * 1000;
}

export default class MessageCreateEvent extends Event<"messageCreate"> {
    constructor(app: App) {
        super(app);
    }

    public async run(message: Message): Promise<void> {
        if (
            message.author.id === this.app.id || !message.channel.isText()
        ) return;

        if (this.app.config.data.blacklist.users.includes(message.author.id)) return;
        if (message.guild && this.app.config.data.blacklist.guilds.includes(message.guild.id)) return;

        if (
            message.channel instanceof GuildChannel
            && !message.channel.permissionsFor(this.app.client.user)?.has("SEND_MESSAGES")
        ) return;

        if (message.guildId) {
            this.app.task.clearForGuild(message.guildId, "deadChat");

            this.app.task.add({
                time: Date.now() + timeUntilInactivity(),
                type: "deadChat",
                context: {
                    channelId: message.channelId,
                    guildId: message.guildId
                }
            });
        }

        const nicknames = this.app.config.data.nickname !== null ?
                typeof this.app.config.data.nickname === "string"
                    ? [ this.app.config.data.nickname ]
                    : this.app.config.data.nickname
                : [];

        /* Whether the bot was explicitly triggered by a mention or reply */
        const triggered = message.mentions.has(this.app.client.user)
            || nicknames.some(name => message.content.toLowerCase().includes(name))
            || message.content.toLowerCase().includes(this.app.client.user.username);

        if (!triggered && !this.app.ai.chance("trigger")) return;

        this.app.task.add({
            time: Date.now(),
            type: "ping",
            context: {
                channelId: message.channelId,
                guildId: message.guildId ?? undefined,
                messageId: message.id,
                userId: message.author.id,
                triggered
            }
        });
    }
}