import { dirname, join } from "path"
import { fileURLToPath } from "url"
import fs from "fs"

export async function searchFiles(
    path: string,
    files: string[] = [],
): Promise<string[]> {
    const directory = await fs.promises.readdir(path)

    for (const i in directory) {
        const file = directory[i]

        if ((await fs.promises.stat(`${path}/${file}`)).isDirectory()) {
            files = await searchFiles(`${path}/${file}`, files)
        } else {
            const __filename = fileURLToPath(import.meta.url)
            const __dirname = dirname(__filename)

            if (file != "index.js")
                files.push(join(__dirname, "..", "..", path, "/", file))
        }
    }

    return files
}

export function dataUriToBuffer(uri: string) {
    return Buffer.from(uri.split(",")[1], "base64")
}

export function formatDate(date: Date = new Date()) {
    const dateString = date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    })
    const hours = String(date.getUTCHours()).padStart(2, "0")
    const minutes = String(date.getUTCMinutes()).padStart(2, "0")

    return `${dateString}, ${hours}:${minutes} UTC`
}

export function randomNumber(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomValue<T>(arr: T[]): T {
    return arr[randomNumber(0, arr.length)]
}
