/**
 * Catalog scalars that already exist on live.
 * problem/result are written by seed after 20260815_project_problem_result;
 * the page still renders them via CASE_COPY so a missed migrate does not blank /work.
 */
export const catalogProjectSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  demoUrl: true,
  techStack: true,
  screenshots: true,
  status: true,
} as const;
