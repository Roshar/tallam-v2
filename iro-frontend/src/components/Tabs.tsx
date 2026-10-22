export type CardType = "method" | "full";

interface TabsProps {
  value: CardType;
  onChange: (cardType: CardType) => void;
}

export function Tabs({ value, onChange }: TabsProps) {
  return (
    <div className="tabs">
      <button
        className={value === "method" ? "active" : ""}
        onClick={() => onChange("method")}
      >
        Методическая
      </button>
      <button
        className={value === "full" ? "active" : ""}
        onClick={() => onChange("full")}
      >
        Комплексная
      </button>
    </div>
  );
}
