import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import {
  AggregateView,
  type Aggregate,
} from "../components/AggregateView";
import { Tabs, type CardType } from "../components/Tabs";
import { YearSelect } from "../components/YearSelect";

export function SchoolAnalyticsPage() {
  const { schoolId } = useParams();
  const [year, setYear] = useState(0);
  const [cardType, setCardType] = useState<CardType>("method");
  const [data, setData] = useState<Aggregate | null>(null);

  useEffect(() => {
    if (year) {
      api<Aggregate>(
        `/schools/${schoolId}/analytics?academicYearStart=${year}&cardType=${cardType}`,
      ).then(setData);
    }
  }, [schoolId, year, cardType]);

  return (
    <>
      <div className="title">
        <div>
          <Link to="/schools">← Все школы</Link>
          <h1>Аналитика школы</h1>
        </div>
        <YearSelect value={year} onChange={setYear} />
      </div>
      <Tabs value={cardType} onChange={setCardType} />
      <AggregateView data={data} />
    </>
  );
}
