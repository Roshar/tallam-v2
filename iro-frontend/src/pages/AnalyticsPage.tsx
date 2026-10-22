import { useEffect, useState } from "react";
import { api } from "../api";
import {
  AggregateView,
  type Aggregate,
} from "../components/AggregateView";
import { Tabs, type CardType } from "../components/Tabs";
import { YearSelect } from "../components/YearSelect";

export function AnalyticsPage() {
  const [year, setYear] = useState(0);
  const [cardType, setCardType] = useState<CardType>("method");
  const [data, setData] = useState<Aggregate | null>(null);

  useEffect(() => {
    if (year) {
      api<Aggregate>(
        `/analytics?academicYearStart=${year}&cardType=${cardType}`,
      ).then((response) => setData({ ...response, insufficient: false }));
    }
  }, [year, cardType]);

  return (
    <>
      <div className="title">
        <h1>Аналитика по республике</h1>
        <YearSelect value={year} onChange={setYear} />
      </div>
      <Tabs value={cardType} onChange={setCardType} />
      <AggregateView data={data} />
    </>
  );
}
