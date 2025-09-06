import { Activity, Collection, Guild, GuildMember, Message, VoiceState } from "discord.js-selfbot-v13";

import { AIChannel, AIEnvironment, AIEnvironmentChannel, AIEnvironmentChannelType, AIEnvironmentGuild, AIObject, AIUser } from "./types/environment.js";
import { AIHistory, AIMessage, AIHistoryOptions, AIMessageTag, AIMessageAttachment } from "./types/history.js";
import { AIManager, Characters } from "./manager.js";
import chalk from "chalk";

/* How many messages can be grouped together, max */
const GroupingLimit: number = 4

export class Environment {
    private readonly ai: AIManager;

    constructor(ai: AIManager) {
        this.ai = ai;
    }

    public getByPart(env: AIEnvironment, content: string): AIMessage | undefined {
        /* TODO: fuzzy search in case the AI misquotes */
        return env.history.messages.findLast(m => m.content.includes(content));
    }

    public async fetch(discordChannel: AIChannel, message?: Message): Promise<AIEnvironment> {
        const history = await this.history({
            channel: discordChannel, message, count: this.ai.app.config.data.settings.history.length
        });

        const guild = await this.guild(discordChannel.guild);
        const channel = await this.channel(discordChannel);

        const discordSelf: GuildMember = await guild.original.members.fetchMe();

        /* The user this reply is directed at */
        const user = message ?
            history.users.find(u => u.id === message.author.id) ?? null
            : null;
        
        return {
            history, guild, channel, user, self: await this.user(discordSelf)
        };
    }

    public async history({ channel, count, message }: AIHistoryOptions): Promise<AIHistory> {
        let messages: AIMessage[] = [];
        let usersMap: Collection<string, AIUser> = new Collection();

        const discordMessages: Message[] = Array.from(
            (await channel.messages.fetch({ limit: 50 }) as any as Collection<bigint, Message>)
                .values()
        ).reverse().filter(m => message ? m.id !== message.id : true);

        /* Add the user's request to the top of the history */
        if (message) discordMessages.push(message);

        for (let index = 0; index < discordMessages.length; index++) {
            const discordMessage = discordMessages[index];

            if (discordMessage.author.bot || discordMessage.content.length === 0) continue;

            /* If the message's author is not available as a member, try to fetch it manually */
            if (!discordMessage.member) {
                try {
                    await discordMessage.guild!.members.fetch(discordMessage.author.id);
                } catch {
                    this.ai.app.logger.warn(`Failed to fetch member ${chalk.bold(discordMessage.author.username)} on ${chalk.bold(discordMessage.guild?.name)}.`)
                }
            }

            if (!discordMessage.member) continue;
            if (discordMessage.mentions.parsedUsers.some(u => u.bot)) continue;

            if (!usersMap.has(discordMessage.author.id)) {
                const user: AIUser = await this.user(discordMessage.member);
                usersMap.set(user.id, user);
            }

            const user: AIUser = usersMap.get(discordMessage.author.id)!;
            const message: AIMessage = await this.message(discordMessage, user);

            const grouped: Message[] = [];
            
            for (let i = index + 1; i < discordMessages.length; i++) {
                const msg = discordMessages[i];
                
                if (!discordMessage.member || msg.content.length === 0 || discordMessage.author.bot) continue;
                if (msg.author.id !== discordMessage.author.id || msg.reference !== null || grouped.length >= GroupingLimit) break;

                grouped.push(msg);
            }

            if (grouped.length > 0) {
                discordMessages.splice(index, grouped.length);
                message.content = `${message.content}${Characters.Splitting}${grouped.map(m => m.content).join(Characters.Splitting)}`;
            }

            messages.push(message);
        }

        messages = messages.slice(-count);
        usersMap = usersMap.filter(u => messages.some(m => m.author.id === u.id));

        return {
            messages, users: Array.from(usersMap.values())
        };
    }

    private async message(message: Message, user: AIUser): Promise<AIMessage> {
        const discordReply = message.reference !== null ? await message.fetchReference().catch(() => null) : null;

        const reference = discordReply !== null && discordReply.member !== null && discordReply.type === "DEFAULT"
            ? await this.message(discordReply, await this.user(discordReply.member!))
            : undefined;

        /** Additional tags for the message */
        const tags: AIMessageTag[] = [];
        
        if (message.stickers.size > 0) {
            const stickers = Array.from(message.stickers.values());

            tags.push({
                name: "stickers", content: stickers.map(s => s.name)
            });
        }

        const attachments: AIMessageAttachment[] = [];

        if (message.attachments.size > 0) {
            const rawAttachments = Array.from(message.attachments.values());

            for (const a of rawAttachments) {
                attachments.push(({
                    url: a.url
                }));
            }

            tags.push({
                name: "attachments", content: rawAttachments.filter(a => a.name).map(a => a.name!)
            });
        }

        /** If this message mentioned the bot */
        const cleanContent = message.content.replaceAll(`<@${this.ai.app.id}>`, "");
        const mentioned = cleanContent != message.content;

        return {
            author: user, content: cleanContent, id: message.id, tags,
            replyTo: reference, when: message.createdAt.toISOString(),
            attachments, mentioned,
            self: user.id == this.ai.app.id
        };
    }

    public async user(original: GuildMember): Promise<AIUser> {
        const activity: Activity | null = original.presence && original.presence.activities.length > 0
            ? original.presence.activities[0] : null;

        const voiceState: VoiceState | null = original.guild.voiceStates.cache.get(original.id) ?? null;

        return {
            name: original.user.username, id: original.id,
            nick: original.nickname,
            status: original.presence?.status ?? null,
            relationship: original.user.relationship as any !== "NONE" ? original.user.relationship : null,
            activity: activity !== null ? {
                details: activity.details,
                state: activity.state,
                name: activity.name
            } : null,
            voice: voiceState !== null && voiceState.channel && voiceState.channel.isVoice() ? {
                channel: voiceState.channel.name,
                deafened: voiceState.deaf,
                muted: voiceState.mute
            } : null,
            self: original.id === this.ai.app.id, original
        };
    }

    private async guild(original: Guild): Promise<AIEnvironmentGuild> {
        const discordOwner = await original.fetchOwner();
        const owner = await this.user(discordOwner);

        return {
            name: original.name, id: original.id, owner, original
        };
    }

    private async channel(original: AIChannel): Promise<AIEnvironmentChannel> {
        return {
            name: original.name, type: this.channelType(original), id: original.id, original
        };
    }

    private channelType(channel: AIChannel): AIEnvironmentChannelType {
        if (channel.isThread()) return "thread";
        if (channel.type === "GUILD_VOICE") return "voice-text";
        if (channel.type === "GUILD_STAGE_VOICE") return "stage-text";

        return "text";
    }

    public stringify(obj: AIObject<any, any>, omit?: string[], separator?: string): string {
        let str: string = "";

        for (const [ key, value ] of Object.entries(obj)) {
            if (key === "original" || key === "id" || omit?.includes(key) || !value) continue;
            str += `${key}: ${[ "number", "string", "boolean" ].includes(typeof value) ? value.toString() : `{ ${this.stringify(value, undefined, "; ")} }`}${separator ?? "\n"}`;
        }

        return str;
    }
}