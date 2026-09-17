import { useEffect, useRef } from "react";

interface MinimalEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  labelledBy?: string;
}

function exec(command: string) {
  document.execCommand(command, false);
}

function isEditorEmpty(html: string): boolean {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim() === "";
}

export function MinimalEditor({
  value,
  onChange,
  placeholder = "",
  labelledBy,
}: MinimalEditorProps) {
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = areaRef.current;
    if (!node) return;
    if (document.activeElement === node) return;
    if (node.innerHTML !== value) {
      node.innerHTML = value;
    }
    node.dataset.empty = isEditorEmpty(node.innerHTML) ? "true" : "false";
  }, [value]);

  function emit() {
    const html = areaRef.current?.innerHTML ?? "";
    if (areaRef.current) {
      areaRef.current.dataset.empty = isEditorEmpty(html) ? "true" : "false";
    }
    onChange(html);
  }

  function handleCommand(command: string) {
    areaRef.current?.focus();
    exec(command);
    emit();
  }

  return (
    <div className="minimal-editor">
      <div className="minimal-editor__toolbar" role="toolbar" aria-label="Форматирование">
        <button
          type="button"
          className="minimal-editor__tool"
          title="Жирный"
          aria-label="Жирный"
          onMouseDown={(event) => {
            event.preventDefault();
            handleCommand("bold");
          }}
        >
          <strong>Ж</strong>
        </button>
        <button
          type="button"
          className="minimal-editor__tool"
          title="Курсив"
          aria-label="Курсив"
          onMouseDown={(event) => {
            event.preventDefault();
            handleCommand("italic");
          }}
        >
          <em>К</em>
        </button>
        <button
          type="button"
          className="minimal-editor__tool"
          title="Маркированный список"
          aria-label="Маркированный список"
          onMouseDown={(event) => {
            event.preventDefault();
            handleCommand("insertUnorderedList");
          }}
        >
          Список
        </button>
      </div>
      <div
        ref={areaRef}
        className="minimal-editor__area"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        data-placeholder={placeholder}
        data-empty="true"
        onInput={emit}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          emit();
        }}
      />
    </div>
  );
}
