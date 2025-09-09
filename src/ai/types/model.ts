export type ModelType =
    /** Model to use if the respective option is not configured */
    "base" |

    /** Used when the bot is triggered by a user in a channel */
    "chat" |

    /** Used to execute AI-scheduled tasks */
    "work" |

    /** Used to generate images (OpenRouter model) */
    "image"