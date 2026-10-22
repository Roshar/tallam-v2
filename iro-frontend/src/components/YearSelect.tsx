import { useEffect, useState } from "react";
import { api } from "../api";

interface AcademicYear {
  startYear: number;
  label: string;
}

function useAcademicYears() {
  const [years, setYears] = useState<AcademicYear[]>([]);

  useEffect(() => {
    api<AcademicYear[]>("/meta/academic-years").then(setYears);
  }, []);

  return years;
}

interface YearSelectProps {
  value: number;
  onChange: (year: number) => void;
}

export function YearSelect({ value, onChange }: YearSelectProps) {
  const years = useAcademicYears();

  useEffect(() => {
    if (!value && years[0]) onChange(years[0].startYear);
  }, [years, value, onChange]);

  return (
    <select value={value} onChange={(event) => onChange(+event.target.value)}>
      {years.map((year) => (
        <option key={year.startYear} value={year.startYear}>
          {year.label}
        </option>
      ))}
    </select>
  );
}
