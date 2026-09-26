// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — InteractiveImage, the email viewer
//
//  src/components/Other/InteractiveImage/InteractiveImage.jsx
//  — a question's screenshot with its clickable link areas
//  (the test page and its fullscreen viewer, the answer
//  review, the question bank preview):
//    - <img alt="Fišingo El. Laiškas">, blurred (blur(3px))
//      until THIS src fired load
//    - only then GET <clickableAreasUrl> — one plain fetch, no
//      options; no URL, no request at all
//    - the areas arrive as PERCENT STRINGS ("15%") and become
//      absolutely positioned boxes: percent × the measured
//      image size, shifted by the image's offset inside its
//      container; filled with clickableAreaColor (default
//      rgba(255, 255, 0, 0.5) — the test page passes a
//      transparent one)
//    - hover → the URL in a black bubble 30 px above the area;
//      the bubble stays open while the pointer is on it
//    - onImageClick for any click inside (with the event)
//    - a window resize re-measures
//    - a failed request (no connection, the plain-text 401 /
//      404 / 500 pages, a 200 HTML page — the status is never
//      checked, only the body) → console.error "Error fetching
//      clickable areas:", no areas, no crash
//    - a new src is blurred again and fetches its own areas
//      after its own load
//
//  jsdom has no layout: the tests stub getBoundingClientRect
//  of the <img> and of its container before the load / resize
//  that measures them.
//
//  The viewer's known defects are pinned in knownBugs.test.jsx;
//  the tests here hold with and without their fixes:
//    - KB-13 (the previous src's areas landing on the next
//      image) — no test here leaves an areas request running
//      across a src change, or looks at the next image between
//      its load and its own areas
//    - KB-28 (only a window "resize" re-measures) — a window
//      resize here also reports the new sizes to any
//      ResizeObserver, as a browser would
//    - KB-29 (a null coordinate) — no test here sends one
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { backend, deferred, reply } from "./support/backend";
import { allowConsoleError, consoleErrors, resizeObserved } from "./support/setup";
import { settle } from "./support/render";
import { linkAreas } from "./support/interactions";
import * as fx from "./support/fixtures";

import InteractiveImage from "@/components/Other/InteractiveImage/InteractiveImage";


const SRC = "/api/phishingpictures/21";
const LINKS = "/api/phishingpictures/21/links";

const NEXT_SRC = "/api/phishingpictures/22";
const NEXT_LINKS = "/api/phishingpictures/22/links";


// The measured layout: the image starts 20 px right and 30 px
// down from its container's corner and is 400 × 200 px
const CONTAINER_BOX = { left: 10, top: 20, width: 500, height: 300 };
const IMAGE_BOX = { left: 30, top: 50, width: 400, height: 200 };

// fx.questionLink() ("15%", "42%", "20%", "3%") on that layout:
// 20 + 15 % × 400, 30 + 42 % × 200, 20 % × 400, 3 % × 200
const LINK_BOX = { left: 80, top: 114, width: 80, height: 6 };

// After the window grew: 800 × 400, now 100 px right and 50 px
// down from the (unmoved) container's corner
const GROWN_IMAGE_BOX = { left: 110, top: 70, width: 800, height: 400 };


const domRect = ({ left, top, width, height }) => ({
  left, top, width, height, x: left, y: top, right: left + width, bottom: top + height,
});

// What a browser would measure — in place before the load /
// resize event that reads it
const placeImage = (image, imageBox = IMAGE_BOX, containerBox = CONTAINER_BOX) => {
  image.getBoundingClientRect = () => domRect(imageBox);
  image.parentNode.getBoundingClientRect = () => domRect(containerBox);
};

const theImage = () => screen.getByAltText("Fišingo El. Laiškas");

// A window resize as the page sees it: the "resize" event, and
// the image's and its container's (placed) sizes reported to
// any ResizeObserver watching them — today only the event
// re-measures (KB-28), a fix may use an observer instead
const resizeWindow = () => {
  const image = theImage();
  const sizeOf = (element) => {
    const { width, height } = element.getBoundingClientRect();
    return { width, height };
  };

  act(() => {
    window.dispatchEvent(new Event("resize"));
    resizeObserved(image, sizeOf(image));
    resizeObserved(image.parentNode, sizeOf(image.parentNode));
  });
};

