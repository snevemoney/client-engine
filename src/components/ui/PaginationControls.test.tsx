import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PaginationControls } from "./PaginationControls";

describe("PaginationControls", () => {
  it("renders page and total labels", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <PaginationControls
        page={2}
        pageSize={25}
        total={183}
        totalPages={8}
        hasNext={true}
        hasPrev={true}
        onPageChange={onPageChange}
      />
    );
    expect(container.textContent).toContain("183 items");
    expect(container.textContent).toContain("Page 2 of 8");
  });

  it("prev button disabled when hasPrev false", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <PaginationControls
        page={1}
        pageSize={25}
        total={50}
        totalPages={2}
        hasNext={true}
        hasPrev={false}
        onPageChange={onPageChange}
      />
    );
    const prev = container.querySelector('button[aria-label="Previous page"]');
    expect(prev).toBeTruthy();
    expect(prev).toHaveAttribute("disabled");
  });

  it("next button disabled when hasNext false", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <PaginationControls
        page={2}
        pageSize={25}
        total={50}
        totalPages={2}
        hasNext={false}
        hasPrev={true}
        onPageChange={onPageChange}
      />
    );
    const next = container.querySelector('button[aria-label="Next page"]');
    expect(next).toBeTruthy();
    expect(next).toHaveAttribute("disabled");
  });

  it("onPageChange fires when next clicked", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <PaginationControls
        page={1}
        pageSize={25}
        total={50}
        totalPages={2}
        hasNext={true}
        hasPrev={false}
        onPageChange={onPageChange}
      />
    );
    const next = container.querySelector('button[aria-label="Next page"]:not([disabled])');
    expect(next).toBeTruthy();
    fireEvent.click(next!);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("onPageChange fires when prev clicked", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <PaginationControls
        page={2}
        pageSize={25}
        total={50}
        totalPages={2}
        hasNext={false}
        hasPrev={true}
        onPageChange={onPageChange}
      />
    );
    const prev = container.querySelector('button[aria-label="Previous page"]:not([disabled])');
    expect(prev).toBeTruthy();
    fireEvent.click(prev!);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("page size change fires when select changed", () => {
    const onPageSizeChange = vi.fn();
    render(
      <PaginationControls
        page={1}
        pageSize={25}
        total={100}
        totalPages={2}
        hasNext={true}
        hasPrev={false}
        onPageChange={() => {}}
        onPageSizeChange={onPageSizeChange}
      />
    );
    const select = screen.getByLabelText("Items per page");
    fireEvent.change(select, { target: { value: "50" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});
