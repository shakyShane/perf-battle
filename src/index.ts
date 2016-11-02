#!/usr/bin/env node
const base = '/Users/shakyshane/sites/oss/lighthouse';

// const base = 'lighthouse';
import {Report} from "../types/report";
const minimist = require('minimist');
const lh = require(`${base}/lighthouse-core`);
const fs = require('fs');
const pr = require(`${base}/lighthouse-cli/printer`);
const ChromeLauncher = require(`${base}/lighthouse-cli/chrome-launcher`).ChromeLauncher;
const perfOnlyConfig = require(`${base}/lighthouse-core/config/perf.json`);
const assetSaver = require(`${base}/lighthouse-core/lib/asset-saver`);
import {getInputs} from './inputs';
import * as path from 'path';
import {Url} from "url";

import Rx = require('rx');
const {fromPromise, create, concat, just} = Rx.Observable;
const ora = require('ora');

process.on('unhandledRejection', (reason) => {
    console.log('Reason: ' + reason);
});

function getTotalScore (aggregation) {
    const totalScore = aggregation.score.reduce((total, s) => {
            return total + s.overall;
        }, 0) / aggregation.score.length;

    return Math.round(totalScore * 100);
}

const maybes = minimist(process.argv.slice(2))._;

export type Runners = Rx.Observable<Result>[];
export enum ResultTypes {
    PreResult = <any>'PreResult',
    Result = <any>'Result'
}
export interface Result {
    report?: Report
    input: Input
    type: ResultTypes
}

export enum InputTypes {
    url     = <any>'url',
    file    = <any>'file',
    unknown = <any>'unknown'
}

export enum InputErrorTypes {
    FileNotFound          = <any>'FileNotFound',
    JsonParseError        = <any>'JsonParseError',
    InputTypeNotSupported = <any>'InputTypeNotSupported'
}

export interface InputError {
    type: InputErrorTypes
    error?: Error
}

export interface Input {
    type: InputTypes
    userInput: string
    errors: InputError[]
    parsed?: path.ParsedPath
    resolved?: string
    url?: Url,
    content?: string
    data?: Report
}

if (!maybes.length) {
    console.log('Please provide URLS or paths to JSON files');
} else {
    const inputs        = maybes.map(getInputs);
    const withErrors    = inputs.filter(x => x.errors.length > 0);
    const withoutErrors = inputs.filter(x => x.errors.length === 0);

    if (withErrors.length) {
        console.log('There were errors resolving your inputs');
        withErrors.forEach(function (item) {
            console.log('  input: ', item.userInput);
            item.errors.forEach(function (err) {
                console.log('  error type: ', err.type);
                if (err.type === InputErrorTypes.JsonParseError) {
                    console.log(err.error);
                    return;
                }
            })
        });
    } else {
        run(withoutErrors);
    }
}

function generateRunners (inputs: Input[]): Rx.Observable<Result>[] {
    return inputs.map(input => {
        const base = just({type: ResultTypes.PreResult, input});
        if (input.type === InputTypes.file) {
            return concat(
                base,
                just<Result>({type: ResultTypes.Result, input, report: input.data})
            );
        }
        if (input.type === InputTypes.url) {
            return create<Result>(obs => {
                concat(
                    base,
                    fromPromise<Report>(lh(input.userInput, {logLevel: 'silent'}, perfOnlyConfig))
                        .map(report => ({type: ResultTypes.Result, input, report}))
                ).subscribe(obs)
            });
        }
    });
}

function run (inputs: Input[]) {
    const launcher = new ChromeLauncher();
    const spinner  = ora('').start();
    const runners  = generateRunners(inputs);

    // Run each job sequentially
    const jobs = Rx.Observable.from(runners).concatAll()
        .do(x => {
            if (x.type === ResultTypes.PreResult) {
                spinner.text = `Testing ${x.input.userInput}`;
                if (x.input.type === InputTypes.url) {
                    spinner.start()
                }
            }
            if (x.type === ResultTypes.Result) {
                spinner.succeed();
                // if (x.input.type === InputTypes.url) {
                //     // fs.writeFileSync(`./${assetSaver.getFilenamePrefix({url: x.input.userInput})}.report.json`, JSON.stringify(x.report, null, 2));
                // }
            }
        });

    /**
     * Get the chrome launcher
     * @returns {Observable<any>}
     */
    function getLauncher () {
        return fromPromise(launcher.isDebuggerReady()) // check if debugger is ready
            .do(x => spinner.text = 'Connecting to Chrome') // set the spinner
            .catch(() => fromPromise(launcher.run())) // if isDebuggerReady throws, call it's run method
            .flatMap(() => just(true).do(() => spinner.succeed())) // when the promise resolves, set the spinner
            .ignoreElements(); // ignore any values from this stream
    }

    /**
     * If any URLS are give, launch chrome + run the jobs
     * Otherwise, just run the jobs
     * @type {Rx.Observable}
     */
    const queue = (function (): Rx.Observable<any> {
        if (inputs.some((x:Input) => x.type === InputTypes.url)) {
            return Rx.Observable.concat<Result|boolean>(getLauncher(), jobs);
        }
        return jobs;
    })();

    /**
     * Run the queue
     */
    queue.toArray()
        .subscribe(xs => {
            log(xs);
        }, err => {
            console.error(err);
            launcher.kill();
        }, () => {
            launcher.kill();
        });
}

function log (xs) {

    const mapped = xs
        .filter(x => x.type === ResultTypes.Result)
        .map((result: Result) => {

            const lines  = [];
            const report = result.report;

            report.aggregations.forEach(function (agg) {

                if (agg.scored) {
                    lines.push(`  ${agg.name} ${getTotalScore(agg)}`);
                }

                agg.score.forEach(function (score) {
                    if (score.subItems.length) {
                        score.subItems.forEach(function (subitem) {
                            if (typeof subitem === 'string') {
                                const item = report.audits[<any>subitem];
                                if (item.displayValue) {
                                    lines.push(`    ${item.description} ${item.displayValue}`)
                                }
                            }
                        });
                    }
                })
            });

            return {
                score: getTotalScore(report.aggregations[0]),
                lines: lines,
                result
            }
        });

    console.log('----RESULTS----');
    mapped.slice().sort((a, b) => a.score - b.score).forEach(function (item, i) {
        console.log(` ${i+1}: ${item.result.input.userInput}`);

        // console.log(item.result.input.userInput, item.score);
        // console.log(i === 0 ? `Winner: ${item.url}` : `${i + 1}: ${item.url}`);
        // item.lines.forEach(function (line) {
        //     console.log(line);
        // });
    });
}
