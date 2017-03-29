import {Result} from "./index";
export function getSizesOnly(result: Result) {
    console.log(result.report.audits);
}

export function getTotalScore (aggregation) {
    const totalScore = aggregation.score.reduce((total, s) => {
            return total + s.overall;
        }, 0) / aggregation.score.length;

    return Math.round(totalScore * 100);
}
