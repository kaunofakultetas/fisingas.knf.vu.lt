// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — InteractiveImageEditor, the admin's
//      link-area editor
//
//  src/components/Other/InteractiveImage/InteractiveImageEditor.jsx
//  — the question bank's fullscreen "Redaguoti Nuorodas"
//  editor and the /admin/questions/:questionID page:
//    - GET <initialAreasUrl> through axios, withCredentials;
//      "Kraunasi..." until it answers — a failure (or a 200
//      that is not a list) toasts "Nepavyko užkrauti nuorodų"
//      and never turns into an editor that could save
//    - percent strings → numbers ("15%" → 15, null → 0)
//    - the side panel: "Nuorodos (N)", one card per area (the
//      number, the "Nuoroda" URL field, delete, the X / Y /
//      Plotis / Aukštis chips in whole percent) or the empty
//      state; the selection is shared by cards and boxes
//    - "Pridėti": {url "", 10 / 10 / 20 / 20 %} named
//      Date.now(), selected at once
//    - "Išsaugoti": POST <initialAreasUrl>, withCredentials,
//      {areas: [{id, url, x, y, width, height}]} — every
//      coordinate rounded to whole percent and sent as a 0–1
//      FRACTION; "OK" → "Nuorodos išsaugotos" and
//      onSaveButtonClick; 400 / 404 / 500 / no connection →
//      "Nepavyko išsaugoti nuorodų"; a 401 is never reported
//      as saved
//    - the boxes on the image (react-rnd, replaced by a double
//      — see the mock): drawn once the image is measured; px =
//      percent × the image size (+ the image's offset in the
//      canvas for the position); a finished drag / resize is
//      converted back to whole percent
//    - window resizes and canvas resizes (ResizeObserver)
//      re-measure
//
//  jsdom has no layout: the tests stub getBoundingClientRect
//  of the <img> and of its canvas before the load / resize that
//  measures them.
//
//  The editor's known defects are pinned in knownBugs.test.jsx;
//  the tests here hold with and without their fixes:
//    - KB-05 (a 200 "Error: Not Admin" save reply reported as
//      saved) — every save here is answered "OK" or a failure
//    - KB-30 (boxes bounded by the canvas, not the image) — no
//      test pins `bounds`; every drag / resize stays on the
//      image
//    - KB-31 (a new initialAreasUrl keeps the old areas) — no
//      test changes it
//    - KB-32 (a failed load stays on "Kraunasi..." for good) —
//      the failure tests ask only for the toast and that
//      nothing can be saved
//    - KB-36 (a 401 is toasted like any failure instead of
//      sending the admin to /login) — the 401 tests ask only
//      that nothing is saved or reported as saved
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { resizeObserved } from "./support/setup";
import { findToast, renderPage, settle, toastTexts } from "./support/render";
import * as fx from "./support/fixtures";

import InteractiveImageEditor from "@/components/Other/InteractiveImage/InteractiveImageEditor";


// react-rnd drags and resizes with pointer geometry jsdom does
// not have. The double renders each box as a plain div showing
// what the editor handed it — size / position in px and the
// bounds as data-*, the style as its style, the click handler —
// and keeps its latest props on the element (`rndProps`), so a
// test can finish a drag or a resize with chosen values
vi.mock("react-rnd", async () => {
  const { createElement } = await import("react");

  return {
    Rnd: function RndDouble(props) {
      return createElement("div", {
        "data-testid": "rnd-box",
        "data-x": props.position?.x,
        "data-y": props.position?.y,
        "data-width": props.size?.width,
        "data-height": props.size?.height,
        "data-bounds": typeof props.bounds === "string" ? props.bounds : undefined,
        style: props.style,
        onClick: props.onClick,
        ref: (element) => {
          if (element) {
            element.rndProps = props;
          }
        },
      });
    },
  };
});


const SRC = "/api/phishingpictures/21";
const LINKS = "/api/phishingpictures/21/links";

const FIRST = fx.questionLink({ id: 1, url: "https://pirmas.example" });
const SECOND = fx.questionLink({ id: 2, url: "https://antras.example", x: "50%", y: "10%", width: "25%", height: "8%" });

const EMPTY_STATE = "Nuorodų dar nėra — paspauskite „Pridėti“.";

