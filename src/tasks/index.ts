import { Collection, Guild, Message, User } from "discord.js-selfbot-v13"
import { randomUUID } from "crypto"
import assert from "assert"
import chalk from "chalk"
import { AIUsableChannel } from "../ai/types/environment.js"
import { loadInstances } from "../util/load.js"
import { App } from "../app.js"

export type TaskType = "ping" | "work"

export interface ScheduledTask<T extends TaskType = TaskType> {
    id: string

    /** When this task should be run, absolute Unix timestamp */
    time: number

    /** Which task handler to use */
    type: T

    /** Additional context for the task */
    context: TaskContext<T>
}

type ScheduleTaskOptions<T extends TaskType> = Pick<
    ScheduledTask<T>,
    "type" | "context"
> &
    Partial<Pick<ScheduledTask<T>, "time">>

export interface TaskRunOptions<T extends TaskType> {
    task: ScheduledTask<T>
}

export interface TaskCheckOptions<T extends TaskType> {
    context: TaskContext<T>
}

interface TaskHandlerData<T extends TaskType> {
    /** Internal name of the task handler */
    name: T

    settings: {
        /** Maximum amount of tasks of type to queue */
        maxQueue: number
    }
}

export type TaskContextMap = {
    ping: {
        messages: Message[]
        channel: AIUsableChannel
        author: User
    }
    work: {
        instructions: string
        guild?: Guild
        channel: AIUsableChannel
        author?: User
    }
}

export type TaskContext<T extends TaskType> = TaskContextMap[T]

export abstract class TaskHandler<T extends TaskType> {
    protected readonly app: App

    /** Information about the task handler & its parameters */
    public readonly options: TaskHandlerData<T>

    constructor(app: App, options: TaskHandlerData<T>) {
        this.app = app
        this.options = options
    }

    /**
     * Run this task with the given context.
     * @param options ...
     */
    public abstract run(options: TaskRunOptions<T>): Promise<void>

    /**
     * Check whether this task should be added to the queue in the first place.
     * @param options ...
     * @returns Whether the task should be added to the queue
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public check(options: TaskCheckOptions<T>): boolean {
        return true
    }
}

export class TaskManager {
    public readonly app: App

    private readonly handlers: Collection<string, TaskHandler<TaskType>>
    private readonly queue: Collection<string, ScheduledTask>
    private current: ScheduledTask | undefined

    private timeout: NodeJS.Timeout | undefined

    constructor(app: App) {
        this.app = app

        this.handlers = new Collection()
        this.queue = new Collection()
    }

    /**
     * Schedule a task to be run in the future.
     * @param task Data about the task
     */
    public async add<T extends TaskType>(options: ScheduleTaskOptions<T>) {
        const existingTasks = this.getTasksByType(options.type)
        const handler = this.getHandlerByType(options.type)

        if (existingTasks.size >= handler.options.settings.maxQueue)
            return undefined

        if (
            !handler.check({
                context: options.context,
            })
        )
            return undefined

        const id = this.randomId()

        const task: ScheduledTask = {
            ...options,
            id,
            time: options.time ?? Date.now(),
        }

        this.scheduleQueue(task)
        this.queue.set(id, task)

        return task
    }

    private scheduleQueue(task?: ScheduledTask) {
        if (this.current != undefined) return
        const now = Date.now()

        const sorted = this.sortTasksByTime()
        const nearTask = sorted.at(0)

        let time = 0

        /* No new task queued, so we finished the current queue entry,
           and want to wait for the next entry */
        if (!task && nearTask) {
            time = Math.max(nearTask.time - now, 0)
        }

        /* If no new task was queued and the queue is empty, we idle */
        if (!task && !nearTask) return

        /* There's no other task in the queue and we want to schedule a new one */
        if (!nearTask && task) {
            time = Math.max(task.time - now, 0)
        }

        /* If there is a task in the queue and we want to add a new one, ... */
        if (nearTask && task) {
            /* If the new task runs earlier than the task in the queue, ... */
            if (nearTask && nearTask.time > task.time) {
                time = Math.max(task.time - now, 0)
            }
        }

        if (this.timeout) clearTimeout(this.timeout)

        this.timeout = setTimeout(() => this.handleQueue(), time)
    }

    public async handleQueue(): Promise<void> {
        /* Grab the first available task, sorted by scheduled time */
        const task = this.sortTasksByTime()[0]
        const handler = this.getHandlerByType(task.type)

        try {
            this.current = task
            this.queue.delete(task.id)

            await this.process(handler, task)
        } catch (error) {
            this.app.logger.error(
                "An error occured while running task",
                chalk.bold(handler.options.name),
                "->",
                error,
            )
        } finally {
            this.current = undefined
            this.scheduleQueue()
        }
    }

    private async process(handler: TaskHandler<TaskType>, task: ScheduledTask) {
        this.app.logger.debug(`Running task type ${chalk.bold(task.type)} ...`)

        await handler.run({
            task,
        })

        this.app.logger.debug(`Ran task type ${chalk.bold(task.type)}.`)
    }

    public async load(): Promise<void> {
        await loadInstances<TaskHandler<TaskType>>(
            "./build/tasks",
            (cls) => new cls(this.app),
            (cls) => this.handlers.set(cls.options.name, cls),
        )

        this.app.logger.info(
            "Loaded",
            chalk.bold(this.handlers.size),
            "task handlers.",
        )
    }

    private sortTasksByTime(): ScheduledTask[] {
        return Array.from(this.queue.values()).sort((a, b) => a.time - b.time)
    }

    private getTasksByType(type: TaskType) {
        return this.queue.filter((t) => t.type == type)
    }

    private getHandlerByType(type: TaskType): TaskHandler<TaskType> {
        const handler = this.handlers.get(type)
        assert(handler)
        return handler
    }

    private randomId() {
        return randomUUID()
    }
}
