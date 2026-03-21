"use client";

import { type FormHTMLAttributes } from "react";

type ValidatedFormProps = FormHTMLAttributes<HTMLFormElement> & {
  children: React.ReactNode;
};

const MESSAGES: Record<string, string> = {
  valueMissing: "Este campo es obligatorio",
  typeMismatch: "El formato no es válido",
  tooShort: "El valor es demasiado corto",
  tooLong: "El valor es demasiado largo",
  rangeUnderflow: "El valor es menor al mínimo permitido",
  rangeOverflow: "El valor supera el máximo permitido",
  patternMismatch: "El formato no coincide con el requerido",
  stepMismatch: "El valor no corresponde al incremento requerido",
};

function getEmailMessage(input: HTMLInputElement): string | null {
  if (input.type === "email" && input.validity.typeMismatch) {
    return "Ingresá un email válido";
  }
  return null;
}

function setSpanishMessages(form: HTMLFormElement) {
  const inputs = form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    "input, select, textarea"
  );
  inputs.forEach((input) => {
    input.setCustomValidity("");
    const validity = input.validity;
    if (validity.valid) return;

    const emailMsg = input instanceof HTMLInputElement ? getEmailMessage(input) : null;
    if (emailMsg) {
      input.setCustomValidity(emailMsg);
      return;
    }

    for (const [key, message] of Object.entries(MESSAGES)) {
      if (validity[key as keyof ValidityState]) {
        input.setCustomValidity(message);
        return;
      }
    }
  });
}

export default function ValidatedForm({ children, onSubmit, ...props }: ValidatedFormProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    // Clear previous custom messages first
    const inputs = form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea"
    );
    inputs.forEach((input) => input.setCustomValidity(""));

    if (!form.checkValidity()) {
      e.preventDefault();
      setSpanishMessages(form);
      form.reportValidity();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubmit?.(e as any);
  }

  return (
    <form {...props} onSubmit={handleSubmit} noValidate>
      {children}
    </form>
  );
}
