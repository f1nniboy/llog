import {
    createOpenRouter,
    OpenRouterProvider,
} from "@openrouter/ai-sdk-provider"
import { inspect } from "util"
import assert from "assert"
import z from "zod"
import {
    generateObject,
    generateText,
    jsonSchema,
    JSONValue,
    ModelMessage,
    TextPart,
    tool,
    ToolSet,
} from "ai"
import { ImagePart, ToolCallPart, ToolResultPart } from "@ai-sdk/provider-utils"
import { ChatInputTool, ChatRequest, ChatResult } from "../types/chat.js"
import { chatMessageToString } from "../../util/chat.js"
import { APIClient } from "../types/client.js"
import { App } from "../../app.js"

const SettingsSchema = z.object({
    key: z.string(),
    model: z.string(),
})

type SettingsType = z.infer<typeof SettingsSchema>

function toAPITools(tools: ChatInputTool[]): ToolSet {
    let final: ToolSet = {}

    for (const t of tools) {
        final[t.name] = tool({
            description: t.description,
            inputSchema: jsonSchema(t.parameters),
        })
    }

    return final
}

export default class OpenRouterChatClient extends APIClient<SettingsType> {
    private instance?: OpenRouterProvider

    constructor(app: App) {
        super(app, {
            name: "openrouter",
            types: ["chat"],
            settings: SettingsSchema,
        })
    }

    public load() {
        this.instance = createOpenRouter({
            apiKey: this.settings.key,
        })

        return super.load()
    }

    public unload() {
        this.instance = undefined
        return super.unload()
    }

    public async runPrompt({
        messages,
        tools,
        schema,
    }: ChatRequest): Promise<ChatResult> {
        assert(this.instance)
        const model = this.instance(this.settings.model)

        const rawMessages: ModelMessage[] = messages.map<ModelMessage>((m) => {
            if (m.role == "system")
                return {
                    role: "system",
                    content: chatMessageToString(m),
                }

            const parts: (
                | TextPart
                | ImagePart
                | ToolCallPart
                | ToolResultPart
            )[] = []

            parts.push(
                ...m.content
                    .filter((c) => c.type == "text" || c.type == "image")
                    .map<TextPart | ImagePart>((p) => {
                        if (p.type == "text")
                            return { type: p.type, text: p.text }
                        else if (p.type == "image")
                            return { type: "image", image: p.url }

                        throw new Error()
                    }),
            )

            if (m.role == "assistant" && m.toolCalls) {
                parts.push(
                    ...m.toolCalls.map<ToolCallPart>((t) => ({
                        type: "tool-call",
                        toolName: t.name,
                        toolCallId: t.id,
                        input: t.data,
                    })),
                )
            } else if (m.role == "tool" && m.toolResults) {
                parts.push(
                    ...m.toolResults.map<ToolResultPart>((t) => ({
                        type: "tool-result",
                        toolName: t.name,
                        toolCallId: t.id,
                        output:
                            typeof t.data == "string"
                                ? {
                                      type: t.error ? "error-text" : "text",
                                      value: t.data,
                                  }
                                : {
                                      type: t.error ? "error-json" : "json",
                                      value: t.data as JSONValue,
                                  },
                    })),
                )
            }

            return {
                role: m.role,
                content: parts as any,
            }
        })

        if (schema) {
            const result = await generateObject({
                model,
                messages: rawMessages,
                schema,
            })

            return {
                object: result.object,
            }
        } else {
            this.app.logger.debug(
                "OpenRouterChatClient#runPrompt",
                inspect(rawMessages, false, null, true),
            )

            const result = await generateText({
                model,
                messages: rawMessages,
                tools: tools ? toAPITools(tools) : undefined,
            })

            return {
                message: {
                    role: "assistant",
                    content: result.content
                        .filter((c) => c.type == "text")
                        .map<TextPart>((c) => ({
                            type: "text",
                            text: c.text,
                        })),
                    toolCalls: result.toolCalls.map((c) => ({
                        id: c.toolCallId,
                        name: c.toolName,
                        data: c.input,
                    })),
                },
            }
        }
    }
}