const SELECTED_CARD = "border-[rgb(230,65,100)]";


// The measured layout: the image is centered in the canvas —
// 50 px right and 10 px down from its corner, 500 × 300 px
const CANVAS_BOX = { left: 100, top: 50, width: 600, height: 400 };
const IMAGE_BOX = { left: 150, top: 60, width: 500, height: 300 };

// After the window grew: 800 × 400, 20 px right and 20 px down
const GROWN_CANVAS_BOX = { left: 100, top: 50, width: 840, height: 440 };
const GROWN_IMAGE_BOX = { left: 120, top: 70, width: 800, height: 400 };

// "Pridėti" names a new area Date.now() — the clock is pinned
// where an id is asserted or two areas are added
const NOW = new Date("2026-09-01T10:00:00+03:00").getTime();


const domRect = ({ left, top, width, height }) => ({
  left, top, width, height, x: left, y: top, right: left + width, bottom: top + height,
});

// What a browser would measure — in place before the load /
// resize that reads it
const placeImage = (image, imageBox = IMAGE_BOX, canvasBox = CANVAS_BOX) => {
  image.getBoundingClientRect = () => domRect(imageBox);
  image.parentNode.getBoundingClientRect = () => domRect(canvasBox);
};

const theImage = () => screen.getByAltText("Redaguojamas fišingo laiškas");

const resizeWindow = () => fireEvent(window, new Event("resize"));

// "125" → 125, rounded to 1/1000 px: percent × size can leave
// float noise (74.99999999999999)
const px = (value) => Math.round(parseFloat(value) * 1000) / 1000;

// A CSS value spelled the way the DOM's style engine stores it
// (jsdom normalizes colors and shorthands) — throws instead of
// comparing two empty strings when the engine rejects it
const cssValue = (property, value) => {
  const probe = document.createElement("div");
  probe.style[property] = value;
  if (probe.style[property] === "") {
    throw new Error(`The style engine rejected ${property}: ${value}`);
  }
  return probe.style[property];
};


const renderEditor = (props = {}) => {
  const onSaved = vi.fn();
  const result = renderPage(
    <InteractiveImageEditor src={SRC} initialAreasUrl={LINKS} onSaveButtonClick={onSaved} {...props} />,
    { toaster: true }
  );
  return { ...result, onSaved };
};

// The editor with `areas` loaded — the side panel is up
const renderLoaded = async (areas = [fx.questionLink()], props = {}) => {
  backend.on("GET", LINKS, reply.json(areas));
  const result = renderEditor(props);
  await screen.findByRole("heading", { name: "Nuorodos" });
  return result;
};

// ... and its image measured on load — the boxes are up
const renderMeasured = async (areas = [fx.questionLink()], props = {}) => {
  const result = await renderLoaded(areas, props);
  const image = theImage();
  placeImage(image);
  fireEvent.load(image);
  return { ...result, image };
};


const addButton = () => screen.getByRole("button", { name: "Pridėti" });

const saveButton = () => screen.getByRole("button", { name: "Išsaugoti" });

// "Išsaugoti", answered "OK" — resolves with the posted body
const saveOk = async (user) => {
  backend.on("POST", LINKS, reply.text("OK"));
  await user.click(saveButton());
  await findToast("Nuorodos išsaugotos");
  return backend.lastRequest("POST", LINKS).json;
};


// The side panel's cards in list order — each holds one
// "Nuoroda" field; the card is its clickable ancestor
const cards = () => screen.queryAllByLabelText("Nuoroda").map((field) => field.closest(".cursor-pointer"));

const urlField = (card) => within(card).getByLabelText("Nuoroda");

const deleteButton = (card) => within(card).getByRole("button", { name: "delete" });

// The grey coordinate chips of a card, in order
const chipsOf = (card) => [...card.querySelectorAll(".bg-gray-100")].map((chip) => chip.textContent);

const lookOfCard = (card) => {
  if (card.classList.contains(SELECTED_CARD)) return "selected";
  if (card.classList.contains("border-gray-200")) return "idle";
  return `neither: ${card.className}`;
};


// The react-rnd doubles, in area order
const boxes = () => screen.queryAllByTestId("rnd-box");

