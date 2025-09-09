import { ImagePart, ReasoningPart, ToolCallPart, ToolResultPart } from "@ai-sdk/provider-utils";
import { generateText, jsonSchema, ModelMessage, TextPart, tool, ToolSet } from "ai";
import { createOpenRouter, OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import assert from "assert";

import { ChatTEMP_PARAM_InputTool, ChatRequest, ChatResult, ChatContentPart } from "../../types/chat.js";
import { ChatAPIClient } from "../../types/client.js";
import { App } from "../../../app.js";

interface OpenRouterSettings {
    key: string;
    model: string;
}

function toAPITools(tools: ChatTEMP_PARAM_InputTool[]): ToolSet {
    let final: ToolSet = {};

    for (const t of tools) {
        final[t.name] = tool({
            description: t.description,
            inputSchema: jsonSchema(t.parameters)
        });
    }

    return final;
}

export default class OpenRouterChatClient extends ChatAPIClient<OpenRouterSettings> {
    private instance?: OpenRouterProvider;

    constructor(app: App) {
        super(app, "openrouter");
    }

    public load() {
        this.instance = createOpenRouter({
            apiKey: this.settings.key
        });
    }

    public async run({ messages, tools }: ChatRequest): Promise<ChatResult> {
        assert(this.instance);
        const model = this.instance(this.settings.model);

        const rawMessages: ModelMessage[] = messages.filter(m => m.role != "system").map<ModelMessage>(m => ({
            content: m.content.map<TextPart | ImagePart | ToolCallPart | ToolResultPart | ReasoningPart>(m => {
                if (m.type == "text" || m.type == "reasoning") {
                    return { type: m.type, text: m.text };
                } else if (m.type == "image") {
                    return { type: "image", image: m.url };
                } else if (m.type == "tool-call") {
                    return { type: "tool-call", toolCallId: m.tool.id, toolName: m.tool.name, input: m.tool.data };
                } else if (m.type == "tool-result") {
                    return { type: "tool-result", toolCallId: m.tool.id, toolName: m.tool.name, output: { type: "json", value: m.tool.data as any } };
                } else {
                    throw new Error("Unhandled bot -> API message conversion");
                }
            }) as any,
            role: m.role as any
        }));


        const result = await generateText({
            model,

            messages: rawMessages,
            tools: tools ? toAPITools(tools) : undefined,

            system: messages
                .filter(m => m.role == "system")
                .map(m => m.content[0].type == "text" ? m.content[0].text : "").join("\n"),

        });
      
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
            }
        };
    }
}