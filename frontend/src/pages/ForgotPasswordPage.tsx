import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaSvg, setCaptchaSvg] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(true);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaAnswer("");
    try {
      const captcha = await api.recoveryCaptcha();
      setCaptchaId(captcha.captchaId);
      setCaptchaSvg(captcha.imageSvg);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить код с картинки",
      );
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const result = await api.forgotPassword({
        email: email.trim(),
        phone: phone.trim(),
        captchaId,
        captchaAnswer,
        website,
      });
      setMessage(result.message);
      setEmail("");
      setPhone("");
      setCaptchaAnswer("");
      await loadCaptcha();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка запроса");
      await loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <h1 className="auth-brand__logo">Tallam</h1>
        <div className="auth-brand__line" />
        <p className="auth-brand__tagline">
          Восстановление доступа к личному кабинету школы
        </p>
      </aside>

      <section className="auth-panel">
        <div className="auth-mobile-header">
          <h1 className="auth-mobile-header__logo">Tallam</h1>
        </div>

        <div className="auth-card">
          <h2 className="auth-card__title">Забыли пароль?</h2>
          <p className="auth-card__subtitle">
            Укажите email кабинета и телефон для связи. Сотрудник портала
            свяжется с вами и поможет восстановить доступ.
          </p>

          <form onSubmit={handleSubmit}>
            {error ? <div className="alert alert-error">{error}</div> : null}
            {message ? <div className="alert alert-success">{message}</div> : null}

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email школы
              </label>
              <input
                id="email"
                className="form-input"
                type="email"
                name="email"
                placeholder="example@school.ru"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="phone">
                Телефон для связи
              </label>
              <input
                id="phone"
                className="form-input"
                type="tel"
                name="phone"
                placeholder="+7 900 000-00-00"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                required
              />
            </div>

            <div className="auth-honeypot" aria-hidden="true">
              <input
                type="text"
                name="website"
                value={website}
                tabIndex={-1}
                autoComplete="off"
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="captcha">
                Код с картинки
              </label>
              <div className="auth-captcha">
                <div className="auth-captcha__image">
                  {captchaSvg ? (
                    <img
                      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(captchaSvg)}`}
                      alt="Код для проверки"
                      width={168}
                      height={52}
                    />
                  ) : (
                    <span>{captchaLoading ? "Загрузка..." : "Нет кода"}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost auth-captcha__reload"
                  onClick={() => void loadCaptcha()}
                  disabled={captchaLoading}
                >
                  Другой код
                </button>
              </div>
              <input
                id="captcha"
                className="form-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Введите 5 цифр"
                value={captchaAnswer}
                onChange={(event) => setCaptchaAnswer(event.target.value)}
                maxLength={5}
                required
              />
            </div>

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Отправка..." : "Отправить обращение"}
            </button>
          </form>

          <p className="auth-card__support">
            <Link to="/auth">← Вернуться ко входу</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
