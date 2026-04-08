import { Link } from "wouter";
import { FileText, Plus, FlaskConical, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StoreSelector } from "@/components/StoreSelector";
import { useEmbeddedNavigation } from "@/hooks/use-embedded-navigation";

interface PagesHeaderProps {
  isEmbedded: boolean;
  selectedStoreId: string | null;
  onNewPage: () => void;
}

export function PagesHeader({ isEmbedded, selectedStoreId, onNewPage }: PagesHeaderProps) {
  const { buildHref } = useEmbeddedNavigation();

  return (
    <header className="border-b">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Page Builder</h1>
            <p className="text-xs text-muted-foreground">Create landing pages for ads</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StoreSelector />
          {!isEmbedded && (
            <Link href={buildHref("/stores")}>
              <Button variant="ghost" size="icon" aria-label="Manage stores" data-testid="button-stores">
                <Store className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Link href={buildHref("/ab-tests")}>
            <Button variant="outline" className="gap-2" data-testid="button-ab-tests">
              <FlaskConical className="h-4 w-4" />
              A/B Tests
            </Button>
          </Link>
          <ThemeToggle />
          <Button
            className="gap-2"
            onClick={onNewPage}
            disabled={!selectedStoreId}
            data-testid="button-new-page"
          >
            <Plus className="h-4 w-4" />
            New Page
          </Button>
        </div>
      </div>
    </header>
  );
}
