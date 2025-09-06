import { OpenAIChatTool, OpenAIChatRawToolCall } from "./function.js";

export interface ChatMessage {
    role: "system" | "tool" | "assistant" | "user";
    content: string | ChatMessageContent[] | null;

    /** Unique identifier for this tool call */
    tool_call_id?: string;

    /** Data about the executed function, specified when the request was executed using functions */
    tool_calls?: OpenAIChatRawToolCall[];

    /** Generated images */
    images?: ChatMessageImage[];
}

export interface ChatMessageImage {
    type: "image_url";
    image_url: {
        url: string;
    }
}

export interface ChatMessageContent {
    type: "text" | "image_url";
    text?: string;
    image_url?: {
        url: string;
    };
}

export interface OpenAIChatBody {
    /** Which chat model to use */
    model: string;

    /** Supported output formats/modalities */
    modalities?: ("image" | "text")[];

    /** How creative the AI is */
    temperature?: number;
    top_p?: number;

    /** Messages to pass to the model */
    messages: ChatMessage[];

    /** Which tools to pass to the model */
    tools?: OpenAIChatTool[];

    /** Whether the response should be streamed; always `false` */
    stream?: false;
}

export interface OpenAIImageBody {
    /** Which image model to use */
    model: string;

    /** Prompt for the generation */
    prompt: string;
}

export interface OpenAIUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface OpenAIChatChoice {
    index: number;
    message: ChatMessage;
}

export interface OpenAIChatRawResult {
    choices: [ OpenAIChatChoice ];
    usage: OpenAIUsage;
}

export interface OpenAIChatResult {
    message: ChatMessage;
    usage: OpenAIUsage;
}

export interface OpenAIImageResult {
    data: Buffer;
    usage: OpenAIUsage;
}