const compile = require('eazy-logger').compile;
const path = require('path');
const prettyBytes = require('pretty-bytes');
import {InputTypes, OutputTypes, Result, ResultScore, ResultTypes} from "./index";

/**
 * Just log the scores to the console
 * @param xs
 */
export function sizeReporter (xs, opts) {

    const mapped = xs
        .filter(x => x.type === ResultTypes.Result);

    const decorated = mapped
        .map(result => {
            return result.report.audits['total-byte-weight'].extendedInfo;
        })
        .map((info) => {
            return getBytes(info.value.results);
        });

    if (opts.output === OutputTypes.stdout) {
        Object.keys(decorated).forEach(function (key) {
            decorated[key].forEach(item => {
                console.log(`${key} file count: ${item.items.length}`);
                console.log(`Total size: ${item.total.pretty}`);
            });
        })
    }

    if (opts.output === OutputTypes.json) {

        const json = (function () {
            if (mapped.length === 1) return decorated[0];
            return mapped.reduce((acc, item, i) => {
                acc[item.input.userInput] = decorated[i];
                return acc;
            }, {});
        })();

        const fs = require('fs');
        const path = require('path');
        const outputPath = (function () {
            if (opts.outFile) {
                return path.join(process.cwd(), opts.outFile);
            } else {
                return path.join(process.cwd(), 'result.json');
            }
        })();
        fs.writeFileSync(outputPath, JSON.stringify(json, null, 2));
    }
}

export function getBytes(values) {

    const grouped = values
        .map(value => {
            return (<any>Object).assign({}, value,
                {
                    parsed: path.parse(value.url)
                }
            );
        })
        .reduce(function (acc, item) {
            if (!acc[item.parsed.ext]) {
                acc[item.parsed.ext] = {
                    items: [item]
                };
            } else {
                acc[item.parsed.ext].items.push(item);
            }
            return acc;
        }, {});

    return Object.keys(grouped).reduce(function (acc, key) {
        const total = grouped[key].items.reduce(function (acc, item) {
            return acc + item.totalBytes;
        }, 0);
        grouped[key].total = {
            bytes: total,
            pretty: prettyBytes(total)
        }
        return grouped;
    }, {});
}

export default sizeReporter;
