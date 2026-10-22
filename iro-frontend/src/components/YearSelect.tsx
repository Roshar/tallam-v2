import { useEffect, useState } from "react";
import { api } from "../api";

interface AcademicYear {
  startYear: number;
  label: string;
  isCurrent: boolean;
}

function currentAcademicYearStart() {
  const now = new Date();
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
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
    if (!value && years.length) {
      const current = years.find((year) => year.isCurrent);
      onChange(current?.startYear ?? currentAcademicYearStart());
    }
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
