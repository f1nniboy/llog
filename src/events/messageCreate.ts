import {
    Collection,
    Guild,
    GuildChannel,
    Message,
    User,
} from "discord.js-selfbot-v13"
import { AIUsableChannel } from "../ai/types/environment.js"
import { Event } from "./index.js"
import { App } from "../app.js"

interface CollectorData {
    user: User
    channel: AIUsableChannel
    guild?: Guild
    messages: Message[]
    timeout?: NodeJS.Timeout
    triggered: boolean
    waitMs: number
}

export default class MessageCreateEvent extends Event<"messageCreate"> {
    private readonly collectors: Collection<string, CollectorData>

    constructor(app: App) {
        super(app)
        this.collectors = new Collection()
    }

    private getExistingCollector(user: User) {
        return this.collectors.get(user.id)
    }

    private collect(message: Message) {
        let data = this.getExistingCollector(message.author)

        if (data) {
            if (data.timeout) clearTimeout(data.timeout)
            data.messages.push(message)
        } else {
            data = {
                guild: message.guild ?? undefined,
                channel: message.channel,
                user: message.author,
                messages: [message],
                waitMs: this.app.ai.delay("collector"),
                triggered: false,
            }
        }

        /* Whether the bot was explicitly triggered by a mention or reply */
        const triggered =
            message.mentions.has(this.app.client.user) ||
            this.app.ai.nicknames.some((name) =>
                message.content.toLowerCase().includes(name),
            ) ||
            message.content
                .toLowerCase()
                .includes(this.app.client.user.username)

        data.triggered = triggered || data.triggered

        data.timeout = setTimeout(async () => {
            this.collectors.delete(data.user.id)

            const environment = await this.app.ai.env.fetch(
                message.channel,
                data.messages,
            )
            const feat = this.app.config.feature("classify")

            const classification =
                feat.enable && !data.triggered
                    ? await this.app.ai.classify({ environment })
                    : undefined

            if (data.triggered || classification?.continuation) {
                this.app.task.add({
                    type: "ping",
                    context: {
                        messages: data.messages,
                        author: data.user,
                        channel: data.channel,
                    },
                })
            }
        }, data.waitMs)

        this.collectors.set(data.user.id, data)
    }

    public async run(message: Message): Promise<void> {
        if (message.author.id == this.app.id || !message.channel.isText())
            return

        if (this.app.config.data.blacklist?.users?.includes(message.author.id))
            return
        if (
            message.guild &&
            this.app.config.data.blacklist?.guilds?.includes(message.guild.id)
        )
            return

        if (
            message.channel instanceof GuildChannel &&
            !message.channel
                .permissionsFor(this.app.client.user)
                ?.has("SEND_MESSAGES")
        )
            return

        const collector = this.getExistingCollector(message.author)

        if (
            !collector ||
            (collector &&
                collector.channel.id == message.channelId &&
                collector.user.id == message.author.id)
        )
            this.collect(message)
    }
}
