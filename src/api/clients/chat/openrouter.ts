import { ImagePart, ReasoningPart, ToolCallPart, ToolResultPart } from "@ai-sdk/provider-utils";
import { generateText, jsonSchema, ModelMessage, TextPart, tool, ToolSet } from "ai";
import { createOpenRouter, OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import assert from "assert";
import z from "zod";

import { ChatInputTool, ChatRequest, ChatResult, ChatContentPart } from "../../types/chat.js";
import { ChatAPIClient } from "../../types/client.js";
import { App } from "../../../app.js";

const SettingsSchema = z.object({
  key: z.string(),
  model: z.string()
})

type SettingsType = z.infer<typeof SettingsSchema>

function toAPITools(tools: ChatInputTool[]): ToolSet {
    let final: ToolSet = {};

    for (const t of tools) {
        final[t.name] = tool({
            description: t.description,
            inputSchema: jsonSchema(t.parameters)
        });
    }

    return final;
}

export default class OpenRouterChatClient extends ChatAPIClient<SettingsType> {
    private instance?: OpenRouterProvider;

    constructor(app: App) {
        super(app, "openrouter", SettingsSchema);
    }

    public load() {
        this.instance = createOpenRouter({
            apiKey: this.settings.key
        });
    }

    public async run({ messages, tools }: ChatRequest): Promise<ChatResult> {
        assert(this.instance);
        const model = this.instance(this.settings.model);

        //console.log(messages.map(m => chatMessageToString(m)).join("\n\n"));

        const rawMessages: ModelMessage[] = messages.map<ModelMessage>(m => ({
            content: m.role != "system"
                ?
                m.content.map<TextPart | ImagePart | ToolCallPart | ToolResultPart | ReasoningPart | string>(p => {
                    if (p.type == "text" || p.type == "reasoning") {
                        return { type: p.type, text: p.text };
                    } else if (p.type == "image") {
                        return { type: "image", image: p.url };
                    } else if (p.type == "tool-call") {
                        return { type: "tool-call", toolCallId: p.tool.id, toolName: p.tool.name, input: p.tool.data };
                    } else if (p.type == "tool-result") {
                        return { type: "tool-result", toolCallId: p.tool.id, toolName: p.tool.name, output: { type: "json", value: p.tool.data as any } };
                    } else {
                        throw new Error("Unhandled bot -> API message conversion");
                    }
                }) as any
                : m.content[0].type == "text" ? m.content[0].text : "",
            role: m.role
        }));

        const result = await generateText({
            model,

            messages: rawMessages,
            tools: tools ? toAPITools(tools) : undefined,

            temperature: 0.3,
        });

        //console.log(result, result.finishReason, result.totalUsage)
      
        return {
            message: {
                role: "assistant",
                content: result.content.map<ChatContentPart>(c => {
                    if (c.type == "tool-call") {
                        return { type: "tool-call", tool: { name: c.toolName, id: c.toolCallId, data: c.input } };
                    } else if (c.type == "tool-result") {
                        return { type: "tool-result", tool: { name: c.toolName, id: c.toolCallId, data: c.output } };
                    } else if (c.type == "text" || c.type == "reasoning") {
                        return { type: c.type, text: c.text };
                    } else {
                        throw new Error("Unhandled API -> bot message conversion");
                    }
                }),
                tools: result.toolCalls.map(c => ({
                    id: c.toolCallId,
                    name: c.toolName,
                    data: c.input
                }))
            },
            usage: {
                input: result.totalUsage.inputTokens ?? 0,
                output: result.totalUsage.outputTokens ?? 0
            }
        };
    }
}