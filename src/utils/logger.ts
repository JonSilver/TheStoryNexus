import log from "loglevel";

// Configure log level based on environment
if (import.meta.env.DEV) 
    log.setLevel("debug");
 else 
    log.setLevel("warn");


export const logger = log;
