import { OpenAIChatFunction, OpenAIChatRawFunctionCall } from "./function.js";

export interface ChatMessage {
    role: "system" | "function" | "assistant" | "user";
    content: string;

    /** Function name, specified when `role` is `function` */
    name?: string;

    /** Data about the executed function, specified when the request was executed using functions */
    function_call?: OpenAIChatRawFunctionCall;
}

export type ChatModel = "gpt-3.5-turbo" | "gpt-4"

export interface OpenAIChatBody {
    /** Which chat model to use */
    model: ChatModel;

    /** How creative the AI is */
    temperature?: number;
    top_p?: number;

    /** Messages to pass to the model */
    messages: ChatMessage[];

    /** Which functions to pass to the model */
    functions?: OpenAIChatFunction[];

    /** How to call the given functions */
    function_call?: "auto" | "none";

    /** Whether the response should be streamed; always `false` */
    stream?: false;
}

export interface OpenAIChatUsage {
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
    usage: OpenAIChatUsage;
}

export interface OpenAIChatResult {
    message: ChatMessage;
    usage: OpenAIChatUsage;
}