import DOMPurify from "dompurify";

export const sanitizeHtml = (input: string): string => {
  if (typeof window === "undefined") {
    // Server-side: strip all HTML tags as a safe fallback
    return (input || "").replace(/<[^>]*>/g, "").trim();
  }
  return DOMPurify.sanitize(input);
};
