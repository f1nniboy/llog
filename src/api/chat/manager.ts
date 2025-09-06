import fetch, { HeadersInit, Response } from "node-fetch";

import { ChatMessage, ChatMessageContent, OpenAIChatBody, OpenAIChatRawResult, OpenAIChatResult, OpenAIImageBody, OpenAIImageResult } from "./types/chat.js";
import { APIError, APIErrorData } from "../../error/api.js";
import { App } from "../../app.js";
import { inspect } from "util";
import { Utils } from "../../util/utils.js";

export type APIPath = "chat/completions"
type APIMethod = "GET" | "POST" | "DELETE"

export interface APIRequest<Body = any> {
    method?: APIMethod;
    body?: Body;
    path: APIPath;
    raw?: boolean;
    headers?: Record<string, string>;
}

export interface APIRawResponse<T = any> {
    data: T;
    code: number;
    success: boolean;
    error: APIErrorData | null;
}

export class ChatAPI {
    private readonly app: App;

    constructor(app: App) {
        this.app = app;
    }

    public static toChatMessage(content: ChatMessage["content"]): ChatMessageContent[] {
        if (typeof content == "string") {
            return [ {
                type: "text",
                text: content.trim()
            } ];
        } else if (Array.isArray(content)) {
            return content;
        } else {
            return [];
        }
    }

    public static chatMessageToString(content: ChatMessage["content"]): string | null {
        if (typeof content == "string") {
            return content;
        } else if (Array.isArray(content)) {
            return content?.[0].text ?? null;
        } else {
            return null;
        }
    }

    public async completions(body: OpenAIChatBody): Promise<OpenAIChatResult> {
        const data: OpenAIChatRawResult = await this.request<OpenAIChatBody, OpenAIChatRawResult>({
            path: "chat/completions", method: "POST", body: {
                ...body, stream: false
            }
        });

        return {
            message: data.choices[0].message,
            usage: data.usage
        };
    }

    public async image({ model, prompt }: OpenAIImageBody): Promise<OpenAIImageResult> {     
        const data: OpenAIChatRawResult = await this.request<OpenAIChatBody, OpenAIChatRawResult>({
            path: "chat/completions", method: "POST", body: {
                model, modalities: [ "image" ], stream: false,
                messages: [ {
                    role: "user",
                    content: `Create the following image and scene: ${prompt}`
                } ]
            }
        });

        const url = data.choices[0].message.images?.at(0)?.image_url.url;
        if (!url) throw new Error("No image URL was returned");

        return {
            data: Utils.dataUriToBuffer(url),
            usage: data.usage
        };
    }

    public async error(response: Response, path: APIPath, type: "error"): Promise<APIError | null>;
    public async error(response: Response, path: APIPath, type: "data"): Promise<APIErrorData | null>;
    public async error(response: Response, path: APIPath, type?: "throw"): Promise<void>;

    public async error(response: Response, path: APIPath, type: "error" | "data" | "throw" = "throw"): Promise<APIErrorData | APIError | null | void> {
        let body: { error: APIErrorData } | null = await response.clone().json().catch(() => null) as any;

        if (body === null || !body.error) {
            if (!response.ok) {
                const error = new APIError({
                    code: response.status, endpoint: path, body: null
                });
    
                if (type === "throw") throw error;
                else return error;
            }

            if (type !== "throw") return null;
            else return;
        }

        if (type === "data") return body.error;
        else if (type === "throw" || type === "error") {
            const error = new APIError({
                body, code: response.status, endpoint: path
            });

            if (type === "throw") throw error;
            else return error;
        }
    }

    public async request<T = any, U = any>(options: APIRequest<T> & { raw: true }): Promise<APIRawResponse<U>>;
    public async request<T = any, U = any>(options: APIRequest<T> & { raw?: boolean }): Promise<U>;

    public async request<T = any, U = any>(options: APIRequest<T>): Promise<U | APIRawResponse<U>> {
        const { path, body, method, raw } = options;
        
        const response = await fetch(this.url(path), {
            method,
            
            body: body !== undefined ? JSON.stringify(body) : undefined,
            headers: { ...this.headers(), ...options.headers ?? {} }
        });

        if (!response.ok && !raw) await this.error(response, path);
        const data: U & { success?: boolean } = await response.json().catch(() => null) as any;

        if (raw) {
            const error: APIErrorData | null = await this.error(response, path, "data");
            const success: boolean = response.ok;

            return {
                code: response.status, data, success, error
            };

        } else {
            if (data.success === false) await this.error(response, path);
            return data;
        }
    }

    public url(path: APIPath): string {
        return `${this.app.config.data.settings.api.baseUrl ?? "https://api.openai.com/v1"}/${path}`;
    }

    public headers(): HeadersInit {
        return {
            Authorization: `Bearer ${this.app.config.data.keys.openai}`,
            "Content-Type": "application/json"
        };
    }
}