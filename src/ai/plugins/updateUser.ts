import {
    Plugin,
    PluginCheckOptions,
    PluginResponse,
    PluginRunOptions,
} from "./index.js"
import { AIManager } from "../manager.js"

interface PluginInput {
    name: string
    nick?: string
    timeout?: number
}

type PluginOutput = string

export default class UpdateUserPlugin extends Plugin<
    PluginInput,
    PluginOutput
> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "updateUser",
            description: "Update user or self on guild",
            triggers: [
                "nick",
                "time out",
                "timeout",
                "rename",
                "update",
                "shut up",
                "still",
            ],
            parameters: {
                name: { type: "string", required: true },
                nick: { type: "string", required: false },
                timeout: {
                    type: "number",
                    description: "in seconds, 0 to remove",
                    required: true,
                },
            },
        })
    }

    public async run({
        data: { name, nick, timeout },
        environment,
    }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        if (!environment.guild) throw new Error("Can only be used on guilds")

        const target = environment.guild.original.members.cache.find(
            (m) => m.user.username == name,
        )
        if (!target) throw new Error("User doesn't exist")

        if (nick) {
            await target.setNickname(nick.slice(undefined, 31))
            return {
                data: `Changed nickname of ${target.id == this.ai.app.id ? "yourself" : name} to ${nick}`,
            }
        }

        if (timeout && target.id != this.ai.app.id) {
            if (target.permissions.has("MODERATE_MEMBERS"))
                throw new Error(
                    "Can't update user, as they are a moderator and have higher permissions",
                )

            await target.timeout(timeout > 0 ? timeout * 1000 : null)
            return { data: `Timed out ${name} for ${timeout} seconds` }
        }
    }

    public check({ environment }: PluginCheckOptions): boolean {
        return environment.guild != undefined
    }
}
