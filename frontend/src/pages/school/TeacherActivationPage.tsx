import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";

/**
 * Школьная страница активации кабинетов учителей: сводка, список и приглашения.
 * Школа может раздать ссылки вручную - это работает даже там, где почта в
 * карточке учителя устарела или общая на всю школу.
 */
interface TeacherRow {
  idTeacher: string;
  fullName: string;
  email: string | null;
  status: "activated" | "invited" | "none";
}

interface Overview {
  total: number;
  withEmail: number;
  activated: number;
  invited: number;
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

  async function handleInviteAll() {
    setBusy(true);
    setNotice("");
    try {
      const { links: created } = await api.schoolActivationInvite({ all: true });
      setNotice(
        created.length > 0
          ? `Приглашения готовы: ${created.length}. Ссылки скопированы.`
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

  async function handleCopy(teacherId: string) {
    const link = links.get(teacherId);
    if (!link) return;
    await navigator.clipboard.writeText(link).catch(() => undefined);
    setNotice("Ссылка скопирована");
  }

  async function handleRevoke(teacherId: string) {
    setBusy(true);
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
  if (error || !data) {
    return <div className="alert alert-error">{error || "Нет данных"}</div>;
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
          onClick={() => void handleInviteAll()}
        >
          {busy ? "Готовим..." : "Пригласить всех неактивированных"}
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
          <p className="stat-card__label">Есть почта в карточке</p>
          <p className="stat-card__value">{data.withEmail}</p>
        </div>
      </div>

      {notice ? <div className="alert alert-success">{notice}</div> : null}

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
            {rows.map((row) => (
              <tr key={row.idTeacher}>
                <td>{row.fullName}</td>
                <td>{row.email ?? "нет"}</td>
                <td>{STATUS_LABEL[row.status]}</td>
                <td className="teacher-evaluations__action">
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
                      onClick={() => void handleInviteAll()}
                    >
                      Пригласить
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">В этой группе учителей нет</div>
      ) : null}
    </div>
  );
}
