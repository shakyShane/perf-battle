import {Input, InputTypes, InputErrorTypes} from "./index";
import * as path from "path";
import * as fs from "fs";
import {existsSync} from "fs";
const url = require('url');

export function getInputs (userInput: string): Input {
    const maybeUrl = url.parse(userInput);
    if (maybeUrl.protocol && maybeUrl.hostname) {
        return {
            type: InputTypes.url,
            parsed: maybeUrl,
            errors: [],
            userInput
        }
    } else {
        if (maybeUrl.pathname.match(/\.json$/)) {
            const resolved = path.resolve(process.cwd(), maybeUrl.pathname);
            const parsed   = path.parse(resolved);
            const exists   = existsSync(resolved);
            if (!exists) {
                return {
                    type: InputTypes.file,
                    errors: [{type: InputErrorTypes.FileNotFound}],
                    parsed: parsed,
                    resolved: resolved,
                    userInput
                }
            }
            const content = fs.readFileSync(resolved, 'utf8');
            try {
                return {
                    type: InputTypes.file,
                    errors: [],
                    parsed: parsed,
                    resolved: resolved,
                    content,
                    data: JSON.parse(content),
                    userInput
                }
            } catch (e) {
                return {
                    type: InputTypes.file,
                    errors: [{type: InputErrorTypes.JsonParseError, error: e}],
                    parsed: parsed,
                    resolved: resolved,
                    content,
                    userInput
                }
            }
        } else {
            return {
                type: InputTypes.unknown,
                errors: [{type: InputErrorTypes.InputTypeNotSupported}],
                userInput: userInput
            }
        }
    }
}