// What the editor handed react-rnd, in canvas px
const geometry = (box) => ({
  x: px(box.dataset.x),
  y: px(box.dataset.y),
  width: px(box.dataset.width),
  height: px(box.dataset.height),
});

// The selected box is a solid pink frame on top, the others
// dashed blue
const lookOfBox = (box) => {
  const border = box.style.border;
  if (border === cssValue("border", "2px solid rgb(230, 65, 100)") && box.style.zIndex === "20") return "selected";
  if (border === cssValue("border", "1.5px dashed rgb(59, 130, 246)") && box.style.zIndex === "10") return "idle";
  return `neither: ${box.getAttribute("style")}`;
};

// A drag ends the way react-rnd reports it: the box's new
// top-left corner in canvas px (the `position` coordinates)
const dragBox = (box, x, y) => {
  act(() => {
    box.rndProps.onDragStop(new MouseEvent("mouseup"), { node: box, x, y, deltaX: 0, deltaY: 0, lastX: x, lastY: y });
  });
};

// A resize to width × height px ends the way react-rnd reports
// it: the element (offsetWidth / offsetHeight = the new size),
// the size change, and the top-left corner — which react-rnd
// moves by that change for the handles on a top / left edge,
// so the opposite corner stays put (Rnd.onResize)
const resizeBox = (box, direction, { width, height }) => {
  const { position, size, onResizeStop } = box.rndProps;
  const delta = { width: width - size.width, height: height - size.height };
  const movesX = ["top", "left", "topLeft", "bottomLeft"].includes(direction);
  const movesY = ["top", "left", "topLeft", "topRight"].includes(direction);
  const corner = {
    x: movesX ? position.x - delta.width : position.x,
    y: movesY ? position.y - delta.height : position.y,
  };

  act(() => {
    onResizeStop(new MouseEvent("mouseup"), direction, { offsetWidth: width, offsetHeight: height }, delta, corner);
  });
};







// -----------------------------------------------------------
// Loading the areas
// -----------------------------------------------------------

describe("InteractiveImageEditor — loading the areas", () => {

  it("shows 'Kraunasi...' until the areas arrive", async () => {
    const areas = deferred();
    backend.on("GET", LINKS, () => areas.promise);
    renderEditor();

    expect(screen.getByText("Kraunasi...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Išsaugoti" })).toBeNull();

    await act(async () => areas.resolve(reply.json([fx.questionLink()])));

    expect(await screen.findByRole("heading", { name: "Nuorodos" })).toBeInTheDocument();
    expect(screen.queryByText("Kraunasi...")).toBeNull();
  });


  it("loads with one axios GET carrying the session cookie — and never again while editing", async () => {
    const { user } = await renderLoaded([fx.questionLink()]);

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "GET", url: LINKS, withCredentials: true });
    expect(requests[0].body).toBeUndefined();

    await user.click(addButton());
    await user.type(urlField(cards()[0]), "/naujas");
    await user.click(cards()[1]);
    await settle();

    expect(backend.requests()).toHaveLength(1);
  });


  // Whatever a failed load shows (today "Kraunasi..." for good —
  // KB-32), it must not be an editor: "Išsaugoti" there would
  // replace the question's stored areas with none
  it.each([
    ["a server error", reply.status(500, "Internal Server Error")],
    ["an unknown question", reply.status(404, "Not Found")],
    ["no connection", reply.networkError()],
    // A captive portal's page answered 200 — not a list, so
    // reading it as one fails like a refused request
    [
      "a 200 HTML page instead of the list",
      reply.text("<!DOCTYPE html><html><body>Prisijunkite prie tinklo</body></html>", 200, { offContract: true }),
    ],
  ])("toasts 'Nepavyko užkrauti nuorodų' on %s and offers nothing to save", async (_, failure) => {
    backend.on("GET", LINKS, failure);
    renderEditor();

    await findToast("Nepavyko užkrauti nuorodų");

    expect(screen.queryByRole("button", { name: "Išsaugoti" })).toBeNull();
    expect(cards()).toEqual([]);
  });


  // An expired session is toasted like the failures above today;
  // KB-36 would send the admin to /login instead — either way
  // there is nothing to save from
  it("offers nothing to save when the session has expired (401)", async () => {
    backend.on("GET", LINKS, reply.status(401, "Unauthorized"));
    renderEditor();
    await settle();

    expect(backend.requests("GET", LINKS)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Išsaugoti" })).toBeNull();
    expect(cards()).toEqual([]);
  });


  it("shows the question's image on the canvas", async () => {
    await renderLoaded();

    expect(theImage()).toHaveAttribute("src", SRC);
  });
});







