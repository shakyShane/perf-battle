#!/usr/bin/env node
const base = '/Users/shakyshane/Sites/oss/lighthouse';
// const base = 'lighthouse';
import {Report} from "../types/report";
const minimist = require('minimist');
const lh = require(`${base}/lighthouse-core`);
const fs = require('fs');
const pr = require(`${base}/lighthouse-cli/printer`);
const ChromeLauncher = require(`${base}/lighthouse-cli/chrome-launcher`).ChromeLauncher;
const perfOnlyConfig = require(`${base}/lighthouse-core/config/perf.json`);
const assetSaver = require(`${base}/lighthouse-core/lib/asset-saver`);
import {resolve} from 'path';
import * as path from 'path';
import {existsSync} from 'fs';
import {Url} from "url";

import Rx = require('rx');
const {fromPromise, create, concat, just} = Rx.Observable;
const parse = require('url').parse;
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
    console.log('');
} else {
    const inputs        = getJobs(maybes);
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
        run(generateRunners(withoutErrors));
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

function getJobs (maybes): Input[] {
    return maybes.map(function(userInput): Input {
        const maybeUrl = parse(userInput);
        if (maybeUrl.protocol && maybeUrl.hostname) {
            return {
                type: InputTypes.url,
                parsed: maybeUrl,
                url: userInput,
                errors: [],
                userInput
            }
        } else {
            if (maybeUrl.pathname.match(/\.json$/)) {
                const resolved = resolve(process.cwd(), maybeUrl.pathname);
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
    });
}

function run (runners: Runners) {
    const launcher = new ChromeLauncher();
    const spinner  = ora('Connecting to Chrome').start();
    const ready    = Rx.Observable
        .fromPromise(launcher.isDebuggerReady().catch(() => launcher.run()))
        .flatMap(() => {
            return Rx.Observable.just(true)
                .delay(500)
                .do(() => spinner.succeed())
        })
        .ignoreElements();

    const jobs = Rx.Observable.from(runners)
        .concatAll()
        .do(x => {
            if (x.type === ResultTypes.PreResult) {
                if (x.input.type === InputTypes.url) {
                    spinner.text = `Testing ${x.input.userInput}`;
                    spinner.start()
                }
            }
            if (x.type === ResultTypes.Result) {
                spinner.succeed();
            }
        });


        // .do((result: Result) => {
        //     if (result.input.type === InputTypes.url) {
        //         spinner.color = 'yellow';
        //         spinner.text = result.input.userInput;
        //     }
        // })

    Rx.Observable.concat(ready, jobs)
    //     .do(x => pr.write(x, 'html', `./${assetSaver.getFilenamePrefix({url: x.url})}.report.html`))
    //     .do(x => fs.writeFileSync(`./${assetSaver.getFilenamePrefix({url: x.url})}.report.json`, JSON.stringify(x, null, 2)))

        .toArray()
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

    const mapped = xs.filter(x => x.type === ResultTypes.Result).map((result: Result) => {
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
            url: result.input.url,
            score: getTotalScore(report.aggregations[0]),
            lines: lines
        }
    });

    mapped.forEach(function (item, i) {
        console.log(i === 0 ? `Winner: ${item.url}` : `${i + 1}: ${item.url}`);
        item.lines.forEach(function (line) {
            console.log(line);
        });
    });
}