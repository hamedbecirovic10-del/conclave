export declare function serverIsUp(url: string): Promise<boolean>;
export declare function defaultDbPath(): string;
/**
 * Make sure a conclave server is reachable at `url`. If it is a loopback
 * URL and nothing answers, spawn one detached in the background (shared
 * by all projects on this machine — rooms keep projects isolated) and
 * wait until it responds. Works on Windows, macOS and Linux.
 */
export declare function ensureServer(url: string, options?: {
    quiet?: boolean;
}): Promise<boolean>;
