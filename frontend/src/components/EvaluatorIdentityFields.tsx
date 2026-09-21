interface EvaluatorIdentityFieldsProps {
  fio: string;
  position: string;
  workplace: string;
  hint?: string;
  onFioChange: (value: string) => void;
  onPositionChange: (value: string) => void;
  onWorkplaceChange: (value: string) => void;
}

export function EvaluatorIdentityFields({
  fio,
  position,
  workplace,
  hint,
  onFioChange,
  onPositionChange,
  onWorkplaceChange,
}: EvaluatorIdentityFieldsProps) {
  return (
    <div className="evaluate-meta__external">
      {hint ? <p className="evaluate-extras__hint">{hint}</p> : null}
      <div className="form-group">
        <label className="form-label" htmlFor="source-fio">
          ФИО оценивающего
        </label>
        <input
          id="source-fio"
          className="form-input"
          value={fio}
          onChange={(e) => onFioChange(e.target.value)}
          placeholder="ФИО оценивающего"
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="source-position">
          Должность
        </label>
        <input
          id="source-position"
          className="form-input"
          value={position}
          onChange={(e) => onPositionChange(e.target.value)}
          placeholder="Должность"
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="source-workplace">
          Место работы
        </label>
        <input
          id="source-workplace"
          className="form-input"
          value={workplace}
          onChange={(e) => onWorkplaceChange(e.target.value)}
          placeholder="Место работы"
          required
        />
      </div>
    </div>
  );
}
