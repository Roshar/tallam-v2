import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";

/**
 * Публичная страница активации кабинета учителя. Открывается по персональной
 * ссылке, без входа. Порядок: показать учителю его результаты (зачем ему
 * кабинет) -> собрать его настоящую почту -> подтвердить почту кодом -> пароль.
 */
interface Preview {
  teacher: {
    fullName: string;
    schoolName: string;
    position: string | null;
    cardEmail: string | null;
  };
  summary: {
    evaluations: number;
    latestPercent: number | null;
    latestDate: string | null;
    lastCardType: string | null;
  };
}

export function TeacherActivationPage() {
  const { token = "" } = useParams();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .teacherActivationPreview(token)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setEmail(data.teacher.cardEmail ?? "");
      })
      .catch(() => {
        if (!cancelled) setError("Ссылка недействительна или устарела");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSendCode() {
    setError("");
    setBusy(true);
    try {
      await api.teacherActivationCode(token, email);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    setError("");
    setBusy(true);
    try {
      await api.teacherActivationComplete(token, email, code, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось активировать кабинет");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="loading-state">Открываем ссылку...</div>;
  }

  if (error && !preview) {
    return (
      <div className="activation-page">
        <div className="activation-card">
          <h1>Ссылка не действует</h1>
          <p className="teacher-section-hint">
            Попросите администрацию школы открыть новую ссылку на ваш кабинет.
          </p>
          <Link className="btn btn-ghost" to="/auth">
            На страницу входа
          </Link>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  const { teacher, summary } = preview;

  if (done) {
    return (
      <div className="activation-page">
        <div className="activation-card">
          <h1>Кабинет активирован</h1>
          <p>
            {teacher.fullName}, добро пожаловать. Войти можно по почте{" "}
            <strong>{email}</strong> и паролю, который вы только что задали.
          </p>
          <Link className="btn btn-primary" to="/auth">
            Войти в кабинет
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="activation-page">
      <div className="activation-card">
        <p className="teacher-hero__eyebrow">Личный кабинет учителя</p>
        <h1>{teacher.fullName}</h1>
        <p className="teacher-section-hint">
          {[teacher.schoolName, teacher.position].filter(Boolean).join(" · ")}
        </p>

        <div className="activation-value">
          {summary.evaluations > 0 ? (
            <>
              <p>
                В системе <strong>{summary.evaluations}</strong>{" "}
                {summary.evaluations === 1 ? "оценивание" : "оцениваний"} ваших
                уроков.
              </p>
              {summary.latestPercent !== null ? (
                <p>
                  Последний результат: <strong>{summary.latestPercent}%</strong>
                  {summary.latestDate ? ` (${summary.latestDate})` : ""}
                  {summary.lastCardType ? `, ${summary.lastCardType}` : ""}.
                </p>
              ) : null}
              <p className="teacher-section-hint">
                После активации вы увидите динамику по годам, сильные стороны,
                зоны развития, методические рекомендации и сможете скачать отчет.
              </p>
            </>
          ) : (
            <p>
              Школа открыла вам доступ в личный кабинет. Пока оцениваний нет, но
              они появятся здесь автоматически.
            </p>
          )}
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        {step === 1 ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setStep(2)}
          >
            Активировать кабинет
          </button>
        ) : null}

        {step === 2 ? (
          <div className="activation-form">
            <label>
              <span>Ваша почта</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.ru"
                autoComplete="email"
              />
            </label>
            <p className="teacher-section-hint">
              Укажите почту, к которой у вас есть доступ. На нее придет код
              подтверждения. Адрес в карточке школы может быть неточным.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !email.trim()}
              onClick={() => void handleSendCode()}
            >
              {busy ? "Отправляем..." : "Получить код"}
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="activation-form">
            <p className="teacher-section-hint">
              Код отправлен на <strong>{email}</strong>. Он действует 10 минут.
            </p>
            <label>
              <span>Код из письма</span>
              <input
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
              />
            </label>
            <label>
              <span>Пароль для входа</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="не короче 6 символов"
                autoComplete="new-password"
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || code.length !== 6 || password.length < 6}
              onClick={() => void handleComplete()}
            >
              {busy ? "Создаем кабинет..." : "Создать кабинет"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void handleSendCode()}
            >
              Отправить код еще раз
            </button>
          </div>
        ) : null}

        <p className="teacher-section-hint">
          Ссылка персональная и одноразовая. Если вы не ожидали ее, просто
          закройте страницу.
        </p>
      </div>
    </div>
  );
}
