import { injectable } from 'inversify';

@injectable()
export class EnvironmentUtils {

    /**
     * Merge a given record of environment variables with the process environment variables.
     * Empty string values will not be included in the final env.
     * @param env desired environment to merge with `process.env`.
     * @returns a normalized merged record of valid environment variables.
     */
    mergeProcessEnv(env: Record<string, string | null> = {}): Record<string, string> {
        env = this.normalizeEnv(env); 
        const mergedEnv: Record<string, string> = Object.create(null);
        for (const [key, value] of Object.entries(this.normalizeEnv(process.env))) {
            // Ignore keys from `process.env` that are overridden in `env`. Accept only non-empty strings.
            if (!(key in env) && value) { mergedEnv[key] = value; }
        }
        for (const [key, value] of Object.entries(env)) {
            // Accept only non-empty strings from the `env` object.
            if (value) { mergedEnv[key] = value; }
        }
        return mergedEnv;
    }

    /**
     * Normalize an environment record for a given OS.
     *
     * On Windows it will uppercase all keys.
     *
     * @param env Environment variables map to normalize.
     * @param platform Platform to normalize for.
     * @returns New object with normalized environment variables.
     */
    normalizeEnv<T>(env: Record<string, T>): Record<string, T> {
        if (this.getPlatform() !== 'win32') {
            return { ...env };
        }
        const normalized: Record<string, T> = {};
        for (const [key, value] of Object.entries(env)) {
            normalized[key.toLocaleUpperCase()] = value;
        }
        return normalized;
    }

    protected getPlatform(): NodeJS.Platform {
        return process.platform;
    }
}
