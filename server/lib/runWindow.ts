/** At most `limit` takes in any rolling `windowMs`. */
export const createRunWindow = (limit: number, windowMs: number) => {
    const runs: number[] = [];
    return {
        tryTake: (now: number): boolean => {
            while (runs.length && now - runs[0] >= windowMs) runs.shift();
            if (runs.length >= limit) return false;
            runs.push(now);
            return true;
        },
        reset: () => {
            runs.length = 0;
        }
    };
};
