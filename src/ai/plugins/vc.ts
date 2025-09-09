import { Collection, Guild, Snowflake, VoiceChannel } from "discord.js-selfbot-v13";
import { VoiceConnection, joinVoiceChannel } from "@discordjs/voice";

import { Plugin, PluginCheckOptions, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

interface PluginInput {
    action: "join" | "leave" | "stream";
    name?: string;
}

type PluginOutput = string

export default class VCPlugin extends Plugin<PluginInput, PluginOutput> {
    private connections: Collection<Snowflake, VoiceConnection>;

    constructor(ai: AIManager) {
        super(ai, {
            name: "vc",
            description: "Join/leave a voice chat, and other actions",
            triggers: [ "voice", "vc", "call" ],
            parameters: {
                action: { type: "string", description: "Which action to perform", enum: [ "join", "leave" ], required: true },
                name: { type: "string", description: "Name of the channel to join/leave, MUST specify when join", required: false },
            }
        });

        this.connections = new Collection();
    }

    private async connect(channel: VoiceChannel): Promise<VoiceConnection> {
        const connection = joinVoiceChannel({
            channelId: channel.id, guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator as any,
            selfDeaf: false, selfMute: true
        });

        this.connections.set(channel.guild.id, connection);
        return connection;
    }
    
    private disconnect(connection: VoiceConnection): void {
        this.connections.delete(connection.joinConfig.guildId);
        connection.disconnect();
    }

    private get(guild: Guild): VoiceConnection | null {
        return this.connections.get(guild.id) ?? null;
    }

    private has(guild: Guild): boolean {
        return this.connections.has(guild.id);
    }

    public async run({ data: { action, name }, environment }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        if (!environment.guild) throw new Error("Can only be used on guilds");
        const { guild: { original: guild } } = environment;
        
        if (action === "join" && !name) throw new Error("Joining a voice channel requires a channel name");
        const channel = guild.channels.cache.find(c => c.name === name && c.isVoice());
        
        if (!channel && action === "join") throw new Error("Channel doesn't exist");
        else if (channel) {
            if (!(channel instanceof VoiceChannel)) throw new Error("Specified channel is not a voice channel");
            if (!channel.joinable) throw new Error("Missing permissions to join voice channel");
        }

        if (action === "join" && channel) {
            if (this.has(guild)) throw new Error("Already connected to a voice channel");

            await this.connect(channel);
            return { data: `Connected to voice channel ${channel.name}` };

        } else {
            const connection = this.get(guild);
            if (connection === null) throw new Error("Not connected to a voice channel");

            const channel = guild.channels.cache.find(c => c.id === connection.joinConfig.channelId)! as VoiceChannel;

            if (action === "leave") {
                this.disconnect(connection);
                return { data: `Disconnected from voice channel ${channel.name}` };
            }
        }
    }

    public check({ environment }: PluginCheckOptions): boolean {
        return environment.guild != undefined;
    }
}