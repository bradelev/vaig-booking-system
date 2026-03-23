"use client";

export default function ConfirmDeleteForm({
  action,
  message,
  children,
  className,
}: {
  action: (formData: FormData) => void;
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
