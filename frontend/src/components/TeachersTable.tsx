import { Link } from "react-router-dom";
import { ProjectStatusBadges } from "./ProjectStatusBadges";
import type { TeacherListItem } from "../types/school";

interface TeachersTableProps {
  teachers: TeacherListItem[];
  emptyMessage: string;
  rowOffset?: number;
  viewBasePath?: string;
  viewLabel?: string;
  showProjectStatus?: boolean;
  compact?: boolean;
}

export function TeachersTable({
  teachers,
  emptyMessage,
  rowOffset = 0,
  viewBasePath,
  viewLabel = "Просмотреть",
  showProjectStatus = false,
  compact = false,
}: TeachersTableProps) {
  if (teachers.length === 0) {
    return <p className="table-empty">{emptyMessage}</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>ФИО</th>
            <th>Должность</th>
            {showProjectStatus ? <th>Проект</th> : null}
            {!compact ? (
              <>
                <th>Телефон</th>
                <th>Email</th>
              </>
            ) : null}
            {viewBasePath ? <th>Действие</th> : null}
          </tr>
        </thead>
        <tbody>
          {teachers.map((teacher, index) => (
            <tr key={teacher.id}>
              <td>{rowOffset + index + 1}</td>
              <td>{teacher.fullName}</td>
              <td>{teacher.position ?? "—"}</td>
              {showProjectStatus ? (
                <td className="data-table__project">
                  <ProjectStatusBadges labels={teacher.projectLabels} compact />
                </td>
              ) : null}
              {!compact ? (
                <>
                  <td>{teacher.phone ?? "—"}</td>
                  <td>{teacher.email ?? "—"}</td>
                </>
              ) : null}
              {viewBasePath ? (
                <td>
                  <Link
                    className="table-action-link"
                    to={`${viewBasePath}/${teacher.id}`}
                  >
                    {viewLabel}
                  </Link>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
