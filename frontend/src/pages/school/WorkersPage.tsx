import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { TeacherFormModal } from "../../components/TeacherFormModal";
import { TablePagination } from "../../components/TablePagination";
import { TeachersTable } from "../../components/TeachersTable";
import { useSchool } from "../../context/SchoolContext";
import type { TeacherListItem, WorkersPageLimit } from "../../types/school";

export function WorkersPage() {
  const { profile } = useSchool();
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<WorkersPageLimit>(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.schoolWorkers({ page, limit });
      setTeachers(data.teachers);
      setTotal(data.total);
      if (data.page !== page) {
        setPage(data.page);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      await api.downloadWorkersBank();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка экспорта");
    } finally {
      setExporting(false);
    }
  }

  function handleLimitChange(nextLimit: WorkersPageLimit) {
    setLimit(nextLimit);
    setPage(1);
  }

  return (
    <>
      <div className="card">
        <div className="card-body">
          <div className="workers-header">
            <div className="workers-header__main">
              <h2 className="workers-header__school">
                {profile?.schoolName ?? "Загрузка..."}
              </h2>
              <h3 className="workers-header__title">
                Общий список педагогических работников ОО
              </h3>
              <div className="workers-header__meta">
                <p>Город/Район: {profile?.areaName ?? "—"}</p>
                <p>Электронный адрес: {profile?.email ?? "—"}</p>
              </div>
            </div>

            <button
              type="button"
              className="excel-export-btn"
              onClick={() => void handleExport()}
              disabled={exporting || loading}
            >
              <span className="excel-export-btn__icon">XLS</span>
              <span>
                {exporting
                  ? "Формирование..."
                  : "Сформировать банк данных педагогов"}
              </span>
            </button>
          </div>

          <div className="workers-toolbar">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModalOpen(true)}
            >
              Добавить работника в базу ОО
            </button>
          </div>

          {error ? <div className="alert alert-error">{error}</div> : null}

          {loading ? (
            <p className="page-subtitle">Загрузка списка...</p>
          ) : (
            <>
              <TeachersTable
                teachers={teachers}
                rowOffset={(page - 1) * limit}
                viewBasePath="/school/workers"
                showProjectStatus
                emptyMessage="В базе пока нет работников."
              />

              <TablePagination
                page={page}
                limit={limit}
                total={total}
                disabled={loading}
                onPageChange={setPage}
                onLimitChange={handleLimitChange}
              />
            </>
          )}
        </div>
      </div>

      <TeacherFormModal
        mode="create"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => void loadTeachers()}
      />
    </>
  );
}
