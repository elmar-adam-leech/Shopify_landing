import { Button } from "@/components/ui/button";

interface PagesPaginationProps {
  pageOffset: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export function PagesPagination({
  pageOffset,
  pageSize,
  totalPages,
  hasNextPage,
  hasPrevPage,
  onNext,
  onPrev,
}: PagesPaginationProps) {
  if (!hasNextPage && !hasPrevPage) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-muted-foreground">
        Showing {pageOffset + 1}–{Math.min(pageOffset + pageSize, totalPages)} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrevPage}
          onClick={onPrev}
          data-testid="button-prev-page"
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNextPage}
          onClick={onNext}
          data-testid="button-next-page"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
