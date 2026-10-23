export interface DossierCardSummary {
  cardId: number;
  date: string | null;
  dateLabel: string | null;
  percent: number;
  max: number;
}

export interface DossierCardTypeBlock {
  last: DossierCardSummary | null;
  count: number;
}

export interface DossierTrainingItem {
  year: number | null;
  rawYear: string | null;
  place: string | null;
  yearReliable: boolean;
}

export interface DossierDeadline {
  kind: string;
  label: string;
  state: "ok" | "due_soon" | "overdue" | "unknown";
  detail: string;
  dueYear: number | null;
}

export interface DossierSection {
  available: boolean;
  note?: string;
  data: null;
}

export interface TeacherDossier {
  identity: {
    id: string;
    fullName: string;
    surname: string;
    firstname: string;
    patronymic: string | null;
    birthday: string | null;
    age: number | null;
    position: string | null;
    category: string | null;
    education: string | null;
    specialty: string | null;
    totalExperience: number | null;
    teachingExperience: number | null;
    email: string | null;
    phone: string | null;
    subjects: string[];
    projectNames: string[];
  };
  dataQuality: {
    score: number;
    missing: string[];
  };
  evaluation: {
    method: DossierCardTypeBlock;
    full: DossierCardTypeBlock;
    total: number;
    firstEvaluationDate: string | null;
  };
  training: {
    items: DossierTrainingItem[];
    lastReliableYear: number | null;
    hasUnreliableYears: boolean;
  };
  deadlines: DossierDeadline[];
  mentoring: DossierSection;
  portfolio: DossierSection;
}
