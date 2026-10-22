/**
 * Пересобирает структуру анкеты для PDF из формы на экране.
 *
 * Запуск: npx tsx scripts/generate-evaluation-form.mts
 * Пишет backend/src/data/evaluation-form.ts. Запускать после правок
 * frontend/src/data/evaluationCriteria.ts, чтобы вложенная в письмо анкета
 * совпадала с тем, что школа видит на странице.
 */
import fs from "node:fs";
import { METHOD_GROUPS, FULL_GROUPS } from "../frontend/src/data/evaluationCriteria.ts";

type Item = { key: string; code: string; title: string };
type Sub = { id: string; title: string; items: Item[] };
type Group = { id: string; title: string; maxScoreLabel: string; subsections: Sub[] };

const shape = (groups: typeof METHOD_GROUPS): Group[] =>
  groups.map((g) => ({
    id: g.id,
    title: g.title,
    maxScoreLabel: g.maxScoreLabel,
    subsections: g.subsections.map((s) => ({
      id: s.id,
      title: s.title,
      items: s.items.map((i) => ({ key: i.key, code: i.code, title: i.title })),
    })),
  }));

const header = `/**
 * Структура анкеты карты оценки для PDF.
 *
 * Собрано скриптом scripts/generate-evaluation-form.mts из
 * frontend/src/data/evaluationCriteria.ts, чтобы вложенная в письмо анкета
 * совпадала с формой на экране. Варианты баллов и подсказки здесь не нужны:
 * в PDF попадают только разделы, формулировки критериев и оценка.
 * После правок criteria запустите скрипт заново.
 */

export interface EvaluationFormItem {
  key: string;
  code: string;
  title: string;
}

export interface EvaluationFormSubsection {
  id: string;
  title: string;
  items: EvaluationFormItem[];
}

export interface EvaluationFormGroup {
  id: string;
  title: string;
  maxScoreLabel: string;
  subsections: EvaluationFormSubsection[];
}
`;

const out =
  header +
  `\nexport const METHOD_FORM: EvaluationFormGroup[] = ${JSON.stringify(shape(METHOD_GROUPS), null, 2)};\n\n` +
  `export const FULL_FORM: EvaluationFormGroup[] = ${JSON.stringify(shape(FULL_GROUPS), null, 2)};\n`;

fs.writeFileSync("backend/src/data/evaluation-form.ts", out);
console.log("backend/src/data/evaluation-form.ts обновлён");
