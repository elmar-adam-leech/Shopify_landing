import { memo, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { v4 as uuidv4 } from "uuid";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { AccordionConfig, AccordionItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { InlineEditable } from "../InlineEditable";

interface AccordionPreviewProps {
  config: Record<string, any>;
  editable?: boolean;
  onUpdateConfig?: (config: Record<string, any>) => void;
}

function sanitizeBody(html: string): string {
  return DOMPurify.sanitize(html.replace(/\n/g, "<br />"), {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "a", "br", "span", "p", "ul", "ol", "li"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    KEEP_CONTENT: true,
  }) as string;
}

export const AccordionPreview = memo(function AccordionPreview({
  config,
  editable = false,
  onUpdateConfig,
}: AccordionPreviewProps) {
  const settings = config as AccordionConfig;
  const items: AccordionItem[] = settings.items?.length
    ? settings.items
    : [];
  const allowMultiple = settings.allowMultipleOpen ?? false;
  const defaultOpenIndex =
    typeof settings.defaultOpenIndex === "number" ? settings.defaultOpenIndex : -1;

  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (defaultOpenIndex >= 0 && items[defaultOpenIndex]) {
      s.add(items[defaultOpenIndex].id);
    }
    return s;
  });

  const canEdit = editable && !!onUpdateConfig;

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!allowMultiple) next.clear();
        next.add(id);
      }
      return next;
    });
  };

  const updateItem = (id: string, patch: Partial<AccordionItem>) => {
    if (!onUpdateConfig) return;
    const nextItems = items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    onUpdateConfig({ ...config, items: nextItems });
  };

  const addItem = () => {
    if (!onUpdateConfig) return;
    const nextItems = [
      ...items,
      { id: uuidv4(), title: "New question", body: "Answer goes here." },
    ];
    onUpdateConfig({ ...config, items: nextItems });
  };

  const removeItem = (id: string) => {
    if (!onUpdateConfig) return;
    const nextItems = items.filter((it) => it.id !== id);
    onUpdateConfig({ ...config, items: nextItems });
  };

  return (
    <div
      className="p-6 bg-background"
      data-testid="accordion-block-preview"
      data-block-kind="accordion"
    >
      <div className="max-w-3xl mx-auto space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground italic" data-testid="accordion-empty">
            No items yet. Add one below.
          </p>
        )}
        {items.map((item) => {
          const open = openIds.has(item.id);
          const safeBody = sanitizeBody(item.body || "");
          return (
            <div
              key={item.id}
              className="border rounded-md overflow-hidden bg-card"
              data-testid={`accordion-item-${item.id}`}
            >
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(item.id);
                  }}
                  aria-expanded={open}
                  className="flex-shrink-0 text-muted-foreground"
                  data-testid={`accordion-toggle-${item.id}`}
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  {canEdit ? (
                    <InlineEditable
                      value={item.title}
                      multiline={false}
                      onCommit={(next) => updateItem(item.id, { title: next })}
                      className="font-medium text-foreground"
                      placeholder="Question or heading"
                      testId={`inline-accordion-title-${item.id}`}
                    />
                  ) : (
                    <div className="font-medium text-foreground">{item.title || "Untitled"}</div>
                  )}
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                    data-testid={`button-remove-accordion-item-${item.id}`}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {open && (
                <div
                  className="px-4 pb-4 pt-1 border-t"
                  data-testid={`accordion-body-${item.id}`}
                >
                  {canEdit ? (
                    <InlineEditable
                      value={item.body}
                      multiline
                      rich
                      onCommit={(next) => updateItem(item.id, { body: next })}
                      className="text-sm text-foreground prose dark:prose-invert max-w-none"
                      placeholder="Write the answer..."
                      testId={`inline-accordion-body-${item.id}`}
                    />
                  ) : (
                    <div
                      className="text-sm text-foreground prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: safeBody }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              addItem();
            }}
            className="gap-1.5 mt-2"
            data-testid="button-add-accordion-item"
          >
            <Plus className="h-3.5 w-3.5" /> Add item
          </Button>
        )}
      </div>
    </div>
  );
});