// "114px" → 114, rounded to 1/1000 px: percent × size can
// leave float noise (60.00000000000001)
const px = (value) => Math.round(parseFloat(value) * 1000) / 1000;

const boxOf = (element) => ({
  left: px(element.style.left),
  top: px(element.style.top),
  width: px(element.style.width),
  height: px(element.style.height),
});

// A CSS value spelled the way the DOM's style engine stores it
// (jsdom normalizes colors) — throws instead of comparing two
// empty strings when the engine rejects the value
const cssValue = (property, value) => {
  const probe = document.createElement("div");
  probe.style[property] = value;
  if (probe.style[property] === "") {
    throw new Error(`The style engine rejected ${property}: ${value}`);
  }
  return probe.style[property];
};

// Mounted with `areas` as the areas reply, measured and loaded
// — resolves once that reply has been applied (drawn)
const renderLoaded = async (areas = [fx.questionLink()], { props = {}, containerBox = CONTAINER_BOX } = {}) => {
  backend.on("GET", LINKS, reply.json(areas));
  const result = render(<InteractiveImage src={SRC} clickableAreasUrl={LINKS} {...props} />);

  placeImage(theImage(), IMAGE_BOX, containerBox);
  fireEvent.load(theImage());
  await settle();
  await waitFor(() => expect(linkAreas(result.container)).toHaveLength(areas.length));

  return result;
};

// The test page reuses one InteractiveImage for every question:
// the first image loaded and got its areas (that request is
// answered), then the next question's src and URL arrive
const showNextQuestion = async ({ hovering = false } = {}) => {
  backend.on("GET", LINKS, reply.json([fx.questionLink({ id: 1, url: "https://pirmas.example" })]));
  backend.on("GET", NEXT_LINKS, reply.json([
    fx.questionLink({ id: 2, url: "https://antras.example" }),
    fx.questionLink({ id: 3, url: "https://trecias.example", x: "50%", y: "10%" }),
  ]));

  const result = render(<InteractiveImage src={SRC} clickableAreasUrl={LINKS} />);
  placeImage(theImage());
  fireEvent.load(theImage());
  await waitFor(() => expect(linkAreas(result.container)).toHaveLength(1));

  if (hovering) {
    fireEvent.mouseEnter(linkAreas(result.container)[0]);
    expect(screen.getByText("https://pirmas.example")).toBeInTheDocument();
  }

  result.rerender(<InteractiveImage src={NEXT_SRC} clickableAreasUrl={NEXT_LINKS} />);
  await settle();

  return result;
};







// -----------------------------------------------------------
// The image
// -----------------------------------------------------------

describe("InteractiveImage — the image", () => {

  it("shows the screenshot blurred until it has loaded", () => {
    render(<InteractiveImage src={SRC} />);
    const image = theImage();

    expect(image).toHaveAttribute("src", SRC);
    expect(image.style.filter).toBe("blur(3px)");

    fireEvent.load(image);

    expect(image.style.filter).toBe("");
  });


  // The fullscreen viewer centers the image with these
  it("merges the caller's container and image styles into its own", () => {
    render(
      <InteractiveImage
        src={SRC}
        containerStyle={{ width: "100%", display: "flex", justifyContent: "center" }}
        imageStyle={{ maxWidth: "100%", display: "block" }}
      />
    );
    const image = theImage();

    expect(image.parentNode.style.position).toBe("relative");
    expect(image.parentNode.style.display).toBe("flex");
    expect(image.style.maxWidth).toBe("100%");
    expect(image.style.filter).toBe("blur(3px)");

    fireEvent.load(image);

    expect(image.style.maxWidth).toBe("100%");
    expect(image.style.display).toBe("block");
    expect(image.style.filter).toBe("");
  });


  it("keeps an image that failed to load blurred, and asks for no areas", async () => {
    render(<InteractiveImage src={SRC} clickableAreasUrl={LINKS} />);

    fireEvent.error(theImage());
    await settle();

    expect(theImage().style.filter).toBe("blur(3px)");
    expect(backend.requests()).toEqual([]);
  });
});







// -----------------------------------------------------------
// Fetching the link areas
// -----------------------------------------------------------

