// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — AddQuestion, the image upload dialog
//
//  src/systemPages/AdminPages/Questions/QuestionsList/
//  AddQuestion — a question is created by uploading its email
//  screenshot:
//    - the dialog: "Įkelti Paveikslėlį", the drop area (click
//      to pick, or drag & drop) and the upload button —
//      disabled until an image is picked
//    - react-dropzone vets a pick against the server's
//      whitelist before a byte leaves the browser: PNG / JPG /
//      GIF (by MIME type or extension), at most 5 MB, one
//      file. A refused pick only toasts — several files dropped
//      at once "Vienu metu galima įkelti tik vieną
//      paveikslėlį", anything else the whitelist. An accepted
//      pick is previewed as a data: URL
//    - the upload: POST /api/phishingpictures (axios,
//      withCredentials), "Content-Type: multipart/form-data"
//      as set by the code, a FormData whose only field is
//      "image" = the picked File
//    - the replies: {type: "ok"} → success toast, getData()
//      (the list refetch), setOpen(false); a refusal {type:
//      "error", reason} — HTTP 400 (the file) or 403 (not an
//      admin), and a 200 one the page also handles → its
//      reason in Lithuanian (one it has no Lithuanian for
//      as it comes); any other 200 body → "Neaiškus
//      atsakymas."; any other failed request → "Serverio
//      klaida." — after any failure the dialog stays open
//      with the image. A 401 (the session ended) sends the
//      admin to /login instead, with no toast. The contract's
//      only 2xx answer is {type, message}: the other 200
//      bodies here are marked offContract
//    - the button is disabled while the request runs: every
//      extra click would create another question
//    - ×, Escape and the backdrop close it — setOpen(false)
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { backend, deferred, reply } from "./support/backend";
import { findToast, renderPage, settle, toastTexts } from "./support/render";
import { hardNavigations } from "./support/navigation";

import AddQuestion from "@/systemPages/AdminPages/Questions/QuestionsList/AddQuestion/AddQuestion";


const UPLOAD = "/api/phishingpictures";
const UPLOADED = { type: "ok", message: "Image uploaded successfully" };

const PROMPT = "Vilkite paveikslėlį čia arba spustelėkite norėdami pasirinkti";
const PREVIEW = "Pasirinktas paveikslėlis";
const REFUSED_PICK = "Tinka tik PNG, JPG arba GIF paveikslėlis iki 5 MB";
const ONE_AT_A_TIME = "Vienu metu galima įkelti tik vieną paveikslėlį";

const MB = 1024 * 1024;


const renderDialog = () => {
  const setOpen = vi.fn();
  const getData = vi.fn();
  const result = renderPage(<AddQuestion setOpen={setOpen} getData={getData} />, { toaster: true });
  return { ...result, setOpen, getData };
};

// react-dropzone's hidden <input type="file">, and the drop area
// wrapping it
const fileInput = () => document.querySelector('input[type="file"]');
const dropArea = () => fileInput().parentElement;

const uploadButton = () => screen.getByRole("button", { name: "Įkelti Paveikslėlį" });
const preview = () => screen.queryByAltText(PREVIEW);
const closeButton = () => screen.getByTestId("CloseIcon").closest("button");


// A picked file whose ASCII `content` is its bytes — the preview
// it gets is then simply data:<type>;base64,btoa(content)
const image = (name, type, content = `${name} baitai`) => new File([content], name, { type });
const dataUrl = (type, content) => `data:${type};base64,${btoa(content)}`;

// react-dropzone judges the size by file.size alone (utils
// fileMatchSize) — a few bytes REPORTING a size stand in for a
// real multi-megabyte screenshot
const withSize = (file, size) => Object.defineProperty(file, "size", { value: size });

// A drag carrying `files` — jsdom has no DataTransfer, so the
// event gets this plain one (react-dropzone reads types + files)
const dragOf = (...files) => ({ dataTransfer: { files, types: ["Files"] } });


// Picks `file`, waits for its preview (what the admin sees before
// sending), then clicks upload
const pickAndUpload = async (user, file = image("laiskas.png", "image/png")) => {
  await user.upload(fileInput(), file);
  await screen.findByAltText(PREVIEW);
  await user.click(uploadButton());
  return file;
};







