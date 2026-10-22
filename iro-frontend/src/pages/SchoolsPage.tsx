import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { YearSelect } from "../components/YearSelect";

interface Area {
  id: number;
  title: string;
}

interface SchoolRow {
  schoolId: number;
  schoolName: string;
  area: string | null;
  teachers: number;
  evaluatedTeachers: number;
  coveragePercent: number;
  evaluations: number;
  lastEvaluationDate: string | null;
  accountStatus: "on" | "off";
  subscriptionStatus: "active" | "inactive";
}

export function SchoolsPage() {
  const [year, setYear] = useState(0);
  const [items, setItems] = useState<SchoolRow[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [area, setArea] = useState("");
  const [search, setSearch] = useState("");
  const [coverageMin, setCoverageMin] = useState("");
  const [coverageMax, setCoverageMax] = useState("");

  useEffect(() => {
    api<Area[]>("/areas").then(setAreas);
  }, []);

  useEffect(() => {
    if (!year) return;

    const query = new URLSearchParams({
      academicYearStart: String(year),
      status,
      areaId: area,
      search,
      page: String(page),
      pageSize: "20",
    });
    if (coverageMin !== "") query.set("coverageMin", coverageMin);
    if (coverageMax !== "") query.set("coverageMax", coverageMax);

    api<{ items: SchoolRow[]; total: number }>(`/schools?${query}`).then(
      (response) => {
        setItems(response.items);
        setTotal(response.total);
      },
    );
  }, [year, status, area, search, coverageMin, coverageMax, page]);

  return (
    <>
      <div className="title">
        <h1>Школы</h1>
        <YearSelect value={year} onChange={setYear} />
      </div>
      <div className="filters">
        <input
          placeholder="Поиск школы"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
        </select>
        <select value={area} onChange={(event) => setArea(event.target.value)}>
          <option value="">Все районы</option>
          {areas.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Покрытие от"
          value={coverageMin}
          onChange={(event) => setCoverageMin(event.target.value)}
        />
        <input
          type="number"
          placeholder="до"
          value={coverageMax}
          onChange={(event) => setCoverageMax(event.target.value)}
        />
      </div>
      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Школа</th>
              <th>Район</th>
              <th>Учителей</th>
              <th>Оценено</th>
              <th>Покрытие</th>
              <th>Оцениваний</th>
              <th>Последняя оценка</th>
              <th>Кабинет</th>
              <th>Подписка</th>
            </tr>
          </thead>
          <tbody>
            {items.map((school) => (
              <tr key={school.schoolId}>
                <td>
                  <Link to={`/schools/${school.schoolId}`}>
                    {school.schoolName}
                  </Link>
                </td>
                <td>{school.area ?? "-"}</td>
                <td>{school.teachers}</td>
                <td>{school.evaluatedTeachers}</td>
                <td>{school.coveragePercent}%</td>
                <td>{school.evaluations}</td>
                <td>
                  {school.lastEvaluationDate
                    ? new Date(school.lastEvaluationDate).toLocaleDateString(
                        "ru-RU",
                      )
                    : "-"}
                </td>
                <td>
                  {school.accountStatus === "on" ? "Включён" : "Выключен"}
                </td>
                <td>
                  {school.subscriptionStatus === "active" ? "Действует" : "Нет"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Назад
        </button>
        <span>
          {page} · всего {total}
        </span>
        <button
          disabled={page * 20 >= total}
          onClick={() => setPage(page + 1)}
        >
          Далее
        </button>
      </div>
    </>
  );
}
