/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import {URI as Uri} from 'vscode-uri';
import URI from '../common/uri';
import { isWindows } from '../common/os';

export namespace FileUri {

    const windowsDriveRegex = /^([^:/?#]+?):$/;

    /**
     * Creates a new file URI from the filesystem path argument.
     * @param fsPath the filesystem path.
     */
    export function create(fsPath_: string): URI {
        return new URI(Uri.file(fsPath_));
    }

    /**
     * Returns with the platform specific FS path that is represented by the URI argument.
     *
     * @param uri the file URI that has to be resolved to a platform specific FS path.
     */
    export function fsPath(uri: URI | string): string {
        if (typeof uri === 'string') {
            return fsPath(new URI(uri));
        } else {
            /*
             * A uri for the root of a Windows drive, eg file:\\\c%3A, is converted to c:
             * by the Uri class.  However file:\\\c%3A is unambiguously a uri to the root of
             * the drive and c: is interpreted as the default directory for the c drive
             * (by, for example, the readdir function in the fs-extra module).
             * A backslash must be appended to the drive, eg c:\, to ensure the correct path.
             */
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fsPathFromVsCodeUri = (uri as any).codeUri.fsPath;
            if (isWindows) {
                const isWindowsDriveRoot = windowsDriveRegex.exec(fsPathFromVsCodeUri);
                if (isWindowsDriveRoot) {
                    return fsPathFromVsCodeUri + '\\';
                }
            }
            return fsPathFromVsCodeUri;
        }
    }

}