describe("InteractiveImage — fetching the link areas", () => {

  it("asks for nothing while the image is still loading", async () => {
    render(<InteractiveImage src={SRC} clickableAreasUrl={LINKS} />);
    await settle();

    expect(backend.requests()).toEqual([]);
  });


  it("fetches the areas once the image has loaded — one plain fetch GET, no options", async () => {
    backend.on("GET", LINKS, reply.json([fx.questionLink()]));
    render(<InteractiveImage src={SRC} clickableAreasUrl={LINKS} />);

    fireEvent.load(theImage());
    await settle();

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "fetch", method: "GET", url: LINKS });
    expect(requests[0].headers).toEqual({});
    expect(requests[0].credentials).toBeUndefined();
    expect(requests[0].body).toBeUndefined();
  });


  it("fetches nothing without a clickableAreasUrl, and still unblurs", async () => {
    render(<InteractiveImage src={SRC} />);

    fireEvent.load(theImage());
    await settle();

    expect(backend.requests()).toEqual([]);
    expect(theImage().style.filter).toBe("");
  });


  it("does not fetch again on hovering, resizing or a repeated load event", async () => {
    const { container } = await renderLoaded();

    fireEvent.mouseEnter(linkAreas(container)[0]);
    resizeWindow();
    fireEvent.load(theImage());
    await settle();

    expect(backend.requests("GET", LINKS)).toHaveLength(1);
  });
});







// -----------------------------------------------------------
// Drawing the areas
// -----------------------------------------------------------

