import {
    ChatHistoryItem,
    ChatModelFunctionCall,
    ChatModelFunctions,
    ChatModelSegment,
    GbnfJsonSchema,
    getLlama,
    Llama,
    LlamaChat,
    LlamaModel,
    resolveModelFile,
} from "node-llama-cpp"
import assert from "assert"
import z from "zod"
import {
    ChatInputTool,
    ChatOutputMessage,
    ChatRequest,
    ChatResult,
} from "../types/chat.js"
import { chatMessageToString, stringToMessageContent } from "../../util/chat.js"
import { EmbeddingsEmbedOptions, Embedding } from "../types/embeddings.js"
import { APIClient } from "../types/client.js"
import { App } from "../../app.js"

const SettingsSchema = z.object({
    models: z.object({
        chat: z.string(),
        embeddings: z.string().optional(),
    }),
})

type SettingsType = z.infer<typeof SettingsSchema>

function botToAPIFunctions(tools: ChatInputTool[]): ChatModelFunctions {
    const obj: Record<string, ChatModelFunctions[string]> = {}

    for (const tool of tools) {
        obj[tool.name] = {
            description: tool.description,
            params: tool.parameters as GbnfJsonSchema,
        }
    }

    return obj
}

function botToAPIMessage(message: ChatOutputMessage): ChatHistoryItem[] {
    const messages: ChatHistoryItem[] = []

    if (message.role == "system") {
        messages.push({
            type: "system",
            text: chatMessageToString(message),
        })
    } else if (message.role == "assistant") {
        const parts: (string | ChatModelFunctionCall | ChatModelSegment)[] = []
        if (message.content.length > 0) parts.push(chatMessageToString(message))

        if (message.toolCalls)
            parts.push(
                ...message.toolCalls.map<ChatModelFunctionCall>((t) => ({
                    type: "functionCall",
                    name: t.name,
                    params: {},
                    result: t.data,
                })),
            )

        messages.push({ type: "model", response: parts })
    } else if (message.role == "user") {
        messages.push({
            type: "user",
            text: chatMessageToString(message),
        })
    }

    return messages
}

export default class LlamaCppChatClient extends APIClient<SettingsType> {
    private instance?: Llama
    private models: Partial<Record<"chat" | "embeddings", LlamaModel>>

    constructor(app: App) {
        super(app, {
            name: "llamacpp",
            types: ["chat", "embeddings"],
            settings: SettingsSchema,
        })

        this.models = {}
    }

    public async load() {
        this.instance = await getLlama({
            //progressLogs: true,
            //logLevel: LlamaLogLevel.debug,
        })

        if (this.usedFor("embeddings") && this.settings.models.embeddings) {
            this.models.embeddings = await this.instance.loadModel({
                modelPath: await resolveModelFile(
                    this.settings.models.embeddings,
                ),
                gpuLayers: 0,
            })
        }

        if (this.usedFor("chat")) {
            this.models.chat = await this.instance.loadModel({
                modelPath: await resolveModelFile(this.settings.models.chat),
                defaultContextFlashAttention: true,
            })
        }

        return super.load()
    }

    public async unload() {
        for (const model of Object.values(this.models)) {
            if (model) await model.dispose()
        }

        if (this.instance) await this.instance.dispose()
        return super.unload()
    }

    public async runPrompt({
        messages,
        tools,
        schema,
    }: ChatRequest): Promise<ChatResult> {
        assert(this.instance)
        assert(this.models.chat)

        const context = await this.models.chat.createContext({
            /* TODO: this sucks */
            contextSize: 10000,
        })

        const session = new LlamaChat({
            contextSequence: context.getSequence(),
        })

        const history: ChatHistoryItem[] = []

        for (const m of messages) {
            history.push(...botToAPIMessage(m))
        }

        const functionResult = messages.find((m) => m.role == "tool")
        const slot: ChatHistoryItem = { type: "model", response: [] }

        if (functionResult)
            slot.response.push(
                ...functionResult.toolResults.map<ChatModelFunctionCall>(
                    (c) => ({
                        type: "functionCall",
                        name: c.name,
                        params: {},
                        result: c.data,
                    }),
                ),
            )

        /* Slot for the AI to use */
        history.push(slot)

        if (schema) {
            const grammar = await this.instance.createGrammarForJsonSchema(
                z.toJSONSchema(schema) as any,
            )

            const response = await session.generateResponse(history, {
                grammar,
            })

            session.dispose()
            await context.dispose()

            try {
                const data = JSON.parse(response.response)
                return { object: data }
            } catch {
                return {}
            }
        } else {
            const response = await session.generateResponse(history, {
                functions: tools ? botToAPIFunctions(tools) : undefined,
            })

            session.dispose()
            await context.dispose()

            return {
                message: {
                    role: "assistant",
                    content:
                        response.response.length > 0
                            ? stringToMessageContent(response.response)
                            : [],
                    toolCalls: response.functionCalls?.map((call, index) => ({
                        id: `${call.functionName}_${index}`,
                        name: call.functionName,
                        data: call.params as any,
                    })),
                },
            }
        }
    }

    public async getEmbedding({
        text,
    }: EmbeddingsEmbedOptions): Promise<Embedding> {
        assert(this.instance)
        assert(this.models.embeddings)

        const context = await this.models.embeddings.createEmbeddingContext()
        const embedding = await context.getEmbeddingFor(text)

        await context.dispose()

        return {
            content: text,
            data: embedding.vector as number[],
        }
    }
}