// -----------------------------------------------------------
// The area list
// -----------------------------------------------------------

describe("InteractiveImageEditor — the area list", () => {

  it("lists each area as a numbered card with its URL and whole-percent chips", async () => {
    await renderLoaded([FIRST, SECOND]);

    expect(screen.getByRole("heading", { name: "Nuorodos" })).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(cards()).toHaveLength(2);
    const [first, second] = cards();

    expect(within(first).getByText("1")).toBeInTheDocument();
    expect(urlField(first)).toHaveValue("https://pirmas.example");
    expect(chipsOf(first)).toEqual(["X: 15%", "Y: 42%", "Plotis: 20%", "Aukštis: 3%"]);

    expect(within(second).getByText("2")).toBeInTheDocument();
    expect(urlField(second)).toHaveValue("https://antras.example");
    expect(chipsOf(second)).toEqual(["X: 50%", "Y: 10%", "Plotis: 25%", "Aukštis: 8%"]);
  });


  it("selects nothing at first", async () => {
    await renderLoaded([FIRST, SECOND]);

    expect(cards().map(lookOfCard)).toEqual(["idle", "idle"]);
  });


  // The contract promises whole numbers only for x / y
  it("shows a fractional width / height rounded to a whole percent", async () => {
    await renderLoaded([fx.questionLink({ width: "12.4%", height: "12.6%" })]);

    expect(chipsOf(cards()[0])).toEqual(["X: 15%", "Y: 42%", "Plotis: 12%", "Aukštis: 13%"]);
  });


  it("reads a null coordinate — a stored value the API could not parse — as 0", async () => {
    await renderLoaded([fx.questionLink({ x: null, height: null })]);

    expect(chipsOf(cards()[0])).toEqual(["X: 0%", "Y: 42%", "Plotis: 20%", "Aukštis: 0%"]);
  });


  it("shows the how-to hint and the empty state for an image without areas", async () => {
    await renderLoaded([]);

    expect(screen.getByText("(0)")).toBeInTheDocument();
    expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument();
    expect(screen.getByText(
      "Pažymėkite laiško vietas, kurios rodys nuorodą — tempkite ir keiskite rėmelių dydį ant paveikslėlio."
    )).toBeInTheDocument();
    expect(cards()).toEqual([]);
  });


  it("lists a long set of areas completely, numbered in order", async () => {
    const many = Array.from({ length: 15 }, (_, index) =>
      fx.questionLink({ id: index + 1, url: `https://nuoroda-${index + 1}.example` })
    );

    await renderLoaded(many);

    expect(screen.getByText("(15)")).toBeInTheDocument();
    expect(cards()).toHaveLength(15);
    const last = cards()[14];
    expect(within(last).getByText("15")).toBeInTheDocument();
    expect(urlField(last)).toHaveValue("https://nuoroda-15.example");
    expect(screen.queryByText(EMPTY_STATE)).toBeNull();
  });
});







// -----------------------------------------------------------
// Adding, selecting, deleting, editing
// -----------------------------------------------------------

