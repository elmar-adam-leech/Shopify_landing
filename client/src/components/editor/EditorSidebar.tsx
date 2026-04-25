import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlockLibrary } from "./BlockLibrary";
import { PagesSidebarTab } from "./PagesSidebarTab";
import { TemplateGrid } from "./TemplateLibrary";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Block } from "@shared/schema";

const STORAGE_KEY = "editor-sidebar-tab";

interface EditorSidebarProps {
  currentPageId: string | undefined;
  onApplyTemplate: (blocks: Block[]) => void;
}

type SidebarTab = "components" | "pages" | "templates";

function readInitialTab(): SidebarTab {
  if (typeof window === "undefined") return "components";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "components" || stored === "pages" || stored === "templates") {
    return stored;
  }
  return "components";
}

export function EditorSidebar({ currentPageId, onApplyTemplate }: EditorSidebarProps) {
  const [tab, setTab] = useState<SidebarTab>(() => readInitialTab());

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, tab);
    }
  }, [tab]);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as SidebarTab)}
      className="h-full flex flex-col"
    >
      <div className="px-3 pt-3 flex-shrink-0">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="components" data-testid="tab-sidebar-components">
            Components
          </TabsTrigger>
          <TabsTrigger value="pages" data-testid="tab-sidebar-pages">
            Pages
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-sidebar-templates">
            Templates
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="components" className="flex-1 overflow-hidden mt-2 data-[state=inactive]:hidden">
        <BlockLibrary />
      </TabsContent>
      <TabsContent value="pages" className="flex-1 overflow-hidden mt-2 data-[state=inactive]:hidden">
        <PagesSidebarTab currentPageId={currentPageId} />
      </TabsContent>
      <TabsContent value="templates" className="flex-1 overflow-hidden mt-2 data-[state=inactive]:hidden">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-lg">Templates</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Apply a starter layout to this page
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4">
              <TemplateGrid
                onSelectTemplate={onApplyTemplate}
                variant="inline"
              />
            </div>
          </ScrollArea>
        </div>
      </TabsContent>
    </Tabs>
  );
}