describe("InteractiveImage — drawing the areas", () => {

  it("places an area from its percent strings over the measured image", async () => {
    const { container } = await renderLoaded([fx.questionLink()]);

    const areas = linkAreas(container);
    expect(areas).toHaveLength(1);
    expect(boxOf(areas[0])).toEqual(LINK_BOX);
  });


  it("adds no offset for an image flush with its container's corner", async () => {
    const { container } = await renderLoaded([fx.questionLink()], { containerBox: IMAGE_BOX });

    // 15 % × 400, 42 % × 200 — nothing added
    expect(boxOf(linkAreas(container)[0])).toEqual({ left: 60, top: 84, width: 80, height: 6 });
  });


  it("draws one box per area, in the order the API sends them", async () => {
    const { container } = await renderLoaded([
      fx.questionLink({ id: 1 }),
      fx.questionLink({ id: 2, x: "50%", y: "10%", width: "25%", height: "10%" }),
      fx.questionLink({ id: 3, x: "0%", y: "0%", width: "100%", height: "100%" }),
    ]);

    expect(linkAreas(container).map(boxOf)).toEqual([
      LINK_BOX,
      { left: 220, top: 50, width: 100, height: 20 },
      // The whole image
      { left: 20, top: 30, width: 400, height: 200 },
    ]);
  });


  it("draws a long list of areas completely", async () => {
    const many = Array.from({ length: 15 }, (_, index) =>
      fx.questionLink({ id: index + 1, url: `https://nuoroda-${index + 1}.example` })
    );

    const { container } = await renderLoaded(many);

    expect(linkAreas(container)).toHaveLength(15);
  });


  it("draws nothing for an image without link areas", async () => {
    const { container } = await renderLoaded([]);

    expect(linkAreas(container)).toEqual([]);
    expect(theImage().style.filter).toBe("");
  });


  it("fills the areas half-transparent yellow by default", async () => {
    const { container } = await renderLoaded();

    expect(linkAreas(container)[0].style.backgroundColor).toBe(cssValue("backgroundColor", "rgba(255, 255, 0, 0.5)"));
  });


  // The test page must not give the links away: it paints them
  // fully transparent, and they still answer to hovering
  it("fills them with clickableAreaColor — invisible areas still show their URL", async () => {
    const { container } = await renderLoaded(
      [fx.questionLink({ url: "http://example.com" })],
      { props: { clickableAreaColor: "rgba(0, 0, 0, 0.0)" } }
    );
    const [area] = linkAreas(container);

    expect(area.style.backgroundColor).toBe(cssValue("backgroundColor", "rgba(0, 0, 0, 0.0)"));

    fireEvent.mouseEnter(area);

    expect(screen.getByText("http://example.com")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// The URL bubble
// -----------------------------------------------------------

describe("InteractiveImage — the URL bubble", () => {

  it("shows the hovered area's URL in a black bubble 30 px above it", async () => {
    const { container } = await renderLoaded([fx.questionLink({ url: "http://example.com" })]);
    expect(screen.queryByText("http://example.com")).toBeNull();

    fireEvent.mouseEnter(linkAreas(container)[0]);

    const bubble = screen.getByText("http://example.com");
    expect(px(bubble.style.left)).toBe(LINK_BOX.left);
    expect(px(bubble.style.top)).toBe(LINK_BOX.top - 30);
    expect(bubble.style.backgroundColor).toBe(cssValue("backgroundColor", "black"));
    expect(bubble.style.color).toBe(cssValue("color", "white"));
    expect(bubble.style.zIndex).toBe("10");

    // The bubble is no link area itself
    expect(linkAreas(container)).toHaveLength(1);
  });


  it("hides the bubble when the pointer leaves the area", async () => {
    const { container } = await renderLoaded([fx.questionLink({ url: "http://example.com" })]);
    const [area] = linkAreas(container);

    fireEvent.mouseEnter(area);
    fireEvent.mouseLeave(area);

    expect(screen.queryByText("http://example.com")).toBeNull();
  });


  it("keeps the bubble open while the pointer moves from the area onto it", async () => {
    const { container } = await renderLoaded([fx.questionLink({ url: "http://example.com" })]);
    const [area] = linkAreas(container);
    fireEvent.mouseEnter(area);
    const bubble = screen.getByText("http://example.com");

    // One pointer move: React gets a single mouseout of the area
    // toward the bubble and runs the area's leave and the
    // bubble's enter together
    fireEvent.mouseOut(area, { relatedTarget: bubble });

    expect(screen.getByText("http://example.com")).toBe(bubble);

    fireEvent.mouseLeave(bubble);

    expect(screen.queryByText("http://example.com")).toBeNull();
  });


  it("shows only the hovered area's URL", async () => {
    const { container } = await renderLoaded([
      fx.questionLink({ id: 1, url: "https://pirmas.example" }),
      fx.questionLink({ id: 2, url: "https://antras.example", x: "50%", y: "10%" }),
    ]);
    const [first, second] = linkAreas(container);

    fireEvent.mouseEnter(second);

    const bubble = screen.getByText("https://antras.example");
    expect(screen.queryByText("https://pirmas.example")).toBeNull();
    // 20 + 50 % × 400; 30 + 10 % × 200 − 30
    expect(px(bubble.style.left)).toBe(220);
    expect(px(bubble.style.top)).toBe(20);

    fireEvent.mouseLeave(second);
    fireEvent.mouseEnter(first);

    expect(screen.getByText("https://pirmas.example")).toBeInTheDocument();
    expect(screen.queryByText("https://antras.example")).toBeNull();
  });


  it("shows a URL with Lithuanian letters exactly as stored", async () => {
    const url = "https://pavyzdys.lt/prisijungimas?vardas=Žemaitė&miestas=Šiauliai&ąčęėįšųūž";
    const { container } = await renderLoaded([fx.questionLink({ url })]);

    fireEvent.mouseEnter(linkAreas(container)[0]);

    expect(screen.getByText(url)).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// Clicks
// -----------------------------------------------------------

describe("InteractiveImage — clicks", () => {

  // The answer review and the bank preview stop the event's
  // propagation in their handler, so it must be handed over
  it("calls onImageClick with the event for a click on the image", () => {
    const onImageClick = vi.fn();
    render(<InteractiveImage src={SRC} onImageClick={onImageClick} />);

    fireEvent.click(theImage());

    expect(onImageClick).toHaveBeenCalledTimes(1);
    expect(onImageClick).toHaveBeenCalledWith(expect.objectContaining({ type: "click" }));
  });


  it("calls onImageClick for a click on the container around the image", () => {
    const onImageClick = vi.fn();
    render(<InteractiveImage src={SRC} onImageClick={onImageClick} />);

    fireEvent.click(theImage().parentNode);

    expect(onImageClick).toHaveBeenCalledTimes(1);
  });


  // The test page opens its fullscreen viewer with onImageClick
  // — a click on a link area must open it too
  it("lets a click on a link area through to onImageClick", async () => {
    const onImageClick = vi.fn();
    const { container } = await renderLoaded([fx.questionLink()], { props: { onImageClick } });

    fireEvent.click(linkAreas(container)[0]);

    expect(onImageClick).toHaveBeenCalledTimes(1);
  });
});







// -----------------------------------------------------------
// Re-measuring
// -----------------------------------------------------------

describe("InteractiveImage — re-measuring", () => {

  it("moves the areas with the image after a window resize", async () => {
    const { container } = await renderLoaded();

    placeImage(theImage(), GROWN_IMAGE_BOX);
    resizeWindow();

    // 100 + 15 % × 800, 50 + 42 % × 400, 20 % × 800, 3 % × 400
    expect(boxOf(linkAreas(container)[0])).toEqual({ left: 220, top: 218, width: 160, height: 12 });
  });


  it("moves an open URL bubble along", async () => {
    const { container } = await renderLoaded([fx.questionLink({ url: "http://example.com" })]);
    fireEvent.mouseEnter(linkAreas(container)[0]);

    placeImage(theImage(), GROWN_IMAGE_BOX);
    resizeWindow();

    const bubble = screen.getByText("http://example.com");
    expect(px(bubble.style.left)).toBe(220);
    expect(px(bubble.style.top)).toBe(218 - 30);
  });
});







// -----------------------------------------------------------
// Failed requests
// -----------------------------------------------------------

describe("InteractiveImage — failed requests", () => {

  it.each([
    ["no connection", reply.networkError(), /TypeError: Failed to fetch/],
    ["the plain-text 401 of an expired session", reply.status(401, "Unauthorized"), /SyntaxError/],
    ["the 404 page of an unknown question", reply.status(404, "Not Found"), /SyntaxError/],
    ["a 500 error page", reply.status(500, "Internal Server Error"), /SyntaxError/],
    // The response status is never checked — only the body
    // decides; a network's captive portal answers 200 with HTML
    [
      "a 200 HTML page instead of the list",
      reply.text("<!DOCTYPE html><html><body>Prisijunkite prie tinklo</body></html>", 200, { offContract: true }),
      /SyntaxError/,
    ],
  ])("logs 'Error fetching clickable areas:' and draws no areas on %s", async (_, failure, cause) => {
    allowConsoleError(/^Error fetching clickable areas:/);
    backend.on("GET", LINKS, failure);
    const { container } = render(<InteractiveImage src={SRC} clickableAreasUrl={LINKS} />);

    placeImage(theImage());
    fireEvent.load(theImage());
    await settle();

    const logged = consoleErrors();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatch(/^Error fetching clickable areas: /);
    expect(logged[0]).toMatch(cause);
    expect(linkAreas(container)).toEqual([]);
    expect(theImage().style.filter).toBe("");
    expect(backend.requests("GET", LINKS)).toHaveLength(1);
  });
});







// -----------------------------------------------------------
// A new src (the next question)
// -----------------------------------------------------------

describe("InteractiveImage — a new src", () => {

  it("blurs the next image and shows none of the previous areas until it has loaded", async () => {
    const { container } = await showNextQuestion();

    expect(theImage()).toHaveAttribute("src", NEXT_SRC);
    expect(theImage().style.filter).toBe("blur(3px)");
    expect(linkAreas(container)).toEqual([]);
    expect(backend.requests("GET", NEXT_LINKS)).toEqual([]);
  });


  it("closes an open URL bubble while the next image loads", async () => {
    await showNextQuestion({ hovering: true });

    expect(screen.queryByText("https://pirmas.example")).toBeNull();
  });


  it("fetches the next image's own areas after its own load", async () => {
    const { container } = await showNextQuestion();

    fireEvent.load(theImage());
    await waitFor(() => expect(linkAreas(container)).toHaveLength(2));

    expect(theImage().style.filter).toBe("");
    expect(backend.requests("GET", LINKS)).toHaveLength(1);
    const nextRequests = backend.requests("GET", NEXT_LINKS);
    expect(nextRequests).toHaveLength(1);
    expect(nextRequests[0]).toMatchObject({ client: "fetch", method: "GET", url: NEXT_LINKS });

    fireEvent.mouseEnter(linkAreas(container)[1]);

    expect(screen.getByText("https://trecias.example")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// Unmounting
// -----------------------------------------------------------

describe("InteractiveImage — unmounting", () => {

  it("drops an areas reply that arrives after unmount without a warning", async () => {
    const areas = deferred();
    backend.on("GET", LINKS, () => areas.promise);
    const { unmount } = render(<InteractiveImage src={SRC} clickableAreasUrl={LINKS} />);
    fireEvent.load(theImage());
    expect(backend.requests("GET", LINKS)).toHaveLength(1);

    unmount();
    await act(async () => areas.resolve(reply.json([fx.questionLink()])));
    await settle();

    expect(consoleErrors()).toEqual([]);
  });
});
