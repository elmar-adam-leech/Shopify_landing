import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Globe, Eye } from "lucide-react";

interface StorePageRowProps {
  page: any;
}

export function StorePageRow({ page }: StorePageRowProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md border p-3 flex-wrap"
      data-testid={`row-page-${page.id}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{page.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            /{page.slug}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge
          variant={page.status === "published" ? "default" : "secondary"}
        >
          {page.status}
        </Badge>
        {page.status === "published" && page.slug && (
          <a
            href={`/p/${page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              data-testid={`button-view-live-${page.id}`}
            >
              <Globe className="h-3 w-3" />
              View Live
            </Button>
          </a>
        )}
        <a
          href={`/preview/${page.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            data-testid={`button-preview-${page.id}`}
          >
            <Eye className="h-3 w-3" />
            Preview
          </Button>
        </a>
      </div>
    </div>
  );
}
