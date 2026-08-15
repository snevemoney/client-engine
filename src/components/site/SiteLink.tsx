/* eslint-disable @next/next/no-html-link-for-pages */
import type { AnchorHTMLAttributes } from "react";
import { siteHref } from "@/lib/base-path";

type SiteLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

/**
 * Marketing CTA: real <a href>. next/link preventDefault + soft nav
 * focused without navigating in click-live (2026-08-15).
 */
export function SiteLink({ href, ...props }: SiteLinkProps) {
  return <a {...props} href={siteHref(href)} />;
}
