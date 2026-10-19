/**
 * Writer-readable wording for a request that never got an answer from the
 * app's own server (as opposed to a model failure, which the server words).
 * The browser's own text ("Failed to fetch", "NetworkError…") says nothing
 * useful about what happened or what to do.
 */
export const describeRequestFailure = (error: unknown): string =>
    "Couldn't reach The Story Nexus server — check it's still running and this device is connected, then try again." +
    ((error as Error)?.message ? ` (${(error as Error).message})` : "");

/** The connection dropped after text had started arriving. */
export const describeStreamFailure = (error: unknown): string =>
    "The connection to The Story Nexus server dropped partway through." +
    ((error as Error)?.message ? ` (${(error as Error).message})` : "");
