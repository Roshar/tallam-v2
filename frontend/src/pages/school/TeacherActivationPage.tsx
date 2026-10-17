import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";

/**
 * Школьная страница активации кабинетов учителей: сводка, список и приглашения.
 * Школа может раздать ссылки вручную - это работает даже там, где почта в
 * карточке учителя устарела или общая на всю школу.
 *
 * Письма отправляются только по одному и только по кнопке в строке: почтам из
 * карточек доверять нельзя, на общий ящик письмо не уходит.
 */
interface TeacherRow {
  idTeacher: string;
  fullName: string;
  email: string | null;
  status: "activated" | "invited" | "none";
  cardEmail: string | null;
  emailShared: boolean;
  emailIsSchool: boolean;
  inviteSentAt: string | null;
  inviteSendCount: number;
}

interface Overview {
  total: number;
  withEmail: number;
  activated: number;
  invited: number;
  sent: number;
  teachers: TeacherRow[];
  currentInviteLinks: Array<{ idTeacher: string; link: string }>;
}

const STATUS_LABEL: Record<TeacherRow["status"], string> = {
  activated: "Активирован",
  invited: "Приглашен",
  none: "Не приглашен",
};

export function TeacherActivationPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | "none" | "invited" | "activated">("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await api.schoolActivationOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить сводку");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const links = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of data?.currentInviteLinks ?? []) {
      map.set(item.idTeacher, item.link);
    }
    return map;
  }, [data]);

  /** Готовит ссылки без отправки писем: их школа раздает сама. */
  async function handlePrepareAll() {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const { links: created } = await api.schoolActivationInvite({ all: true });
      setNotice(
        created.length > 0
          ? `Ссылки готовы: ${created.length}. Письма не отправлялись.`
          : "Некого приглашать: все учителя уже активированы или приглашены.",
      );
      if (created.length > 0) {
        await navigator.clipboard
          .writeText(created.map((item) => `${item.fullName}: ${item.link}`).join("\n"))
          .catch(() => undefined);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать приглашения");
    } finally {
      setBusy(false);
    }
  }

  /** Ссылка одному учителю - построчная кнопка, а не массовое приглашение. */
  async function handlePrepareOne(teacherId: string) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const { links: created } = await api.schoolActivationInvite({
        teacherIds: [teacherId],
      });
      if (created.length === 0) {
        setNotice("Ссылку не удалось подготовить");
        return;
      }
      await navigator.clipboard.writeText(created[0].link).catch(() => undefined);
      setNotice(`Ссылка для ${created[0].fullName} готова и скопирована`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать ссылку");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(teacherId: string) {
    const link = links.get(teacherId);
    if (!link) return;
    await navigator.clipboard.writeText(link).catch(() => undefined);
    setNotice("Ссылка скопирована");
  }

  /** Письмо одному учителю: сначала школа подтверждает адрес. */
  async function handleSend(row: TeacherRow) {
    const address = row.cardEmail;
    if (!address) return;
    const confirmed = window.confirm(
      `Отправить приглашение на ${address}?\n\n` +
        "Письмо уйдет именно на этот адрес, повторно отправить его нельзя. " +
        "Убедитесь, что это личная почта учителя, а не общий школьный ящик.",
    );
    if (!confirmed) return;

    setBusy(true);
    setNotice("");
    setError("");
    try {
      const result = await api.schoolActivationSendInvite(row.idTeacher);
      setNotice(`Приглашение отправлено на ${result.sentTo}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить письмо");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(teacherId: string) {
    setBusy(true);
    setError("");
    try {
      await api.schoolActivationRevoke(teacherId);
      setNotice("Доступ закрыт");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось закрыть доступ");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return <div className="loading-state">Загрузка...</div>;
  }
  if (error && !data) {
    return <div className="alert alert-error">{error}</div>;
  }
  if (!data) {
    return <div className="alert alert-error">Нет данных</div>;
  }

  const percent =
    data.total > 0 ? Math.round((data.activated * 100) / data.total) : 0;
  const rows = data.teachers.filter(
    (item) => filter === "all" || item.status === filter,
  );

  return (
    <div className="teacher-cabinet">
      <div className="teacher-section-head">
        <div>
          <h1 className="teacher-section-title">Кабинеты учителей</h1>
          <p className="teacher-section-hint">
            Учитель открывает ссылку, подтверждает свою почту кодом и получает
            кабинет со своими оценками.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void handlePrepareAll()}
        >
          {busy ? "Готовим..." : "Подготовить ссылки"}
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <p className="stat-card__label">Работников в базе</p>
          <p className="stat-card__value">{data.total}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Активировали кабинет</p>
          <p className="stat-card__value">
            {data.activated} <span className="teacher-section-hint">({percent}%)</span>
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Приглашены</p>
          <p className="stat-card__value">{data.invited}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Писем отправлено</p>
          <p className="stat-card__value">{data.sent}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Есть почта в карточке</p>
          <p className="stat-card__value">{data.withEmail}</p>
        </div>
      </div>

      {notice ? <div className="alert alert-success">{notice}</div> : null}
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="teacher-filters">
        {([
          ["all", "Все"],
          ["none", "Не приглашены"],
          ["invited", "Приглашены"],
          ["activated", "Активированы"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`teacher-filters__btn${filter === value ? " active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Учитель</th>
              <th>Почта</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const canSend =
                row.status !== "activated" &&
                Boolean(row.cardEmail) &&
                !row.emailShared &&
                !row.emailIsSchool &&
                !row.inviteSentAt;
              return (
                <tr key={row.idTeacher}>
                  <td>{row.fullName}</td>
                  <td>
                    <div>{row.email ?? "нет"}</div>
                    {row.status !== "activated" && row.emailIsSchool ? (
                      <div className="teacher-section-hint">
                        почта школы, только вручную
                      </div>
                    ) : null}
                    {row.status !== "activated" &&
                    row.emailShared &&
                    !row.emailIsSchool ? (
                      <div className="teacher-section-hint">
                        общий адрес, только вручную
                      </div>
                    ) : null}
                    {row.status !== "activated" && row.inviteSentAt ? (
                      <div className="teacher-section-hint">
                        письмо отправлено {row.inviteSentAt}
                      </div>
                    ) : null}
                  </td>
                  <td>{STATUS_LABEL[row.status]}</td>
                  <td className="teacher-evaluations__action">
                    <div className="teacher-actions">
                      {row.status === "invited" ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void handleCopy(row.idTeacher)}
                        >
                          Скопировать ссылку
                        </button>
                      ) : null}
                      {row.status === "none" ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() => void handlePrepareOne(row.idTeacher)}
                        >
                          Пригласить
                        </button>
                      ) : null}
                      {canSend ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() => void handleSend(row)}
                        >
                          Отправить приглашение
                        </button>
                      ) : null}
                      {row.status === "activated" ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() => void handleRevoke(row.idTeacher)}
                        >
                          Закрыть доступ
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">В этой группе учителей нет</div>
      ) : null}
    </div>
  );
}
