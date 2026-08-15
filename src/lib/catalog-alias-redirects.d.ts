export type CatalogAliasRedirect = {
  source: string;
  destination: string;
  permanent: true;
  basePath: false;
};

export const PUBLIC_SITE_ROOTS: readonly string[];

export function catalogAliasRedirects(
  basePath?: string | null
): CatalogAliasRedirect[];
