import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function composeClassName(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const cn = composeClassName;
