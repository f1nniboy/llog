export interface ChatMessage {
    role: "system" | "tool" | "assistant" | "user";
    content: ChatContentPart[];
}

export type ChatInputMessage = ChatMessage

export type ChatOutputMessage = ChatMessage & {
    tools?: ChatToolCall[];
}

export interface ChatToolCall {
    id: string;
    name: string;
    data: object;
}

export interface ChatInputToolParameter {
    type: "object" | "array" | "string" | "number" | "boolean";
    description?: string;
    required?: string[];
    enum?: string[];

    properties?: Record<string, ChatInputToolParameter>;
    items?: ChatInputToolParameter;
}

export interface ChatInputTool {
    name: string;
    description?: string;
    parameters: ChatInputToolParameter;
}

export interface ChatResult {
    message: ChatOutputMessage;
}

export interface ChatRequest {
    messages: ChatInputMessage[];
    tools?: ChatInputTool[];
}

export type ChatContentPart =
    ChatContentTextPart
    | ChatContentReasoningPart
    | ChatContentImagePart
    | ChatContentToolCallPart
    | ChatContentToolResultPart

export interface ChatContentTextPart {
    type: "text";
    text: string;
}

export interface ChatContentReasoningPart {
    type: "reasoning";
    text: string;
}

export interface ChatContentImagePart {
    type: "image";
    url: string;
}

export interface ChatContentToolCallPart {
    type: "tool-call";
    tool: ChatToolCall;
}

export interface ChatContentToolResultPart {
    type: "tool-result";
    tool: ChatToolCall;
}