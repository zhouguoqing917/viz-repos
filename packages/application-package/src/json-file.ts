

import * as fs from 'fs';
import {writeJsonFile} from 'write-json-file';
 

function readJsonFile(path: string): any {
    return JSON.parse(fs.readFileSync(path, { encoding: 'utf-8' }));
}

export { writeJsonFile, readJsonFile };
