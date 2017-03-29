const compile = require('eazy-logger').compile;
import {InputTypes, Result, ResultScore, ResultTypes} from "./index";

/**
 * Just log the scores to the console
 * @param xs
 */
export function perfReporter (xs) {

    const mapped = xs
        .filter(x => x.type === ResultTypes.Result)
        .map((result: Result): ResultScore => {

            const lines = [];
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
                                    lines.push(`    ${item.description} {yellow:${item.displayValue}}`)
                                }
                            } else {
                                if (subitem.displayValue) {
                                    lines.push(`    ${subitem.description} {yellow:${subitem.displayValue}}`)
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

    console.log(compile(`
{yellow:  -~-~ Summary ~-~-
`));
    const sorted = mapped.slice().sort((a, b) => b.score - a.score);

    printSummary(sorted);

    console.log(compile(`
{yellow:  -~-~ Details ~-~-
`));

    printLines(sorted);

    function getInputDisplay(resultScore: ResultScore): string {
        if (resultScore.result.input.type === InputTypes.file) {
            return `{bold:${resultScore.result.input.data.url}} [file] {gray:(${resultScore.result.input.userInput})}`;
        }
        return `{bold:${resultScore.result.input.userInput}}`;
    }

    function printSummary(sorted) {
        sorted.forEach(function (item: ResultScore, i) {
            const inputDisplay = getInputDisplay(item);
            console.log(compile(`  {bold:${i + 1}:} {cyan.bold:${item.score}}{cyan:/100} ${inputDisplay}`));
        });
    }

    function printLines(sorted: ResultScore[]) {
        sorted.forEach((resultScore, i) => {
            console.log(compile(`  {bold:${i + 1}:} {cyan.bold:${resultScore.score}}{cyan:/100} ${getInputDisplay(resultScore)}`));
            resultScore.lines.forEach(function (line) {
                console.log(compile(`  ` + line));
            })
        })
    }
}

export default perfReporter;

function getTotalScore (aggregation) {
    const totalScore = aggregation.score.reduce((total, s) => {
            return total + s.overall;
        }, 0) / aggregation.score.length;

    return Math.round(totalScore * 100);
}