describe("InteractiveImageEditor — adding, selecting, deleting, editing", () => {

  it("'Pridėti' adds an empty 20 × 20 % area at 10 % / 10 % and selects it", async () => {
    const { user } = await renderLoaded([fx.questionLink()]);

    await user.click(addButton());

    expect(cards()).toHaveLength(2);
    expect(screen.getByText("(2)")).toBeInTheDocument();
    const added = cards()[1];
    expect(within(added).getByText("2")).toBeInTheDocument();
    expect(urlField(added)).toHaveValue("");
    expect(chipsOf(added)).toEqual(["X: 10%", "Y: 10%", "Plotis: 20%", "Aukštis: 20%"]);
    expect(added).toHaveClass(SELECTED_CARD);
    expect(cards()[0]).not.toHaveClass(SELECTED_CARD);
  });


  it("selects the newest area after every 'Pridėti'", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const { user } = await renderLoaded([]);

    await user.click(addButton());
    expect(cards().map(lookOfCard)).toEqual(["selected"]);
    expect(screen.queryByText(EMPTY_STATE)).toBeNull();

    // A second later, like a person's next click — the id is
    // the click's Date.now()
    vi.setSystemTime(NOW + 1000);
    await user.click(addButton());

    expect(cards().map(lookOfCard)).toEqual(["idle", "selected"]);
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });


  it("a click on a card selects it — and only it", async () => {
    const { user } = await renderLoaded([FIRST, SECOND]);
    const [first, second] = cards();

    await user.click(second);
    expect(cards().map(lookOfCard)).toEqual(["idle", "selected"]);

    await user.click(first);
    expect(cards().map(lookOfCard)).toEqual(["selected", "idle"]);
  });


  it("the delete button removes its card and the rest renumber", async () => {
    const { user } = await renderLoaded([FIRST, SECOND]);

    await user.click(deleteButton(cards()[0]));

    expect(cards()).toHaveLength(1);
    const [left] = cards();
    expect(urlField(left)).toHaveValue("https://antras.example");
    expect(within(left).getByText("1")).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument();
  });


  // The delete click must not select the card it sits on
  it("deleting another area keeps the current selection", async () => {
    const { user } = await renderLoaded([FIRST, SECOND]);
    await user.click(cards()[0]);

    await user.click(deleteButton(cards()[1]));

    expect(cards()).toHaveLength(1);
    expect(cards().map(lookOfCard)).toEqual(["selected"]);
  });


  it("deleting the last area brings the empty state back", async () => {
    const { user } = await renderLoaded([fx.questionLink()]);

    await user.click(deleteButton(cards()[0]));

    expect(cards()).toEqual([]);
    expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument();
    expect(screen.getByText("(0)")).toBeInTheDocument();
  });


  it("typing in 'Nuoroda' updates the area's URL", async () => {
    const { user } = await renderLoaded([fx.questionLink({ url: "http://example.com" })]);
    const field = urlField(cards()[0]);

    await user.clear(field);
    await user.type(field, "https://vu.lt/žinutė?gavėjas=ąčęėįšųūž");

    expect(field).toHaveValue("https://vu.lt/žinutė?gavėjas=ąčęėįšųūž");
  });
});







// -----------------------------------------------------------
// Saving
// -----------------------------------------------------------

