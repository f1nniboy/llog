import {
    BaseGuildTextChannel,
    Collection,
    DMChannel,
    GroupDMChannel,
    Guild,
    GuildMember,
    Message,
    User,
} from "discord.js-selfbot-v13"
import {
    AIUsableChannel,
    AIEnvironment,
    AIEnvironmentChannel,
    AIEnvironmentChannelType,
    AIEnvironmentGuild,
    AIObject,
    AIUser,
} from "./types/environment.js"
import {
    AIHistory,
    AIMessage,
    AIHistoryOptions,
    AIMessageTag,
} from "./types/history.js"
import { AIManager, Tokens } from "./manager.js"

/* How many messages can be grouped together, max */
const GROUPING_LIMIT = 5

export class Environment {
    private readonly ai: AIManager

    constructor(ai: AIManager) {
        this.ai = ai
    }

    public getMessageByPart(
        env: AIEnvironment,
        content: string,
    ): AIMessage | undefined {
        /* TODO: fuzzy search in case the AI misquotes */
        return env.history.messages.findLast((m) => m.content.includes(content))
    }

    public async fetch(
        discordChannel: AIUsableChannel,
        triggers?: Message[],
    ): Promise<AIEnvironment> {
        const history = await this.history({
            channel: discordChannel,
            triggers,
        })

        const guild =
            discordChannel instanceof BaseGuildTextChannel
                ? await this.guild(discordChannel.guild)
                : undefined

        const channel = await this.channel(discordChannel)

        const discordSelfMember =
            discordChannel instanceof BaseGuildTextChannel
                ? await discordChannel.guild.members.fetchMe()
                : undefined

        /* The user this reply is directed at */
        const user = triggers
            ? (history.users.find((u) => u.id == triggers[0].author.id) ??
              undefined)
            : undefined

        return {
            self: await this.user(this.ai.app.client.user, discordSelfMember),
            history,
            guild,
            channel,
            user,
        }
    }

    public async history({
        channel,
        triggers,
    }: AIHistoryOptions): Promise<AIHistory> {
        const feat = this.ai.app.config.feature("history")

        let messages: AIMessage[] = []
        let usersMap: Collection<string, AIUser> = new Collection()

        const history = feat.enable
            ? (await this.fetchHistory(channel)).filter(
                  (m) => !triggers?.find((trigger) => m.id == trigger.id),
              )
            : []

        /* Add the user's trigger messages to the top of the history */
        if (triggers) history.push(...triggers)

        for (let index = 0; index < history.length; index++) {
            const raw = history[index]

            if (raw.content.length == 0) continue

            if (!usersMap.has(raw.author.id)) {
                const user = await this.user(
                    raw.author,
                    raw.member ?? undefined,
                )
                usersMap.set(user.id, user)
            }

            const user: AIUser = usersMap.get(raw.author.id)!
            const message: AIMessage = await this.message(raw, user)

            if (feat.settings.groupByAuthor) {
                const grouped: Message[] = []

                for (let i = index + 1; i < history.length; i++) {
                    const msg = history[i]

                    if (
                        !raw.member ||
                        msg.content.length == 0 ||
                        raw.author.bot
                    )
                        continue

                    if (
                        msg.author.id != raw.author.id ||
                        msg.reference != null ||
                        grouped.length >= GROUPING_LIMIT
                    )
                        break

                    grouped.push(msg)
                }

                if (grouped.length > 0) {
                    history.splice(index, grouped.length)
                    message.content = `${message.content}${Tokens.SplitInLine}${grouped.map((m) => m.content).join(Tokens.SplitInLine)}`
                }
            }

            messages.push(message)
        }

        messages = messages.slice(-feat.settings.length)

        return {
            messages,
            users: Array.from(usersMap.values()),
        }
    }

