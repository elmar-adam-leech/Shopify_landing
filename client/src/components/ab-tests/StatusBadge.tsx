import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "running":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Running</Badge>;
    case "paused":
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Paused</Badge>;
    case "completed":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Completed</Badge>;
    default:
      return <Badge variant="secondary">Draft</Badge>;
  }
}
