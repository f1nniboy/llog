import { MessageAttachment } from "discord.js-selfbot-v13";

import { Plugin, PluginResponse, PluginRunOptions } from "./index.js";
import { AIManager } from "../manager.js";

type PluginInput = {
    prompt: string;
}

type PluginOutput = string

/**
 * Generates a filename in the format IMG_YYYYMMDD_HHMMSSXXX.png, mimicking
 * the pre-Android 11 Google Pixel naming scheme.
 * @param date Optional Date object to use for the filename. Defaults to current UTC time.
 * @returns A string in the format IMG_YYYYMMDD_HHMMSSXXX.png
 */
function generateFilename(date: Date = new Date()): string {
    const utcDate = new Date(date.toUTCString());

    const year = utcDate.getUTCFullYear().toString().padStart(4, '0');
    const month = (utcDate.getUTCMonth() + 1).toString().padStart(2, '0'); // Months are 0-based
    const day = utcDate.getUTCDate().toString().padStart(2, '0');
    const hours = utcDate.getUTCHours().toString().padStart(2, '0');
    const minutes = utcDate.getUTCMinutes().toString().padStart(2, '0');
    const seconds = utcDate.getUTCSeconds().toString().padStart(2, '0');
    const milliseconds = utcDate.getUTCMilliseconds().toString().padStart(3, '0');

    return `IMG_${year}${month}${day}_${hours}${minutes}${seconds}${milliseconds}.png`;
}

export default class GenerateImagePlugin extends Plugin<PluginInput, PluginOutput> {
    constructor(ai: AIManager) {
        super(ai, {
            name: "generateImage",
            description: "Generate an image using a prompt/image description. Use this to 'send' images using your phone camera. Describe the scene in detail. Only send an image if EXPLICITLY asked to send one",
            triggers: [ "send", "generate", "show", "pic", "image", "img", "where", "exif", "send a", "slide" ],
            parameters: {
                prompt: { type: "string", description: "Prompt for the image generation model", required: true }
            }
        });
    }

    public async run({ data: { prompt } }: PluginRunOptions<PluginInput>): PluginResponse<PluginOutput> {
        const result = await this.ai.app.api.chat.image({
            model: "google/gemini-2.5-flash-image-preview",
            prompt: `${prompt} in a hyperrealistic scene, as if the photo was taken by a phone camera, iPhone 13 Ultra HD, realistic lighting, volumetric, 4k, HDR, hyper realistic`
        });

        return {
            attachments: [
                new MessageAttachment(result.data).setName(generateFilename())
            ],
            data: `The generated image with prompt '${prompt}' is attached to your Discord reply`
        };
    }
}