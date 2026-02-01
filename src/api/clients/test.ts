import { APIClient } from "../types/client.js"
import { ChatResult } from "../types/chat.js"
import { App } from "../../app.js"

/**
 * Stub API client to test features, shouldn't be used obviously
 */
export default class TestChatClient extends APIClient {
    constructor(app: App) {
        super(app, {
            name: "test",
            types: ["chat"],
        })
    }

    public async runPrompt(): Promise<ChatResult> {
        return {
            message: {
                content: [
                    {
                        type: "text",
                        text: "",
                    },
                ],
                role: "assistant",
            },
        }
    }
}
