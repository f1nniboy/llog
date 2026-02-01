import { ChatContentPart, ChatMessage } from "../api/types/chat.js"

export function chatMessageToString(message: ChatMessage): string {
    return message.content
        .filter((p) => p.type == "text")
        .map((p) => (p.type == "text" ? p.text : ""))
        .join("\n")
}

export function stringToMessageContent(text: string): ChatContentPart[] {
    return [
        {
            type: "text",
            text,
        },
    ]
}
