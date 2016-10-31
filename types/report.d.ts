/// <reference path="../node_modules/rx/ts/rx.all.d.ts" />

export interface Timings {
    fCP: number;
    fMPbasic: number;
    fMPpageheight: number;
    fMPwebfont: number;
    fMPfull: number;
    navStart: number;
}

export interface Value {
    timings: Timings;
}

export interface ExtendedInfo {
    value: Value;
    formatter: string;
}

export interface FirstMeaningfulPaint {
    score: number;
    displayValue: string;
    rawValue: number;
    optimalValue: string;
    extendedInfo: ExtendedInfo;
    name: string;
    category: string;
    description: string;
}

export interface Frame {
    timestamp: number;
    progress: number;
}

export interface Value2 {
    first: number;
    complete: number;
    duration: number;
    frames: Frame[];
}

export interface ExtendedInfo2 {
    formatter: string;
    value: Value2;
}

export interface SpeedIndexMetric {
    score: number;
    displayValue: string;
    rawValue: number;
    optimalValue: string;
    extendedInfo: ExtendedInfo2;
    name: string;
    category: string;
    description: string;
}

export interface Value3 {
    percentile: number;
    time: number;
}

export interface ExtendedInfo3 {
    value: Value3[];
    formatter: string;
}

export interface EstimatedInputLatency {
    score: number;
    displayValue: string;
    rawValue: number;
    optimalValue: string;
    extendedInfo: ExtendedInfo3;
    name: string;
    category: string;
    description: string;
}

export interface Timings2 {
    fMP: string;
    visuallyReady: string;
    mainThreadAvail: string;
}

export interface FoundLatency {
    estLatency: string;
    startTime: string;
}

export interface Value4 {
    timings: Timings2;
    expectedLatencyAtTTI: string;
    foundLatencies: FoundLatency[];
}

export interface ExtendedInfo4 {
    value: Value4;
    formatter: string;
}

export interface TimeToInteractive {
    score: number;
    displayValue: string;
    rawValue: number;
    optimalValue: string;
    extendedInfo: ExtendedInfo4;
    name: string;
    category: string;
    description: string;
}

export interface ExtendedInfo5 {
    formatter: string;
    value: any[];
}

export interface UserTimings {
    score: number;
    displayValue: string;
    rawValue: number;
    extendedInfo: ExtendedInfo5;
    name: string;
    category: string;
    description: string;
}

export interface Value5 {
    timestamp: number;
    datauri: string;
}

export interface ExtendedInfo6 {
    formatter: string;
    value: Value5[];
}

export interface Screenshots {
    score: number;
    displayValue: string;
    rawValue: number;
    extendedInfo: ExtendedInfo6;
    name: string;
    category: string;
    description: string;
}

export interface Request {
    url: string;
    startTime: number;
    endTime: number;
    responseReceivedTime: number;
    transferSize: number;
}

export interface Request2 {
    url: string;
    startTime: number;
    endTime: number;
    responseReceivedTime: number;
    transferSize: number;
}

export interface ExtendedInfo7 {
    formatter: string;
}

export interface CriticalRequestChains {
    score: number;
    displayValue: string;
    rawValue: number;
    optimalValue: number;
    extendedInfo: ExtendedInfo7;
    name: string;
    category: string;
    description: string;
}

export interface Audits {
    "first-meaningful-paint": FirstMeaningfulPaint;
    "speed-index-metric": SpeedIndexMetric;
    "estimated-input-latency": EstimatedInputLatency;
    "time-to-interactive": TimeToInteractive;
    "user-timings": UserTimings;
    "screenshots": Screenshots;
    "critical-request-chains": CriticalRequestChains;
}

export interface ExtendedInfo8 {
    value: any;
    formatter: string;
}

export interface SubItem {
    score: number;
    displayValue: string;
    rawValue: number;
    optimalValue: any;
    extendedInfo: ExtendedInfo8;
    name: string;
    category: string;
    description: string;
}

export interface Score {
    overall: number;
    name: string;
    description: string;
    subItems: SubItem[];
}

export interface Aggregation {
    name: string;
    description: string;
    scored: boolean;
    categorizable: boolean;
    score: Score[];
}

export interface Report {
    lighthouseVersion: string;
    generatedTime: Date;
    initialUrl: string;
    url: string;
    audits: Audits;
    aggregations: Aggregation[];
}

