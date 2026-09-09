import type { WorkersPageLimit } from "../types/school";

const PAGE_SIZE_OPTIONS: WorkersPageLimit[] = [20, 50, 100];

interface TablePaginationProps {
  page: number;
  limit: WorkersPageLimit;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: WorkersPageLimit) => void;
  disabled?: boolean;
}

function getPageNumbers(page: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  return [...pages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
}

export function TablePagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  disabled = false,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="table-pagination">
      <div className="table-pagination__size">
        <label htmlFor="workers-page-size">Показывать по</label>
        <select
          id="workers-page-size"
          className="table-pagination__select"
          value={limit}
          disabled={disabled}
          onChange={(event) =>
            onLimitChange(Number(event.target.value) as WorkersPageLimit)
          }
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <p className="table-pagination__info">
        {total === 0
          ? "Нет записей"
          : `Показано ${from}–${to} из ${total}`}
      </p>

      <div className="table-pagination__controls">
        <button
          type="button"
          className="btn btn-ghost table-pagination__btn"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Назад
        </button>

        {pageNumbers.map((pageNumber, index) => {
          const prev = pageNumbers[index - 1];
          const showEllipsis = prev !== undefined && pageNumber - prev > 1;

          return (
            <span key={pageNumber} className="table-pagination__page-group">
              {showEllipsis ? (
                <span className="table-pagination__ellipsis">…</span>
              ) : null}
              <button
                type="button"
                className={`table-pagination__page${
                  pageNumber === page ? " active" : ""
                }`}
                disabled={disabled}
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </button>
            </span>
          );
        })}

        <button
          type="button"
          className="btn btn-ghost table-pagination__btn"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}
