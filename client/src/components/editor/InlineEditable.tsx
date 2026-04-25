import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import DOMPurify from "dompurify";
import { Bold, Italic, Link as LinkIcon } from "lucide-react";

const ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "a", "br", "span"];
const ALLOWED_ATTR = ["href", "target", "rel"];

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
  }) as string;
}

/**
 * Allowlist link protocols to prevent javascript:/data:/vbscript: URLs.
 * Returns the safe URL or null if rejected. Allows http/https/mailto/tel and
 * relative paths starting with / or #.
 */
export function safeLinkUrl(raw: string | undefined | null): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!url) return null;
  if (url.length > 2048) return null;
  if (url.startsWith("/") || url.startsWith("#")) return url;
  const lower = url.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  ) {
    return url;
  }
  return null;
}

interface InlineEditableProps {
  /** Current value as plain text or simple HTML. */
  value: string;
  /** Called with sanitized HTML on commit (blur or Enter outside contenteditable). */
  onCommit: (next: string) => void;
  /** Render multiline (preserves <br>) or single-line. */
  multiline?: boolean;
  /** Whether to allow rich formatting (bold/italic/link). When false, only plain text. */
  rich?: boolean;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  testId?: string;
  /** When false, the element is not editable. */
  enabled?: boolean;
  /** Tag to render (e.g. "h1", "p", "span"). Defaults to "div". */
  as?: "div" | "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

/**
 * Inline contenteditable editor with DOMPurify sanitization on commit.
 * - Double-click to start editing (only when the parent block is selected).
 * - Blur (or Enter when not multiline) commits the change.
 * - Esc cancels and reverts to the original value.
 * - When `rich`, a small floating toolbar offers Bold/Italic/Link.
 */
export function InlineEditable({
  value,
  onCommit,
  multiline = true,
  rich = false,
  className = "",
  style,
  placeholder,
  testId,
  enabled = true,
  as: Tag = "div",
}: InlineEditableProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const originalRef = useRef<string>(value);

  // Keep DOM in sync with value prop when not actively editing.
  useEffect(() => {
    if (!editing && ref.current) {
      if (rich) {
        const safe = sanitize(value || "");
        if (ref.current.innerHTML !== safe) {
          ref.current.innerHTML = safe;
        }
      } else {
        const text = value || "";
        if (ref.current.textContent !== text) {
          ref.current.textContent = text;
        }
      }
    }
  }, [value, editing, rich]);

  const startEdit = () => {
    if (!enabled) return;
    originalRef.current = rich
      ? (ref.current?.innerHTML ?? value)
      : (ref.current?.textContent ?? value);
    setEditing(true);
    requestAnimationFrame(() => {
      ref.current?.focus();
      // Place caret at end
      const range = document.createRange();
      const sel = window.getSelection();
      if (ref.current && sel) {
        range.selectNodeContents(ref.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  };

  const commit = () => {
    if (!ref.current) return;
    let cleaned: string;
    if (rich) {
      cleaned = sanitize(ref.current.innerHTML);
    } else {
      cleaned = ref.current.innerText ?? "";
    }
    if (cleaned !== value) {
      onCommit(cleaned);
    }
    setEditing(false);
  };

  const cancel = () => {
    if (ref.current) {
      if (rich) {
        ref.current.innerHTML = sanitize(originalRef.current);
      } else {
        ref.current.textContent = originalRef.current;
      }
    }
    setEditing(false);
  };

  const exec = (cmd: "bold" | "italic" | "createLink", arg?: string) => {
    document.execCommand(cmd, false, arg);
    ref.current?.focus();
  };

  const handleDoubleClick = (e: MouseEvent<HTMLElement>) => {
    if (!enabled || editing) return;
    e.stopPropagation();
    startEdit();
  };

  const handleBlur = (_e: FocusEvent<HTMLElement>) => {
    if (editing) commit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      (e.currentTarget as HTMLElement).blur();
    } else if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      commit();
      (e.currentTarget as HTMLElement).blur();
    }
  };

  // We render the tag via createElement so we can attach a ref of the
  // generic HTMLElement type without fighting React's per-tag ref typings.
  const tagElement = createElement(Tag, {
    ref: (el: HTMLElement | null) => {
      ref.current = el;
    },
    contentEditable: editing,
    suppressContentEditableWarning: true,
    onDoubleClick: handleDoubleClick,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    className: `${className} ${enabled && !editing ? "cursor-text" : ""} focus:outline-none`,
    style,
    "data-placeholder": placeholder,
    "data-testid": testId,
  });

  return (
    <span
      className={`relative inline-block w-full ${editing ? "outline-2 outline-dashed outline-primary outline-offset-2 rounded" : ""}`}
    >
      {tagElement}
      {editing && rich && (
        <div
          className="absolute -top-9 left-0 z-30 flex items-center gap-1 bg-popover border rounded-md shadow-md px-1 py-0.5"
          onMouseDown={(e) => {
            // prevent blur when clicking toolbar
            e.preventDefault();
          }}
          data-testid={`${testId}-toolbar`}
        >
          <button
            type="button"
            className="h-6 w-6 flex items-center justify-center rounded hover-elevate"
            onClick={() => exec("bold")}
            title="Bold"
            data-testid={`${testId}-bold`}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="h-6 w-6 flex items-center justify-center rounded hover-elevate"
            onClick={() => exec("italic")}
            title="Italic"
            data-testid={`${testId}-italic`}
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="h-6 w-6 flex items-center justify-center rounded hover-elevate"
            onClick={() => {
              const url = window.prompt("Link URL");
              if (!url) return;
              const safe = safeLinkUrl(url);
              if (!safe) {
                window.alert("Link must use http://, https://, mailto:, tel:, or start with / or #");
                return;
              }
              exec("createLink", safe);
            }}
            title="Link"
            data-testid={`${testId}-link`}
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </span>
  );
}
