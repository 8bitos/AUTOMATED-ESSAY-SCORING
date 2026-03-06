const FALLBACK_SITE_URL = "https://sage.sssevendayz.my.id";

export const getSiteUrl = (): string => {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    FALLBACK_SITE_URL;

  return raw.replace(/\/+$/, "");
};