    private async message(message: Message, user: AIUser): Promise<AIMessage> {
        const discordReply =
            message.reference != null
                ? await message.fetchReference().catch(() => null)
                : null

        const reference =
            discordReply != null &&
            discordReply.member != null &&
            discordReply.type == "DEFAULT"
                ? await this.message(
                      discordReply,
                      await this.user(discordReply.author, discordReply.member),
                  )
                : undefined

        /* Additional tags for the message */
        const tags: AIMessageTag[] = []

        if (message.stickers.size > 0) {
            const stickers = Array.from(message.stickers.values())

            tags.push({
                name: "stickers",
                content: stickers.map((s) => s.name),
            })
        }

        /* If this message mentioned the bot */
        const cleanContent = message.content.replaceAll(
            `<@${this.ai.app.id}>`,
            `@${this.ai.app.name}`,
        )
        const mentioned = cleanContent != message.content

        return {
            author: user,
            content: cleanContent,
            id: message.id,
            tags,
            replyTo: reference,
            when: message.createdAt.toISOString(),
            mentioned,
            self: user.id == this.ai.app.id,
        }
    }

    public async user(original: User, member?: GuildMember): Promise<AIUser> {
        const activities =
            member && member.presence && member.presence.activities.length > 0
                ? member.presence.activities
                : []

        const voiceState = member?.guild.voiceStates.cache.get(original.id)

        return {
            name: original.username,
            id: original.id,
            nick: member?.nickname ?? undefined,
            status: member?.presence?.status ?? "offline",
            relationship: original.relationship,
            activities: activities.map((a) => ({
                details: a.details ?? undefined,
                state: a.state ?? undefined,
                name: a.name,
                type: a.type,
            })),
            voice:
                voiceState && voiceState.channel && voiceState.channel.isVoice()
                    ? {
                          channel: voiceState.channel.name,
                          deafened: voiceState.deaf ?? undefined,
                          muted: voiceState.mute ?? undefined,
                      }
                    : undefined,
            self: original.id == this.ai.app.id,
            original,
        }
    }

    private async guild(original: Guild): Promise<AIEnvironmentGuild> {
        return {
            name: original.name,
            id: original.id,
            original,
        }
    }

    private async channel(
        original: AIUsableChannel,
    ): Promise<AIEnvironmentChannel> {
        return {
            name:
                original instanceof BaseGuildTextChannel
                    ? original.name
                    : original instanceof DMChannel
                      ? original.recipient.username
                      : original instanceof GroupDMChannel
                        ? (original.name ??
                          `Group chat by ${original.owner.username}`)
                        : "Unknown channel",
            type: this.channelType(original),
            id: original.id,
            original,
        }
    }

    private channelType(channel: AIUsableChannel): AIEnvironmentChannelType {
        if (channel.isThread()) return "thread"
        if (channel.type == "GUILD_VOICE") return "voice-text"
        if (channel.type == "GUILD_STAGE_VOICE") return "stage-text"

        return "text"
    }

    private async fetchHistory(channel: AIUsableChannel): Promise<Message[]> {
        const history: Message[] = []

        /* Cache is pretty much empty, so the bot most likely restarted */
        if (channel.messages.cache.size < 5) {
            history.push(
                ...(
                    await channel.messages.fetch({
                        limit: 50,
                    })
                )
                    .reverse()
                    .values(),
            )
        } else {
            const cache = channel.messages.cache.sort(
                (a, b) => a.createdTimestamp - b.createdTimestamp,
            )

            history.push(...cache.values())
        }

        return history
    }

    public stringify<T extends AIObject>(
        obj: AIObject,
        omit?: (keyof T)[],
        separator?: string,
    ): string {
        let str: string[] = []

        str.push(
            ...Object.entries<object>(obj)
                .filter(
                    ([key, value]) =>
                        !["original", "id"].includes(key) &&
                        !omit?.includes(key as keyof T) &&
                        value != undefined,
                )
                .map(
                    ([key, value]) =>
                        `${key}: ${
                            ["number", "string", "boolean"].includes(
                                typeof value,
                            )
                                ? value.toString()
                                : `{${this.stringify(value, undefined, " ")}}`
                        }`,
                )
                .join(separator ?? "\n"),
        )

        return str.join("")
    }
}