// -----------------------------------------------------------
// The dialog
// -----------------------------------------------------------

describe("AddQuestion — the dialog", () => {

  it("shows its title, the drop prompt and a disabled upload button — nothing sent", async () => {
    renderDialog();

    expect(screen.getByRole("heading", { name: "Įkelti Paveikslėlį" })).toBeInTheDocument();
    expect(screen.getByText(PROMPT)).toBeInTheDocument();
    expect(uploadButton()).toBeDisabled();
    expect(preview()).toBeNull();

    await settle();
    expect(backend.requests()).toHaveLength(0);
  });


  it("has the upload button as its only action — no stock Atšaukti / Patvirtinti", () => {
    renderDialog();

    expect(screen.queryByRole("button", { name: "Atšaukti" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Patvirtinti" })).toBeNull();
    expect(uploadButton()).toBeInTheDocument();
  });


  it("takes one PNG / JPG / GIF file through its hidden input", () => {
    renderDialog();

    // What the object form of `accept` becomes (react-dropzone
    // ignores a plain string — that once switched the filter off)
    expect(fileInput()).toHaveAttribute("accept", "image/png,.png,image/jpeg,.jpg,.jpeg,image/gif,.gif");
    expect(fileInput().multiple).toBe(false);
  });


  it("opens the browser's file picker on a click into the drop area", async () => {
    const { user } = renderDialog();
    const pickerOpened = vi.fn();
    fileInput().addEventListener("click", pickerOpened);

    await user.click(screen.getByText(PROMPT));

    expect(pickerOpened).toHaveBeenCalledTimes(1);
  });
});







// -----------------------------------------------------------
// Picking an image
// -----------------------------------------------------------

describe("AddQuestion — picking an image", () => {

  it.each([
    ["laiskas.png", "image/png"],
    ["laiskas.jpg", "image/jpeg"],
    ["laiskas.jpeg", "image/jpeg"],
    ["laiskas.gif", "image/gif"],
  ])("previews a picked %s as a data: URL and enables the upload", async (name, type) => {
    const { user } = renderDialog();

    await user.upload(fileInput(), image(name, type, "ekrano kopija"));

    expect(await screen.findByAltText(PREVIEW)).toHaveAttribute("src", dataUrl(type, "ekrano kopija"));
    expect(screen.queryByText(PROMPT)).toBeNull();
    expect(uploadButton()).toBeEnabled();

    // Picking alone sends nothing and raises no toast
    expect(backend.requests()).toHaveLength(0);
    expect(toastTexts()).toEqual([]);
  });


  it("takes a dragged-and-dropped image like a picked one", async () => {
    renderDialog();

    fireEvent.drop(dropArea(), dragOf(image("laiskas.png", "image/png", "nutemptas")));

    expect(await screen.findByAltText(PREVIEW)).toHaveAttribute("src", dataUrl("image/png", "nutemptas"));
    expect(uploadButton()).toBeEnabled();
    expect(backend.requests()).toHaveLength(0);
  });


  it("highlights the drop area while a file is dragged over it", async () => {
    renderDialog();
    const drag = dragOf(image("laiskas.png", "image/png"));
    expect(dropArea()).toHaveClass("bg-[#fafafa]");

    fireEvent.dragEnter(dropArea(), drag);
    await waitFor(() => expect(dropArea()).toHaveClass("bg-[#f0f0f0]"));

    fireEvent.dragLeave(dropArea(), drag);
    expect(dropArea()).toHaveClass("bg-[#fafafa]");
    expect(dropArea()).not.toHaveClass("bg-[#f0f0f0]");
  });


  it("replaces the picked image with a newer pick — and uploads that one", async () => {
    backend.on("POST", UPLOAD, reply.json(UPLOADED));
    const { user } = renderDialog();

    await user.upload(fileInput(), image("pirmas.png", "image/png", "pirmas"));
    await screen.findByAltText(PREVIEW);
    const gif = image("antras.gif", "image/gif", "antras");
    await user.upload(fileInput(), gif);
    await waitFor(() => expect(preview()).toHaveAttribute("src", dataUrl("image/gif", "antras")));

    await user.click(uploadButton());
    await findToast("Paveikslėlis sėkmingai įkeltas");

    expect(backend.requests("POST", UPLOAD)).toHaveLength(1);
    expect(backend.lastRequest("POST", UPLOAD).formData.get("image")).toBe(gif);
  });


  it("accepts a PNG of exactly 5 MB", async () => {
    const { user } = renderDialog();

    await user.upload(fileInput(), withSize(image("riba.png", "image/png", "riba"), 5 * MB));

    expect(await screen.findByAltText(PREVIEW)).toHaveAttribute("src", dataUrl("image/png", "riba"));
    expect(uploadButton()).toBeEnabled();
    expect(toastTexts()).toEqual([]);
  });
});







// -----------------------------------------------------------
// Refused picks
// -----------------------------------------------------------

describe("AddQuestion — refused picks", () => {

  it("refuses a text file: a toast, no preview, the upload stays disabled", async () => {
    renderDialog();

    // user-event's upload() silently drops a file the input's
    // accept attribute excludes (its applyAccept option, on by
    // default) — switched off here, so the file reaches
    // react-dropzone's own check the way one picked through the
    // browser's "All files" filter does
    const picker = userEvent.setup({ applyAccept: false });
    await picker.upload(fileInput(), new File(["tik tekstas"], "pastaba.txt", { type: "text/plain" }));

    expect((await findToast(REFUSED_PICK)).textContent).toBe(REFUSED_PICK);
    expect(preview()).toBeNull();
    expect(screen.getByText(PROMPT)).toBeInTheDocument();
    expect(uploadButton()).toBeDisabled();
    expect(backend.requests()).toHaveLength(0);
  });


  it("refuses a PNG over 5 MB", async () => {
    const { user } = renderDialog();

    await user.upload(fileInput(), withSize(image("didelis.png", "image/png"), 5 * MB + 1));

    expect((await findToast(REFUSED_PICK)).textContent).toBe(REFUSED_PICK);
    expect(preview()).toBeNull();
    expect(uploadButton()).toBeDisabled();
    expect(backend.requests()).toHaveLength(0);
  });


  it("refuses a dropped text file too", async () => {
    renderDialog();

    fireEvent.drop(dropArea(), dragOf(new File(["tik tekstas"], "pastaba.txt", { type: "text/plain" })));

    expect((await findToast(REFUSED_PICK)).textContent).toBe(REFUSED_PICK);
    expect(preview()).toBeNull();
    expect(uploadButton()).toBeDisabled();
  });


  // The file dialog lets only one be picked, a drag does not —
  // react-dropzone then refuses both as "too-many-files"
  it("refuses two good images dropped at once as one too many — not as a wrong type or size", async () => {
    renderDialog();

    fireEvent.drop(dropArea(), dragOf(image("pirmas.png", "image/png"), image("antras.png", "image/png")));

    expect((await findToast(ONE_AT_A_TIME)).textContent).toBe(ONE_AT_A_TIME);
    expect(toastTexts()).toEqual([ONE_AT_A_TIME]);
    expect(preview()).toBeNull();
    expect(uploadButton()).toBeDisabled();
    expect(backend.requests()).toHaveLength(0);
  });


  it("keeps the image picked before a refused pick — and uploads that one", async () => {
    backend.on("POST", UPLOAD, reply.json(UPLOADED));
    const { user } = renderDialog();
    const picker = userEvent.setup({ applyAccept: false });
    const png = image("laiskas.png", "image/png", "pirmas");

    await user.upload(fileInput(), png);
    await screen.findByAltText(PREVIEW);
    await picker.upload(fileInput(), new File(["tik tekstas"], "pastaba.txt", { type: "text/plain" }));
    await findToast(REFUSED_PICK);

    expect(preview()).toHaveAttribute("src", dataUrl("image/png", "pirmas"));
    expect(uploadButton()).toBeEnabled();

    await user.click(uploadButton());
    await findToast("Paveikslėlis sėkmingai įkeltas");
    expect(backend.lastRequest("POST", UPLOAD).formData.get("image")).toBe(png);
  });
});







// -----------------------------------------------------------
// Uploading
// -----------------------------------------------------------

describe("AddQuestion — uploading", () => {

  it("sends exactly one POST: the picked file as the only multipart field 'image', with the session cookie", async () => {
    backend.on("POST", UPLOAD, reply.json(UPLOADED));
    const { user } = renderDialog();

    const file = await pickAndUpload(user, image("laiskas.png", "image/png"));
    await findToast("Paveikslėlis sėkmingai įkeltas");

    const requests = backend.requests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ client: "axios", method: "POST", url: UPLOAD, withCredentials: true });
    // As set by the code; in a browser axios's XHR adapter drops
    // it for a FormData body so the browser adds the boundary
    expect(requests[0].headers["content-type"]).toBe("multipart/form-data");
    expect(requests[0].json).toBeUndefined();

    const { formData } = requests[0];
    expect(formData).toBeInstanceOf(FormData);
    expect([...formData.keys()]).toEqual(["image"]);
    expect(formData.get("image")).toBe(file);
    expect(formData.get("image").name).toBe("laiskas.png");
    expect(formData.get("image").type).toBe("image/png");
  });


  it("on {type: 'ok'} toasts the success, refreshes the list once and closes", async () => {
    backend.on("POST", UPLOAD, reply.json(UPLOADED));
    const { user, getData, setOpen } = renderDialog();

    await pickAndUpload(user);

    expect((await findToast("Paveikslėlis sėkmingai įkeltas")).textContent).toBe("Paveikslėlis sėkmingai įkeltas");
    expect(getData).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(false);
  });


  it("disables the button while the upload runs — a second click sends nothing", async () => {
    const upload = deferred();
    backend.on("POST", UPLOAD, () => upload.promise);
    const { user, getData } = renderDialog();

    await pickAndUpload(user);
    expect(uploadButton()).toBeDisabled();

    // user-event refuses to click it (MUI's disabled style is
    // pointer-events: none) — a raw click is dropped by React
    fireEvent.click(uploadButton());
    await settle();
    expect(backend.requests("POST", UPLOAD)).toHaveLength(1);
    expect(getData).not.toHaveBeenCalled();

    await act(async () => upload.resolve(reply.json(UPLOADED)));
    await findToast("Paveikslėlis sėkmingai įkeltas");

    expect(backend.requests("POST", UPLOAD)).toHaveLength(1);
    expect(getData).toHaveBeenCalledTimes(1);
  });


  // Every refusal the backend has (upload_picture): {type:
  // "error", reason} with HTTP 400 (what is wrong with the
  // file) or 403 (not an admin) — told in Lithuanian
  it.each([
    [400, "No file part in the request", "Užklausoje nėra paveikslėlio"],
    [400, "File type not allowed", "Netinkamas failo tipas — tinka PNG, JPG arba GIF"],
    [400, "Empty file", "Failas tuščias"],
    [400, "File is too large", "Failas per didelis — daugiausia 5 MB"],
    [400, "File is not an image", "Failas nėra PNG, JPG ar GIF paveikslėlis"],
    [403, "Not Admin", "Neturite administratoriaus teisių"],
  ])("on a %i refusal '%s' says why in Lithuanian and stays open with the image", async (status, reason, shown) => {
    backend.on("POST", UPLOAD, reply.json({ type: "error", reason }, status));
    const { user, getData, setOpen } = renderDialog();

    await pickAndUpload(user);

    expect((await findToast(shown)).textContent).toBe(`Nepavyko įkelti:${shown}`);
    expect(toastTexts()).toEqual([`Nepavyko įkelti:${shown}`]);
    expect(getData).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
    expect(preview()).not.toBeNull();
    await waitFor(() => expect(uploadButton()).toBeEnabled());
  });


  // A reason added to the backend later still says more than
  // "Serverio klaida."
  it("shows a refusal reason it has no Lithuanian for as it comes", async () => {
    backend.on("POST", UPLOAD, reply.json({ type: "error", reason: "Image dimensions too small" }, 400));
    const { user } = renderDialog();

    await pickAndUpload(user);

    expect((await findToast("Image dimensions too small")).textContent).toBe("Nepavyko įkelti:Image dimensions too small");
  });


  it("on a 200 {type: 'error'} says why in Lithuanian too and stays open with the image", async () => {
    // The backend refuses with a 400 (above) — a refusal on a
    // 200 is off the contract, but the page keeps a branch for it
    backend.on("POST", UPLOAD, reply.json({ type: "error", reason: "Empty file" }, 200, { offContract: true }));
    const { user, getData, setOpen } = renderDialog();

    await pickAndUpload(user);

    expect((await findToast("Failas tuščias")).textContent).toBe("Nepavyko įkelti:Failas tuščias");
    expect(getData).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
    expect(preview()).not.toBeNull();
    await waitFor(() => expect(uploadButton()).toBeEnabled());
  });


  // The page's fallback for anything but {type: "ok" | "error"} —
  // none of these is on the contract, so they are marked as such
  it.each([
    ["an empty object", reply.json({}, 200, { offContract: true })],
    ["the question endpoints' {status: 'ok'}", reply.json({ status: "ok" }, 200, { offContract: true })],
    ["a plain-text 'OK'", reply.text("OK", 200, { offContract: true })],
  ])("answers %s with 'Neaiškus atsakymas.' and stays open", async (_, answer) => {
    backend.on("POST", UPLOAD, answer);
    const { user, getData, setOpen } = renderDialog();

    await pickAndUpload(user);

    expect((await findToast("Neaiškus atsakymas.")).textContent).toBe("Nepavyko įkelti:Neaiškus atsakymas.");
    expect(getData).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
  });


  it.each([
    ["no connection", reply.networkError()],
    ["a 500", reply.status(500, "Internal Server Error")],
    ["a 502 from the proxy", reply.status(502, "Bad Gateway")],
  ])("answers %s with 'Serverio klaida.' and stays open with the image", async (_, answer) => {
    backend.on("POST", UPLOAD, answer);
    const { user, getData, setOpen } = renderDialog();

    await pickAndUpload(user);

    expect((await findToast("Serverio klaida.")).textContent).toBe("Nepavyko įkelti:Serverio klaida.");
    expect(getData).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
    expect(preview()).not.toBeNull();
  });


  // The session ended meanwhile (logged out in another tab, or
  // dropped server-side) — any admin page load would do the same
  it("a 401 sends the admin to /login instead of toasting 'Serverio klaida.'", async () => {
    backend.on("POST", UPLOAD, reply.status(401, "Unauthorized"));
    const { user, getData, setOpen } = renderDialog();

    await pickAndUpload(user);
    await waitFor(() => expect(hardNavigations()).toEqual(["/login"]));
    await settle();

    expect(toastTexts()).toEqual([]);
    expect(getData).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalled();
  });


  it("sends the same image again after a failed upload", async () => {
    backend.once("POST", UPLOAD, reply.networkError());
    backend.on("POST", UPLOAD, reply.json(UPLOADED));
    const { user, getData, setOpen } = renderDialog();

    const file = await pickAndUpload(user);
    await findToast("Serverio klaida.");
    await waitFor(() => expect(uploadButton()).toBeEnabled());
    await user.click(uploadButton());
    await findToast("Paveikslėlis sėkmingai įkeltas");

    const uploads = backend.requests("POST", UPLOAD);
    expect(uploads).toHaveLength(2);
    expect(uploads[1].formData.get("image")).toBe(file);
    expect(getData).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(false);
  });
});







// -----------------------------------------------------------
// Closing
// -----------------------------------------------------------

describe("AddQuestion — closing", () => {

  it("closes on the × button without a request", async () => {
    const { user, setOpen } = renderDialog();

    await user.click(closeButton());
    await settle();

    expect(setOpen).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(backend.requests()).toHaveLength(0);
  });


  it("closes on Escape without uploading the picked image", async () => {
    const { user, setOpen } = renderDialog();
    await user.upload(fileInput(), image("laiskas.png", "image/png"));

    // Dispatched inside the dialog — MUI's Modal listens on its own
    // root, wherever the focus trap put the focus
    fireEvent.keyDown(await screen.findByAltText(PREVIEW), { key: "Escape" });
    await settle();

    expect(setOpen).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(backend.requests()).toHaveLength(0);
  });


  it("closes on a backdrop click", async () => {
    const { user, setOpen } = renderDialog();

    await user.click(document.querySelector(".MuiBackdrop-root"));
    await settle();

    expect(setOpen).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(backend.requests()).toHaveLength(0);
  });
});