describe("InteractiveImageEditor — saving", () => {

  it("'Išsaugoti' POSTs every area to the same URL as 0–1 fractions, with the session cookie", async () => {
    const { user } = await renderLoaded([FIRST, SECOND]);
    backend.on("POST", LINKS, reply.text("OK"));

    await user.click(saveButton());
    await findToast("Nuorodos išsaugotos");

    const saves = backend.requests("POST");
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ client: "axios", method: "POST", url: LINKS, withCredentials: true });
    expect(saves[0].json).toEqual({
      areas: [
        { id: 1, url: "https://pirmas.example", x: 0.15, y: 0.42, width: 0.2, height: 0.03 },
        { id: 2, url: "https://antras.example", x: 0.5, y: 0.1, width: 0.25, height: 0.08 },
      ],
    });
  });


  it("rounds every coordinate to a whole percent first — 12.4 % → 0.12, 12.6 % → 0.13", async () => {
    const { user } = await renderLoaded([fx.questionLink({ width: "12.4%", height: "12.6%" })]);

    expect(await saveOk(user)).toEqual({
      areas: [{ id: 1, url: "http://example.com", x: 0.15, y: 0.42, width: 0.12, height: 0.13 }],
    });
  });


  // The POST refuses null coordinates — the editor's 0 keeps the
  // save valid
  it("saves a null coordinate as 0", async () => {
    const { user } = await renderLoaded([fx.questionLink({ x: null, height: null })]);

    expect(await saveOk(user)).toEqual({
      areas: [{ id: 1, url: "http://example.com", x: 0, y: 0.42, width: 0.2, height: 0 }],
    });
  });


  it("saves added areas with their Date.now() ids and default geometry", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const { user } = await renderLoaded([]);

    await user.click(addButton());
    vi.setSystemTime(NOW + 1000);
    await user.click(addButton());

    expect(await saveOk(user)).toEqual({
      areas: [
        { id: NOW, url: "", x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
        { id: NOW + 1000, url: "", x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      ],
    });
  });


  it("saves the URL as typed, Lithuanian letters included", async () => {
    const { user } = await renderLoaded([fx.questionLink({ url: "http://example.com" })]);
    const field = urlField(cards()[0]);

    await user.clear(field);
    await user.type(field, "https://vu.lt/žinutė?gavėjas=ąčęėįšųūž");

    expect(await saveOk(user)).toEqual({
      areas: [{ id: 1, url: "https://vu.lt/žinutė?gavėjas=ąčęėįšųūž", x: 0.15, y: 0.42, width: 0.2, height: 0.03 }],
    });
  });


  it("leaves deleted areas out", async () => {
    const { user } = await renderLoaded([FIRST, SECOND]);

    await user.click(deleteButton(cards()[0]));

    expect(await saveOk(user)).toEqual({
      areas: [{ id: 2, url: "https://antras.example", x: 0.5, y: 0.1, width: 0.25, height: 0.08 }],
    });
  });


  // The POST replaces ALL areas — an empty list removes them
  it("saves an empty list once every area is deleted", async () => {
    const { user } = await renderLoaded([fx.questionLink()]);

    await user.click(deleteButton(cards()[0]));

    expect(await saveOk(user)).toEqual({ areas: [] });
  });


  it("an 'OK' toasts 'Nuorodos išsaugotos' and calls onSaveButtonClick once", async () => {
    const { user, onSaved } = await renderLoaded();

    await saveOk(user);

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(toastTexts()).not.toContain("Nepavyko išsaugoti nuorodų");
  });


  // The standalone /admin/questions/:questionID page passes none
  it("saves without an onSaveButtonClick too", async () => {
    const { user } = await renderLoaded([fx.questionLink()], { onSaveButtonClick: undefined });

    await saveOk(user);
    await settle();

    expect(toastTexts()).not.toContain("Nepavyko išsaugoti nuorodų");
  });


  it("reports nothing until the save is answered", async () => {
    const { user, onSaved } = await renderLoaded();
    const saving = deferred();
    backend.once("POST", LINKS, () => saving.promise);

    await user.click(saveButton());
    await settle();

    expect(backend.requests("POST", LINKS)).toHaveLength(1);
    expect(toastTexts()).toEqual([]);
    expect(onSaved).not.toHaveBeenCalled();

    await act(async () => saving.resolve(reply.text("OK")));

    await findToast("Nuorodos išsaugotos");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });


  it.each([
    ["a refused body (400)", reply.text("Error: Invalid request body", 400)],
    ["a deleted question (404)", reply.status(404, "Not Found")],
    ["a server error (500)", reply.status(500, "Internal Server Error")],
    ["no connection", reply.networkError()],
  ])("%s → 'Nepavyko išsaugoti nuorodų', no callback, the areas stay", async (_, failure) => {
    const { user, onSaved } = await renderLoaded([FIRST, SECOND]);
    backend.on("POST", LINKS, failure);

    await user.click(saveButton());
    await findToast("Nepavyko išsaugoti nuorodų");

    expect(onSaved).not.toHaveBeenCalled();
    expect(toastTexts()).not.toContain("Nuorodos išsaugotos");
    expect(cards()).toHaveLength(2);
  });


  // Toasted "Nepavyko išsaugoti nuorodų" today; KB-36 would send
  // the admin to /login instead — either way it is no success
  it("never reports a save refused to an expired session (401) as saved", async () => {
    const { user, onSaved } = await renderLoaded([FIRST, SECOND]);
    backend.on("POST", LINKS, reply.status(401, "Unauthorized"));

    await user.click(saveButton());
    await settle();

    expect(backend.requests("POST", LINKS)).toHaveLength(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(toastTexts()).not.toContain("Nuorodos išsaugotos");
    expect(cards()).toHaveLength(2);
  });


  it("a failed save can simply be retried", async () => {
    const { user, onSaved } = await renderLoaded([FIRST]);
    backend.once("POST", LINKS, reply.status(500, "Internal Server Error"));
    backend.on("POST", LINKS, reply.text("OK"));

    await user.click(saveButton());
    await findToast("Nepavyko išsaugoti nuorodų");
    expect(onSaved).not.toHaveBeenCalled();

    await user.click(saveButton());
    await findToast("Nuorodos išsaugotos");

    const [failed, retried] = backend.requests("POST", LINKS);
    expect(retried.json).toEqual(failed.json);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});







// -----------------------------------------------------------
// The boxes on the image
// -----------------------------------------------------------

describe("InteractiveImageEditor — the boxes on the image", () => {

  it("draws no boxes before the image has loaded", async () => {
    await renderLoaded([FIRST, SECOND]);
    placeImage(theImage());

    expect(boxes()).toEqual([]);
  });


  it("draws no boxes while the loaded image measures 0 × 0", async () => {
    await renderLoaded([FIRST, SECOND]);

    // jsdom's own measurement — every rect is empty
    fireEvent.load(theImage());

    expect(boxes()).toEqual([]);
  });


  // Which element bounds a drag is KB-30's business (today the
  // canvas, where it should be the image) — not asserted here
  it("sizes and places each box in px from its percentages", async () => {
    await renderMeasured([FIRST, SECOND]);

    expect(boxes().map(geometry)).toEqual([
      // 15 % × 500 + 50, 42 % × 300 + 10, 20 % × 500, 3 % × 300
      { x: 125, y: 136, width: 100, height: 9 },
      // 50 % × 500 + 50, 10 % × 300 + 10, 25 % × 500, 8 % × 300
      { x: 300, y: 40, width: 125, height: 24 },
    ]);
  });


  it("lays a 0 % / 0 % / 100 % × 100 % area exactly over the image", async () => {
    await renderMeasured([fx.questionLink({ x: "0%", y: "0%", width: "100%", height: "100%" })]);

    expect(geometry(boxes()[0])).toEqual({ x: 50, y: 10, width: 500, height: 300 });
  });


  it("a finished drag moves the area to the new whole-percent position", async () => {
    await renderMeasured([fx.questionLink()]);

    // (177 − 50) / 500 = 25.4 %, (104 − 10) / 300 = 31.3 %
    dragBox(boxes()[0], 177, 104);

    expect(chipsOf(cards()[0])).toEqual(["X: 25%", "Y: 31%", "Plotis: 20%", "Aukštis: 3%"]);
    // Snapped to the whole percent: 25 % × 500 + 50, 31 % × 300 + 10
    expect(geometry(boxes()[0])).toEqual({ x: 175, y: 103, width: 100, height: 9 });
  });


  it("a finished resize updates the size and the moved corner, in whole percent", async () => {
    await renderMeasured([fx.questionLink()]);

    // The top-left handle pulled from 100 × 9 out to 153 × 61 px:
    // the bottom-right corner (225, 145) stays, the top-left
    // moves to (72, 84) — (72 − 50) / 500 = 4.4 %,
    // (84 − 10) / 300 = 24.7 %, 153 / 500 = 30.6 %,
    // 61 / 300 = 20.3 %
    resizeBox(boxes()[0], "topLeft", { width: 153, height: 61 });

    expect(chipsOf(cards()[0])).toEqual(["X: 4%", "Y: 25%", "Plotis: 31%", "Aukštis: 20%"]);
    // 4 % × 500 + 50, 25 % × 300 + 10, 31 % × 500, 20 % × 300
    expect(geometry(boxes()[0])).toEqual({ x: 70, y: 85, width: 155, height: 60 });
  });


  it("a drag changes only the dragged area", async () => {
    await renderMeasured([FIRST, SECOND]);

    // Onto the image's top-left corner
    dragBox(boxes()[1], 50, 10);

    expect(chipsOf(cards()[1])).toEqual(["X: 0%", "Y: 0%", "Plotis: 25%", "Aukštis: 8%"]);
    expect(urlField(cards()[1])).toHaveValue("https://antras.example");
    expect(chipsOf(cards()[0])).toEqual(["X: 15%", "Y: 42%", "Plotis: 20%", "Aukštis: 3%"]);
  });


  it("a dragged area is saved at its new position", async () => {
    const { user } = await renderMeasured([fx.questionLink()]);

    dragBox(boxes()[0], 177, 104);

    expect(await saveOk(user)).toEqual({
      areas: [{ id: 1, url: "http://example.com", x: 0.25, y: 0.31, width: 0.2, height: 0.03 }],
    });
  });


  it("a click on a box selects its card", async () => {
    const { user } = await renderMeasured([FIRST, SECOND]);

    await user.click(boxes()[1]);

    expect(cards().map(lookOfCard)).toEqual(["idle", "selected"]);
    expect(boxes().map(lookOfBox)).toEqual(["idle", "selected"]);
  });


  it("draws the selected box as a solid pink frame on top, the others dashed blue", async () => {
    const { user } = await renderMeasured([FIRST, SECOND]);
    expect(boxes().map(lookOfBox)).toEqual(["idle", "idle"]);

    await user.click(boxes()[1]);

    const [idle, selected] = boxes();
    expect(selected.style.border).toBe(cssValue("border", "2px solid rgb(230, 65, 100)"));
    expect(selected.style.backgroundColor).toBe(cssValue("backgroundColor", "rgba(230, 65, 100, 0.25)"));
    expect(selected.style.zIndex).toBe("20");
    expect(idle.style.border).toBe(cssValue("border", "1.5px dashed rgb(59, 130, 246)"));
    expect(idle.style.backgroundColor).toBe(cssValue("backgroundColor", "rgba(59, 130, 246, 0.15)"));
    expect(idle.style.zIndex).toBe("10");
  });


  it("a click on a card highlights its box", async () => {
    const { user } = await renderMeasured([FIRST, SECOND]);

    await user.click(cards()[0]);

    expect(boxes().map(lookOfBox)).toEqual(["selected", "idle"]);
  });


  it("a new area appears as the selected box at 10 % / 10 %", async () => {
    const { user } = await renderMeasured([FIRST]);

    await user.click(addButton());

    expect(boxes()).toHaveLength(2);
    // 10 % × 500 + 50, 10 % × 300 + 10, 20 % × 500, 20 % × 300
    expect(geometry(boxes()[1])).toEqual({ x: 100, y: 40, width: 100, height: 60 });
    expect(boxes().map(lookOfBox)).toEqual(["idle", "selected"]);
  });


  it("deleting an area removes its box", async () => {
    const { user } = await renderMeasured([FIRST, SECOND]);

    await user.click(deleteButton(cards()[0]));

    expect(boxes().map(geometry)).toEqual([{ x: 300, y: 40, width: 125, height: 24 }]);
  });
});







// -----------------------------------------------------------
// Re-measuring
// -----------------------------------------------------------

describe("InteractiveImageEditor — re-measuring", () => {

  it("re-places the boxes after a window resize — the percentages stay", async () => {
    const { image } = await renderMeasured([fx.questionLink()]);

    placeImage(image, GROWN_IMAGE_BOX, GROWN_CANVAS_BOX);
    resizeWindow();

    // 15 % × 800 + 20, 42 % × 400 + 20, 20 % × 800, 3 % × 400
    expect(geometry(boxes()[0])).toEqual({ x: 140, y: 188, width: 160, height: 12 });
    expect(chipsOf(cards()[0])).toEqual(["X: 15%", "Y: 42%", "Plotis: 20%", "Aukštis: 3%"]);
  });


  // Layout shifts that fire no window resize — e.g. the
  // fullscreen editor opening
  it("re-places the boxes when the canvas itself resizes", async () => {
    const { image } = await renderMeasured([fx.questionLink()]);

    placeImage(image, GROWN_IMAGE_BOX, GROWN_CANVAS_BOX);
    act(() => {
      resizeObserved(image.parentNode, { width: GROWN_CANVAS_BOX.width, height: GROWN_CANVAS_BOX.height });
    });

    expect(geometry(boxes()[0])).toEqual({ x: 140, y: 188, width: 160, height: 12 });
  });


  it("converts a drag after a resize against the new image size", async () => {
    const { image } = await renderMeasured([fx.questionLink()]);
    placeImage(image, GROWN_IMAGE_BOX, GROWN_CANVAS_BOX);
    resizeWindow();

    // (420 − 20) / 800 = 50 %, (220 − 20) / 400 = 50 %
    dragBox(boxes()[0], 420, 220);

    expect(chipsOf(cards()[0])).toEqual(["X: 50%", "Y: 50%", "Plotis: 20%", "Aukštis: 3%"]);
  });
});
