import z from "zod"
import { AIEnvironment } from "../../ai/types/environment.js"

export type ChatMessage =
    | ChatSystemMessage
    | ChatToolMessage
    | ChatAssistantMessage
    | ChatUserMessage

export type ChatInputMessage = ChatMessage
export type ChatOutputMessage = ChatMessage

interface ChatSystemMessage {
    role: "system"
    content: ChatContentPart[]
}

interface ChatToolMessage {
    role: "tool"
    content: []
    toolResults: ChatToolResult[]
}

interface ChatAssistantMessage {
    role: "assistant"
    content: ChatContentPart[]
    toolCalls?: ChatInputToolCall[]
}

interface ChatUserMessage {
    role: "user"
    content: ChatContentPart[]
}

export interface ChatToolResult {
    id: string
    name: string
    data: object | string
    error?: boolean
}

export interface ChatInputToolCall {
    id: string
    name: string
    data: object
}

export interface ChatInputToolParameter {
    type: "object" | "array" | "string" | "number" | "boolean"
    description?: string
    required?: string[]
    enum?: string[]

    properties?: Record<string, ChatInputToolParameter>
    items?: ChatInputToolParameter
}

export interface ChatInputTool {
    name: string
    description?: string
    parameters: ChatInputToolParameter
}

export interface ChatResult<T = any> {
    message?: ChatAssistantMessage
    object?: T
}

export interface ChatRequest {
    environment: AIEnvironment
    messages: ChatOutputMessage[]
    schema?: z.ZodType
    tools?: ChatInputTool[]
}

export type ChatContentPart =
    | ChatContentTextPart
    | ChatContentReasoningPart
    | ChatContentImagePart
    | ChatContentToolCallPart
    | ChatContentToolResultPart

export interface ChatContentTextPart {
    type: "text"
    text: string
}

export interface ChatContentReasoningPart {
    type: "reasoning"
    text: string
}

export interface ChatContentImagePart {
    type: "image"
    url: string
}

export interface ChatContentToolCallPart {
    type: "tool-call"
    tool: ChatToolResult
}

export interface ChatContentToolResultPart {
    type: "tool-result"
    tool: ChatToolResult
}
