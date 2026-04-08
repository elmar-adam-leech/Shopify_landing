import { Link } from "wouter";
import { MoreHorizontal, Trash2, Copy, ExternalLink, BarChart3, Globe, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEmbeddedNavigation } from "@/hooks/use-embedded-navigation";
import { formatDistanceToNow } from "date-fns";
import type { PageListItem } from "./usePages";

interface PageCardProps {
  page: PageListItem;
  selectedStoreDomain?: string;
  onDuplicate: (id: string) => void;
  onPublishToggle: (pageId: string, newStatus: "draft" | "published") => void;
  onDelete: (id: string) => void;
  isDuplicating: boolean;
  isPublishing: boolean;
}

export function PageCard({
  page,
  selectedStoreDomain,
  onDuplicate,
  onPublishToggle,
  onDelete,
  isDuplicating,
  isPublishing,
}: PageCardProps) {
  const { buildHref } = useEmbeddedNavigation();

  return (
    <Card className="group hover-elevate" data-testid={`card-page-${page.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate">{page.title}</CardTitle>
            <CardDescription className="text-xs mt-1">
              /{page.slug}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Page options for ${page.title}`}
                data-testid={`button-menu-${page.id}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onDuplicate(page.id)}
                disabled={isDuplicating}
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={
                    page.status === "published" && page.slug
                      ? `/p/${page.slug}`
                      : `/preview/${page.id}${selectedStoreDomain ? `?shop=${selectedStoreDomain}` : ''}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {page.status === "published" ? "View Live" : "Preview"}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={buildHref(`/analytics/${page.id}`)}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onPublishToggle(
                  page.id,
                  page.status === "published" ? "draft" : "published"
                )}
                disabled={isPublishing}
              >
                {page.status === "published" ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Unpublish
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4 mr-2" />
                    Publish
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(page.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <Link href={buildHref(`/editor/${page.id}`)}>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-3 cursor-pointer hover:bg-muted/80 transition-colors">
            {page.blockCount > 0 ? (
              <div className="text-center p-4">
                <p className="text-2xl font-bold text-muted-foreground">
                  {page.blockCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  block{page.blockCount !== 1 ? "s" : ""}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Empty page</p>
            )}
          </div>
        </Link>
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant={page.status === "published" ? "default" : "secondary"}
          >
            {page.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
