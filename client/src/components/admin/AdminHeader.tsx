import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard } from "lucide-react";

interface AdminHeaderProps {
  onSignOut: () => void;
  isSigningOut: boolean;
}

export function AdminHeader({ onSignOut, isSigningOut }: AdminHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Admin Dashboard</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={onSignOut}
          disabled={isSigningOut}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </header>
  );
}
