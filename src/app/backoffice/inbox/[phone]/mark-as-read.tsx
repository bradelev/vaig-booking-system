"use client";

import { useEffect } from "react";
import { markAsRead } from "./actions";

export default function MarkAsRead({ phone }: { phone: string }) {
  useEffect(() => {
    markAsRead(phone);
  }, [phone]);

  return null;
}
