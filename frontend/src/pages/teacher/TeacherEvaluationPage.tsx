import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { FULL_GROUPS, METHOD_GROUPS, type CriterionDef } from "../../data/evaluationCriteria";
import type { EvaluationDetail } from "../../types/school";

/**
 * Подробный просмотр оценки глазами учителя: только чтение, без действий школы
 * (письмо, удаление, комментарий). Дополнительно объясняется, из чего сложился
 * итоговый балл.
 */

interface CriterionView {
  key: string;
  code: string;
  title: string;
  display: string;
  value: number;
  max: number;
  optional: boolean;
  skipped: boolean;
}

function cardCriteria(cardType: "method" | "full"): {
  items: CriterionDef[];
  maxTotal: number;
} {
  const groups = cardType === "method" ? METHOD_GROUPS : FULL_GROUPS;
  const items = groups.flatMap((group) =>
    group.subsections.flatMap((subsection) => subsection.items),
  );
  const maxTotal = items.reduce((sum, item) => {
    const best = Math.max(...item.options.map((option) => option.value));
    return sum + Math.max(best, 0);
  }, 0);
  return { items, maxTotal };
}

export function TeacherEvaluationPage() {
  const { cardId } = useParams();
  const [detail, setDetail] = useState<EvaluationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    const id = Number(cardId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("Некорректная оценка");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .teacherEvaluation(id)
      .then(({ detail: data }) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError("Оценка не найдена или недоступна");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const analysis = useMemo(() => {
    if (!detail) return null;
    const { items, maxTotal } = cardCriteria(
      detail.cardType === "method" ? "method" : "full",
    );

    const views: CriterionView[] = [];
    for (const item of items) {
      if (!(item.key in detail.scores)) continue;
      const value = Number(detail.scores[item.key] ?? 0);
      const max = Math.max(...item.options.map((option) => option.value), 0);
      const optional = item.options.some((option) => option.value === -1);
      views.push({
        key: item.key,
        code: item.code,
        title: item.title,
        display: detail.displayedScores[item.key] ?? String(value),
        value,
        max,
        optional,
        // Для необязательных критериев 0 означает «—» (критерий не оценивался),
        // а -1 показывается как «0» и вычитается из суммы.
        skipped: optional && value === 0,
      });
    }

    const total = views.reduce((sum, view) => sum + view.value, 0);
    return {
      views,
      maxTotal,
      total,
      percent: maxTotal > 0 ? Math.round((total * 100) / maxTotal) : 0,
      top: views.filter((view) => !view.skipped && view.value === view.max && view.max > 0),
      low: views.filter((view) => !view.skipped && view.value <= 0),
      skipped: views.filter((view) => view.skipped),
    };
  }, [detail]);

  async function handleDownload() {
    const id = Number(cardId);
    if (!Number.isInteger(id) || id <= 0) return;
    setDownloading(true);
    setDownloadError("");
    try {
      await api.teacherEvaluationRecommendations(id);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Не удалось скачать рекомендации",
      );
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <div className="loading-state">Загрузка оценки...</div>;
  }
  if (error || !detail || !analysis) {
    return (
      <div className="alert alert-error">
        {error || "Оценка недоступна"}{" "}
        <Link to="/teacher/evaluations">Вернуться к списку</Link>
      </div>
    );
  }

  return (
    <div className="teacher-cabinet teacher-evaluation">
      <p>
        <Link to="/teacher/evaluations" className="teacher-back">
          ← Мои оценки
        </Link>
      </p>

      <header className="teacher-evaluation__head">
        <div>
          <h1 className="teacher-section-title">{detail.cardTypeLabel}</h1>
          <p className="teacher-section-hint">
            {detail.dateLabel} · {detail.disciplineTitle}
            {detail.classLabel ? ` · ${detail.classLabel}` : ""}
          </p>
          <p className="teacher-section-hint">
            {detail.thema ? `Тема урока: ${detail.thema}` : ""}
          </p>
        </div>
        <div className="teacher-evaluation__score">
          <span className="teacher-evaluation__percent">{analysis.percent}%</span>
          <span className="teacher-evaluation__sum">
            {analysis.total} из {analysis.maxTotal} баллов
          </span>
        </div>
      </header>

      <div className="teacher-evaluation__actions">
        <p className="teacher-evaluation__who">
          {detail.hasEvaluatorIdentity
            ? `Оценивание: ${detail.evaluatorLabel}`
            : detail.sourceLabel}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleDownload()}
          disabled={downloading}
        >
          {downloading
            ? "Готовим файл..."
            : "Скачать методические рекомендации (PDF)"}
        </button>
      </div>

      {downloadError ? (
        <div className="alert alert-error">{downloadError}</div>
      ) : null}

      <section aria-labelledby="criteria-explained">
        <h2 id="criteria-explained" className="teacher-section-title">
          Из чего сложился балл
        </h2>
        <p className="teacher-section-hint">
          Итог — это сумма баллов по всем критериям карты. Ниже отмечено, что
          получилось максимально, что снизило результат и что не оценивалось.
        </p>

        <div className="teacher-explained">
          <div className="teacher-explained__col teacher-explained__col--good">
            <h3>На максимуме ({analysis.top.length})</h3>
            {analysis.top.length === 0 ? (
              <p className="teacher-explained__empty">Нет критериев с максимумом</p>
            ) : (
              <ul>
                {analysis.top.map((view) => (
                  <li key={view.key}>
                    <strong>{view.code}</strong> {view.title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="teacher-explained__col teacher-explained__col--low">
            <h3>Снизили результат ({analysis.low.length})</h3>
            {analysis.low.length === 0 ? (
              <p className="teacher-explained__empty">
                Критериев с нулевым баллом нет
              </p>
            ) : (
              <ul>
                {analysis.low.map((view) => (
                  <li key={view.key}>
                    <strong>{view.code}</strong> {view.title}
                    <span className="teacher-explained__mark">
                      {view.optional && view.value < 0 ? "0 из 2 (ниже нормы)" : `0 из ${view.max}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {analysis.skipped.length > 0 ? (
            <div className="teacher-explained__col">
              <h3>Не оценивались ({analysis.skipped.length})</h3>
              <ul>
                {analysis.skipped.map((view) => (
                  <li key={view.key}>
                    <strong>{view.code}</strong> {view.title}
                    <span className="teacher-explained__mark">прочерк</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="criteria-all">
        <h2 id="criteria-all" className="teacher-section-title">
          Все критерии карты
        </h2>
        <div className="table-wrap">
          <table className="data-table teacher-evaluation__table">
            <thead>
              <tr>
                <th>Критерий</th>
                <th>Формулировка</th>
                <th className="teacher-evaluation__value">Балл</th>
              </tr>
            </thead>
            <tbody>
              {analysis.views.map((view) => (
                <tr
                  key={view.key}
                  className={view.value <= 0 && !view.skipped ? "row-danger" : undefined}
                >
                  <td>{view.code}</td>
                  <td>{view.title}</td>
                  <td className="teacher-evaluation__value">
                    {view.display}
                    <span className="teacher-evaluation__max"> / {view.max}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detail.commentHtml ? (
        <section aria-labelledby="evaluation-comment">
          <h2 id="evaluation-comment" className="teacher-section-title">
            Комментарий к оценке
          </h2>
          <div
            className="teacher-evaluation__comment"
            dangerouslySetInnerHTML={{ __html: detail.commentHtml }}
          />
        </section>
      ) : null}
    </div>
  );
}
