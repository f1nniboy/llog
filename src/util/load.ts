import { basename } from "path"
import { searchFiles } from "./utils.js"

export type Constructor<T> = new (...args: any[]) => T

export async function loadInstances<Class>(
    path: string,
    constructClass: (cls: Constructor<Class>) => Class,
    use: (cls: Class, name: string) => void,
) {
    const files = await searchFiles(path)

    for (const file of files) {
        const module = await import(file)
        const cls = module.default as Constructor<Class>

        const instance = constructClass(cls)
        const name = basename(file).split(".")[0]

        use(instance, name)
    }
}
