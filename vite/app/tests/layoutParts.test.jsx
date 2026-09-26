// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — shared layout parts
//
//  The small presentational pieces around the pages:
//    - Navbar          — logo/title links to "/", and the
//                        "Atsijungti" button that logs out by
//                        a FULL navigation to /login (the login
//                        page drops the session on mount)
//    - Footer          — the copyright strip
//    - Widget          — the dashboard stat card (text, count,
//                        icon optionally linking, children,
//                        the up/down difference badge)
//    - StudentProgress — the dashboard's live progress bars
//                        (answered / total, finished = full
//                        green bar "(TESTAS BAIGTAS)"), one
//                        row per student that stays theirs
//                        as others come and go
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { renderPage } from "./support/render";
import { hardNavigations } from "./support/navigation";
import * as fx from "./support/fixtures";

import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Other/Footer/Footer";
import Widget from "@/components/Admin/Widget/Widget";
import StudentProgress from "@/components/Admin/Widget/StudentProgress";







// -----------------------------------------------------------
// Navbar
// -----------------------------------------------------------

describe("Navbar", () => {

  it("links the logo and the app title to the home route", () => {
    renderPage(<Navbar />);

    const logoLink = screen.getByAltText("VU logotipas").closest("a");
    const titleLink = screen.getByText("Fišingo atakų atpažinimo testas").closest("a");

    expect(logoLink).toHaveAttribute("href", "/");
    expect(titleLink).toHaveAttribute("href", "/");
  });


  it("logs out with a full page load of /login", async () => {
    const { user } = renderPage(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Atsijungti" }));

    expect(hardNavigations()).toEqual(["/login"]);
  });


  it("does not navigate before the button is pressed", () => {
    renderPage(<Navbar />);

    expect(hardNavigations()).toEqual([]);
  });
});







// -----------------------------------------------------------
// Footer
// -----------------------------------------------------------

describe("Footer", () => {

  it("shows the copyright line", () => {
    renderPage(<Footer />);

    expect(screen.getByText("Copyright © | All Rights Reserved | VUKnF")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// Widget
// -----------------------------------------------------------

describe("Widget", () => {

  it("shows the label, the count and the bottom text", () => {
    renderPage(<Widget text="Studentų" count={42} bottomtext="Visi laikai" />);

    expect(screen.getByText("Studentų")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Visi laikai")).toBeInTheDocument();
  });


  it("wraps the icon in a router link when `link` is given", () => {
    renderPage(<Widget text="Studentų" count={1} icon={<span data-testid="icon" />} link="/admin/students" />);

    expect(screen.getByTestId("icon").closest("a")).toHaveAttribute("href", "/admin/students");
  });


  it("leaves the icon unlinked without `link`", () => {
    renderPage(<Widget text="Studentų" count={1} icon={<span data-testid="icon" />} />);

    expect(screen.getByTestId("icon").closest("a")).toBeNull();
  });


  it("renders its children (the dashboard's test-size picker slot)", () => {
    renderPage(<Widget text="Klausimai" count="18/20"><span>vidus</span></Widget>);

    expect(screen.getByText("18/20")).toBeInTheDocument();
    expect(screen.getByText("vidus")).toBeInTheDocument();
  });


  it("shows a green up badge for a positive difference", () => {
    const { container } = renderPage(<Widget text="Studentų" count={1} difference={3} />);

    const badge = container.querySelector(".bg-green-600");
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("3");
    expect(container.querySelector(".bg-red-600")).toBeNull();
  });


  it("shows a red down badge for a negative difference", () => {
    const { container } = renderPage(<Widget text="Studentų" count={1} difference={-2} />);

    const badge = container.querySelector(".bg-red-600");
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("-2");
    expect(container.querySelector(".bg-green-600")).toBeNull();
  });


  it("shows no badge without a difference (the dashboard passes none)", () => {
    const { container } = renderPage(<Widget text="Studentų" count={1} />);

    expect(container.querySelector(".bg-green-600")).toBeNull();
    expect(container.querySelector(".bg-red-600")).toBeNull();
  });
});







// -----------------------------------------------------------
// StudentProgress
// -----------------------------------------------------------

describe("StudentProgress", () => {

  it("renders nothing before the dashboard data arrived", () => {
    const { container } = renderPage(<StudentProgress text="Testą Sprendžia:" studentsprogress={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });


  it("says nobody is taking the test for an empty list", () => {
    renderPage(<StudentProgress text="Testą Sprendžia:" studentsprogress={[]} />);

    expect(screen.getByText("Testą Sprendžia:")).toBeInTheDocument();
    expect(screen.getByText("Šiuo metu testo nesprendžia nei vienas studentas")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });


  it("shows answered / total and the rounded percentage for a running test", () => {
    renderPage(
      <StudentProgress
        text="Testą Sprendžia:"
        studentsprogress={[fx.progressEntry({ username: "VARDENĖ_PAVARDENĖ", answeredquestioncount: 2, questioncount: 3 })]}
      />
    );

    expect(screen.getByText("VARDENĖ_PAVARDENĖ:")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    // 2 / 3 = 66.67 % → rounded to 67
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "67");
    expect(bar).toHaveClass("MuiLinearProgress-colorPrimary");
  });


  it("shows a full green bar with '(TESTAS BAIGTAS)' for a finished test", () => {
    renderPage(
      <StudentProgress
        text="Testą Sprendžia:"
        studentsprogress={[fx.progressEntry({ isfinished: 1, answeredquestioncount: 5, questioncount: 12 })]}
      />
    );

    expect(screen.getByText("(TESTAS BAIGTAS)")).toBeInTheDocument();
    expect(screen.queryByText("5 / 12")).toBeNull();

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveClass("MuiLinearProgress-colorSuccess");
  });


  it("lists every active student in the order the API sends", () => {
    renderPage(
      <StudentProgress
        text="Testą Sprendžia:"
        studentsprogress={[
          fx.progressEntry({ studentid: 1, username: "PIRMAS", answeredquestioncount: 0, questioncount: 12 }),
          fx.progressEntry({ studentid: 2, username: "ANTRAS", answeredquestioncount: 12, questioncount: 12 }),
          fx.progressEntry({ studentid: 3, username: "TRECIAS", isfinished: 1 }),
        ]}
      />
    );

    const bars = screen.getAllByRole("progressbar");
    expect(bars.map((bar) => bar.getAttribute("aria-valuenow"))).toEqual(["0", "100", "100"]);

    const names = screen.getAllByText(/^(PIRMAS|ANTRAS|TRECIAS):$/).map((element) => element.textContent);
    expect(names).toEqual(["PIRMAS:", "ANTRAS:", "TRECIAS:"]);

    // A running test at 12 / 12 still reads as a count, not as finished
    expect(within(bars[1].parentElement).getByText("12 / 12")).toBeInTheDocument();
  });


  // The dashboard polls every 2 s and the list changes as
  // students come and go. A row belongs to its student — rows
  // tied to a position would hand a leaving student's row (and
  // its bar, mid-animation) to the next one. Plain render(): its
  // rerender() keeps the tree, renderPage's router would not
  it("keeps every student's own row while others leave the list", () => {
    const { rerender } = render(
      <StudentProgress
        text="Testą Sprendžia:"
        studentsprogress={[
          fx.progressEntry({ studentid: 1, username: "PIRMAS", answeredquestioncount: 3, questioncount: 12 }),
          fx.progressEntry({ studentid: 2, username: "ANTRAS", answeredquestioncount: 9, questioncount: 12 }),
        ]}
      />
    );
    const secondRow = screen.getByText("ANTRAS:").parentElement;
    const secondBar = within(secondRow).getByRole("progressbar");

    rerender(
      <StudentProgress
        text="Testą Sprendžia:"
        studentsprogress={[
          fx.progressEntry({ studentid: 2, username: "ANTRAS", answeredquestioncount: 10, questioncount: 12 }),
        ]}
      />
    );

    expect(screen.queryByText("PIRMAS:")).toBeNull();
    expect(screen.getByText("ANTRAS:").parentElement).toBe(secondRow);
    expect(within(secondRow).getByRole("progressbar")).toBe(secondBar);
    expect(within(secondRow).getByText("10 / 12")).toBeInTheDocument();
  });
});
