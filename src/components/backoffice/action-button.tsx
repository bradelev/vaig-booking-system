"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
  action: () => Promise<void>;
  label: string;
  pendingLabel?: string;
  successMessage: string;
  className?: string;
}

export default function ActionButton({
  action,
  label,
  pendingLabel,
  successMessage,
  className,
}: ActionButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ocurrió un error");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50",
        className
      )}
    >
      {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
      {isPending ? (pendingLabel ?? label) : label}
    </button>
  );
}
