export interface ProjectConfig {
    room?: string;
    url?: string;
}
export declare const DEFAULT_PORT = 7777;
export declare const DEFAULT_URL = "http://127.0.0.1:7777";
export declare const CONFIG_FILE = "conclave.json";
/**
 * Walk up from cwd to find the project root: the nearest directory with
 * a conclave.json, else the nearest with .git, else package.json, else cwd.
 */
export declare function findProjectRoot(cwd?: string): string;
export declare function readProjectConfig(root: string): ProjectConfig;
/** Turn an arbitrary name into a safe room slug. */
export declare function slugify(name: string): string;
/**
 * Derive the room for a project deterministically from its root path:
 * `<folder-slug>-<8 char path hash>`. Same project → same room on every
 * run and for every agent; different projects (even with the same folder
 * name) → different rooms, so they can never cross-talk.
 */
export declare function roomForPath(root: string): string;
export interface ProjectContext {
    root: string;
    room: string;
    url: string;
}
/**
 * Resolve the effective project context. Precedence:
 * explicit CLI flag > CONCLAVE_ROOM/CONCLAVE_URL env > conclave.json > derived.
 */
export declare function projectContext(cwd?: string): ProjectContext;
export declare function isLoopback(url: string): boolean;
