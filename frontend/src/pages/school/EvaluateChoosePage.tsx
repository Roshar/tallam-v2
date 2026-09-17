import { Link, useParams } from "react-router-dom";
import { IRO_CARDS_NOTICE } from "../../data/cabinetNews";

export function EvaluateChoosePage() {
  const { teacherId = "" } = useParams();

  return (
    <div className="card">
      <div className="card-body">
        <Link
          to={`/school/lesson-analysis/teachers/${teacherId}`}
          className="teacher-profile__back"
        >
          ← Вернуться к профилю
        </Link>

        <header className="evaluate-choose__header">
          <h2 className="page-title">Выберите тип карты оценки</h2>
          <p className="page-subtitle">
            Оценка урока в проекте «Анализ урока»
          </p>
        </header>

        <div className="evaluate-choose__grid">
          <Link
            to={`/school/lesson-analysis/teachers/${teacherId}/evaluate/method`}
            className="evaluate-choose__card"
          >
            <h3>Карта №1</h3>
            <p>Методические компетенции</p>
            <span>22 критериев</span>
          </Link>

          <Link
            to={`/school/lesson-analysis/teachers/${teacherId}/evaluate/full`}
            className="evaluate-choose__card"
          >
            <h3>Карта №2</h3>
            <p>Комплексная оценка</p>
            <span>
              Предметные, методические, психолого-педагогические и
              коммуникативные компетенции
            </span>
          </Link>
        </div>

        <p className="evaluate-choose__legal">{IRO_CARDS_NOTICE}</p>
      </div>
    </div>
  );
}
