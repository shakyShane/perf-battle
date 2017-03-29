#!/usr/bin/env node
// const base = '/Users/shakyshane/sites/oss/lighthouse';
import {getTotalScore} from "./utils";
const base = 'lighthouse';

// const base = 'lighthouse';
import {Report} from "../types/report";
const minimist = require('minimist');
const lh = require(`${base}/lighthouse-core`);
const fs = require('fs');
const pr = require(`${base}/lighthouse-cli/printer`);
const compile = require('eazy-logger').compile;
const ChromeLauncher = require(`${base}/lighthouse-cli/chrome-launcher`).ChromeLauncher;
const perfOnlyConfig = require(`${base}/lighthouse-core/config/perf.json`);
const assetSaver = require(`${base}/lighthouse-core/lib/asset-saver`);
import {getInputs} from './inputs';
import * as path from 'path';
import {Url} from "url";
import {perfReporter} from './output-perf';

import Rx = require('rx');
import {sizeReporter} from "./output-size";
const {fromPromise, create, concat, just} = Rx.Observable;
const ora = require('ora');

process.on('unhandledRejection', (reason) => {
    console.log('Reason: ' + reason);
});

const args = minimist(process.argv.slice(2));
const maybes = args._;

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
export interface ResultScore {
    score: number
    lines: string[]
    result: Result
}

export enum InputTypes {
    url     = <any>'url',
    file    = <any>'file',
    unknown = <any>'unknown'
}

export enum ReportTypes {
    perf = <any>'perf',
    size = <any>'size',
}

export enum OutputTypes {
    stdout = <any>'stdout',
    json = <any>'json',
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
        run(withoutErrors, args);
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
                    fromPromise<Report>(lh(input.userInput, {logging: 'quiet'}))
                        .map(report => ({type: ResultTypes.Result, input, report}))
                ).subscribe(obs)
            });
        }
    });
}

const reporterMap = {
    [ReportTypes.perf]: perfReporter,
    [ReportTypes.size]: sizeReporter,
}

function run (inputs: Input[], config = {}) {


    const defaults = {
        reporter: ReportTypes.perf,
        output: OutputTypes.stdout
    };

    const opts = {
        ...defaults,
        ...config
    };

    const launcher = new ChromeLauncher();
    const spinner  = ora('Connecting to Chrome').start();
    const runners  = generateRunners(inputs);

    // Run each job sequentially
    const jobs = Rx.Observable.from(runners).concatAll()
        .do(x => {
            if (x.type === ResultTypes.PreResult) {
                spinner.text = compile(`Testing {bold:${x.input.userInput}}`);
                spinner.start();
            }
            if (x.type === ResultTypes.Result) {
                const score = getTotalScore(x.report.aggregations[0]);
                spinner.text = compile(`{cyan.bold:${score}}{cyan:/100} ${x.input.userInput}`);
                spinner.succeed();
            }
        });

    /**
     * Get the chrome launcher
     * @returns {Observable<any>}
     */
    function getLauncher () {
        return just(true)
            .do(x => spinner.text = 'Connecting to Chrome')
            .flatMap(fromPromise(launcher.isDebuggerReady())) // check if debugger is ready
            // .do(x => spinner.text = 'Connecting to Chrome') // set the spinner
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
    process.removeAllListeners('SIGINT');
    process.on('SIGINT', function () {
        launcher.kill();
        process.exit(0);
    });

    const sub = queue
        .toArray()
        .subscribe(xs => {
            reporterMap[opts.reporter](xs, opts);
            spinner.clear();
            launcher.kill();
        }, err => {
            spinner.fail();
            launcher.kill();
        }, () => {
            spinner.clear();
            launcher.kill();
        });
}
