
import { interfaces } from "inversify";
import {
    createPreferenceProxy,
    PreferenceContribution,
    PreferenceProxy,
    PreferenceSchema,
    PreferenceService
} from '@viz/core/lib/browser/preferences';

export const filesystemPreferenceSchema: PreferenceSchema = {
    "type": "object",
    "properties": {
        "files.watcherExclude": {
            "description": "List of paths to exclude from the filesystem watcher",
            "additionalProperties": {
                "type": "boolean"
            },
            "default": {
                "**/.git/objects/**": true,
                "**/.git/subtree-cache/**": true,
                "**/node_modules/**": true
            }
        }
    }
};

export interface FileSystemConfiguration {
    'files.watcherExclude': { [globPattern: string]: boolean }
}

export const FileSystemPreferences = Symbol('FileSystemPreferences');
export type FileSystemPreferences = PreferenceProxy<FileSystemConfiguration>;

export function createFileSystemPreferences(preferences: PreferenceService): FileSystemPreferences {
    return createPreferenceProxy(preferences, filesystemPreferenceSchema);
}

export function bindFileSystemPreferences(bind: interfaces.Bind): void {
    bind(FileSystemPreferences).toDynamicValue(ctx => {
        const preferences = ctx.container.get<PreferenceService>(PreferenceService);
        return createFileSystemPreferences(preferences);
    }).inSingletonScope();

    bind(PreferenceContribution).toConstantValue({ schema: filesystemPreferenceSchema });
}
