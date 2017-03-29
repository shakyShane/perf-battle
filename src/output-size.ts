const compile = require('eazy-logger').compile;
const path = require('path');
const prettyBytes = require('pretty-bytes');
import {InputTypes, Result, ResultScore, ResultTypes} from "./index";

/**
 * Just log the scores to the console
 * @param xs
 */
export function sizeReporter (xs) {

    const mapped = xs
        .filter(x => x.type === ResultTypes.Result)
        .map(result => {
            return result.report.audits['total-byte-weight'].extendedInfo;
        })
        .map((info) => {
            return getBytes(info.value.results, '.js');
        })
        .map(output => {
            return output['.js'];
        })
        .forEach(item => {
            console.log(`JS file count: ${item.items.length}`);
            console.log(`Total size: ${item.total.pretty}`);
        });
}

export function getBytes(values, ext) {

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
