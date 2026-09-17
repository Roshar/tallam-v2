import { Link } from "react-router-dom";
import { IRO_CARDS_NOTICE } from "../../data/cabinetNews";

const STEPS = [
  {
    title: "Добавьте учителей в базу кабинета",
    text: "Если работника ещё нет в системе, откройте «База работников» и создайте карточку: ФИО, должность, предметы. Поле «Добавить в проект» уже стоит на «Анализ урока». Оставьте его, и учитель сразу появится в проекте.",
    to: "/school/workers",
    link: "Открыть базу работников",
  },
  {
    title: "Добавьте в проект тех, кто уже есть в базе",
    text: "Анализ проводится только по участникам проекта. Новых работников шаг 1 включает сам. Если карточка уже была в базе школы, откройте раздел проекта, нажмите «Добавить учителя в проект» и выберите нужных.",
    to: "/school/lesson-analysis/members",
    link: "Добавить участников проекта",
  },
  {
    title: "Выберите карту и проведите анализ",
    text: "Откройте профиль учителя в проекте, нажмите «Оценить» и выберите карту: методические компетенции или комплексную оценку. Заполните критерии, при необходимости укажите данные оценивающего и комментарий.",
    to: "/school/lesson-analysis",
    link: "Перейти к проекту",
  },
  {
    title: "Сохраните результат и работайте с ним дальше",
    text: "Готовая оценка открывается по клику на строку в списке. Там можно распечатать карту, скачать методические рекомендации, отправить их учителю, дополнить комментарий или удалить анализ.",
    to: "/school/lesson-analysis",
    link: "К списку участников",
  },
];

export function SchoolGuidePage() {
  return (
    <div className="card school-guide">
      <div className="card-body">
        <Link to="/school/cabinet" className="teacher-profile__back">
          ← На главную кабинета
        </Link>

        <header className="school-guide__header">
          <p className="school-home__eyebrow">Первый вход</p>
          <h2 className="page-title">Инструкция по работе в кабинете</h2>
          <p className="page-subtitle">
            Краткий порядок действий: от базы работников до сохранённой оценки
            урока.
          </p>
        </header>

        <ol className="school-guide__steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="school-guide__step">
              <span className="school-guide__num">{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <Link to={step.to}>{step.link} →</Link>
              </div>
            </li>
          ))}
        </ol>

        <section className="school-guide__note">
          <h3>Две карты анализа</h3>
          <p>
            <strong>Карта №1 - методические компетенции.</strong> Подходит, когда
            нужно оценить организацию урока: цели, деятельность учащихся,
            обратную связь, ресурсы и здоровьесбережение.
          </p>
          <p>
            <strong>Карта №2 - комплексная оценка.</strong> Добавляет предметный
            блок, психолого-педагогические и коммуникативные компетенции.
          </p>
          <p>{IRO_CARDS_NOTICE}</p>
        </section>
      </div>
    </div>
  );
}
