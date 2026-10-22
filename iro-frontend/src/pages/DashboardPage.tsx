import { useEffect, useState } from "react";
import { api } from "../api";
import { Cards } from "../components/Cards";
import { YearSelect } from "../components/YearSelect";

export function DashboardPage() {
  const [year, setYear] = useState(0);
  const [data, setData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (year) {
      api<Record<string, unknown>>(
        `/dashboard?academicYearStart=${year}`,
      ).then(setData);
    }
  }, [year]);

  return (
    <>
      <div className="title">
        <h1>Главная</h1>
        <YearSelect value={year} onChange={setYear} />
      </div>
      <Cards data={data} />
    </>
  );
}
