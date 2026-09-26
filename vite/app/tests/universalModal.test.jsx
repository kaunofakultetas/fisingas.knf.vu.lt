// @vitest-environment jsdom
// -----------------------------------------------------------
//  [*] Regression tests — UniversalModal
//
//  src/components/Other/UniversalModal — the shared dialog
//  (the administrator editor and the image upload use it):
//    - header: variant icon, title, description, close (×)
//    - body: arbitrary children
//    - footer: custom `actions`, or the standard Cancel /
//      Confirm pair ("Atšaukti" / "Patvirtinti")
//    - confirm AWAITS an async onConfirm before closing
//      (closeOnConfirm), cancel calls onCancel then onClose
//    - loading disables both buttons (spinner on confirm)
//    - Escape and the backdrop close it; the backdrop can be
//      switched off (Escape still works)
//    - variants pick the icon and the confirm color
// -----------------------------------------------------------

import "./support/setup";

import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";

import { deferred } from "./support/backend";
import { renderPage, settle } from "./support/render";

import { UniversalModal } from "@/components/Other/UniversalModal";


const renderModal = (props = {}) => {
  const handlers = { onClose: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn() };
  const result = renderPage(
    <UniversalModal open title="Pavadinimas" {...handlers} {...props}>
      {props.children ?? <p>Turinys</p>}
    </UniversalModal>
  );
  return { ...result, ...handlers, ...props };
};

// The × has no accessible name (only an aria-hidden icon)
const closeButton = () => screen.getByTestId("CloseIcon").closest("button");

const VARIANT_ICONS = ["ErrorOutlineIcon", "WarningAmberIcon", "InfoOutlinedIcon", "CheckCircleOutlineIcon"];







// -----------------------------------------------------------
// Rendering
// -----------------------------------------------------------

describe("UniversalModal — rendering", () => {

  it("renders nothing while closed", () => {
    renderPage(<UniversalModal open={false} title="Pavadinimas"><p>Turinys</p></UniversalModal>);

    expect(screen.queryByText("Pavadinimas")).toBeNull();
    expect(screen.queryByText("Turinys")).toBeNull();
  });


  it("shows the title, the description and the body", () => {
    renderModal({ description: "Aprašymas" });

    expect(screen.getByRole("heading", { name: "Pavadinimas" })).toBeInTheDocument();
    expect(screen.getByText("Aprašymas")).toBeInTheDocument();
    expect(screen.getByText("Turinys")).toBeInTheDocument();
  });


  // MUI's Modal forwards both attributes to its root element
  it("labels the dialog with its title and description", () => {
    renderModal({ description: "Aprašymas" });

    const title = screen.getByRole("heading", { name: "Pavadinimas" });
    expect(title).toHaveAttribute("id", "universal-modal-title");
    expect(screen.getByText("Aprašymas")).toHaveAttribute("id", "universal-modal-description");

    const root = document.querySelector('[aria-labelledby="universal-modal-title"]');
    expect(root).toHaveAttribute("aria-describedby", "universal-modal-description");
    expect(root).toContainElement(title);
  });


  it("shows the standard Atšaukti / Patvirtinti pair by default", () => {
    renderModal();

    expect(screen.getByRole("button", { name: "Atšaukti" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Patvirtinti" })).toBeInTheDocument();
  });


  it("takes custom button texts", () => {
    renderModal({ confirmText: "Įkelti", cancelText: "Uždaryti" });

    expect(screen.getByRole("button", { name: "Įkelti" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uždaryti" })).toBeInTheDocument();
  });


  it("can hide the cancel button", () => {
    renderModal({ showCancel: false });

    expect(screen.queryByRole("button", { name: "Atšaukti" })).toBeNull();
    expect(screen.getByRole("button", { name: "Patvirtinti" })).toBeInTheDocument();
  });


  it("can hide the confirm button", () => {
    renderModal({ showConfirm: false });

    expect(screen.queryByRole("button", { name: "Patvirtinti" })).toBeNull();
    expect(screen.getByRole("button", { name: "Atšaukti" })).toBeInTheDocument();
  });


  // The divider above the footer goes with it
  it("has no footer at all with both standard buttons off and no actions", () => {
    renderModal({ showCancel: false, showConfirm: false });

    expect(screen.getAllByRole("button")).toEqual([closeButton()]);
    expect(screen.queryByRole("separator")).toBeNull();
  });


  // Custom actions win even over showCancel / showConfirm left on
  it("renders custom actions instead of the standard pair", () => {
    renderModal({ actions: <button type="button">Savas veiksmas</button> });

    expect(screen.getByRole("button", { name: "Savas veiksmas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Patvirtinti" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Atšaukti" })).toBeNull();
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });


  it("has a close (×) button unless showCloseButton is off", () => {
    renderModal();

    expect(closeButton()).toBeInTheDocument();
  });


  it("drops the close (×) button with showCloseButton={false}", () => {
    renderModal({ showCloseButton: false });

    expect(screen.queryByTestId("CloseIcon")).toBeNull();
  });
});







// -----------------------------------------------------------
// Confirm and cancel
// -----------------------------------------------------------

describe("UniversalModal — confirm and cancel", () => {

  it("cancel calls onCancel, then onClose", async () => {
    const { user, onCancel, onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "Atšaukti" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCancel.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });


  it("confirm calls onConfirm, then closes", async () => {
    const { user, onConfirm, onClose } = renderModal();

    await user.click(screen.getByRole("button", { name: "Patvirtinti" }));
    await settle();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });


  it("waits for an async onConfirm before closing", async () => {
    const confirming = deferred();
    const onConfirm = vi.fn(() => confirming.promise);
    const { user, onClose } = renderModal({ onConfirm });

    await user.click(screen.getByRole("button", { name: "Patvirtinti" }));
    await settle();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => confirming.resolve());
    await settle();
    expect(onClose).toHaveBeenCalledTimes(1);
  });


  it("closes on confirm even without an onConfirm handler", async () => {
    const { user, onClose } = renderModal({ onConfirm: undefined });

    await user.click(screen.getByRole("button", { name: "Patvirtinti" }));
    await settle();

    expect(onClose).toHaveBeenCalledTimes(1);
  });


  it("stays open after confirming with closeOnConfirm={false}", async () => {
    const { user, onConfirm, onClose } = renderModal({ closeOnConfirm: false });

    await user.click(screen.getByRole("button", { name: "Patvirtinti" }));
    await settle();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });


  it("disables confirm with confirmDisabled", () => {
    renderModal({ confirmDisabled: true });

    expect(screen.getByRole("button", { name: "Patvirtinti" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Atšaukti" })).toBeEnabled();
  });


  it("disables both buttons and spins on confirm while loading", () => {
    renderModal({ loading: true });

    const confirm = screen.getByRole("button", { name: "Patvirtinti" });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("button", { name: "Atšaukti" })).toBeDisabled();
    expect(within(confirm).getByRole("progressbar")).toBeInTheDocument();
  });
});







// -----------------------------------------------------------
// Closing
// -----------------------------------------------------------

describe("UniversalModal — closing", () => {

  it("the close (×) button calls onClose", async () => {
    const { user, onClose, onCancel } = renderModal();

    await user.click(closeButton());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });


  // Escape is dispatched inside the dialog — MUI's Modal listens
  // on its own root, wherever the focus trap put the focus
  it("Escape calls onClose", () => {
    const { onClose } = renderModal();

    fireEvent.keyDown(screen.getByText("Turinys"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });


  it("a backdrop click calls onClose", async () => {
    const { user, onClose } = renderModal();

    await user.click(document.querySelector(".MuiBackdrop-root"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });


  it("ignores backdrop clicks with closeOnBackdropClick={false} — Escape still closes", async () => {
    const { user, onClose } = renderModal({ closeOnBackdropClick: false });

    await user.click(document.querySelector(".MuiBackdrop-root"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByText("Turinys"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });


  it("a click inside the dialog does not close it", async () => {
    const { user, onClose } = renderModal();

    await user.click(screen.getByText("Turinys"));

    expect(onClose).not.toHaveBeenCalled();
  });
});







// -----------------------------------------------------------
// Variants
// -----------------------------------------------------------

describe("UniversalModal — variants", () => {

  it.each([
    ["danger", "ErrorOutlineIcon", "MuiButton-colorError"],
    ["warning", "WarningAmberIcon", "MuiButton-colorWarning"],
    ["info", "InfoOutlinedIcon", "MuiButton-colorInfo"],
    ["success", "CheckCircleOutlineIcon", "MuiButton-colorSuccess"],
  ])("%s shows the %s icon and a %s confirm", (variant, iconTestId, confirmClass) => {
    renderModal({ variant });

    expect(screen.getByTestId(iconTestId)).toBeInTheDocument();
    for (const other of VARIANT_ICONS.filter((icon) => icon !== iconTestId)) {
      expect(screen.queryByTestId(other)).toBeNull();
    }
    expect(screen.getByRole("button", { name: "Patvirtinti" })).toHaveClass(confirmClass);
  });


  it("default has no icon and a primary confirm", () => {
    renderModal();

    for (const icon of VARIANT_ICONS) {
      expect(screen.queryByTestId(icon)).toBeNull();
    }
    expect(screen.getByRole("button", { name: "Patvirtinti" })).toHaveClass("MuiButton-colorPrimary");
  });


  it("an unknown variant falls back to the default", () => {
    renderModal({ variant: "nesamone" });

    for (const icon of VARIANT_ICONS) {
      expect(screen.queryByTestId(icon)).toBeNull();
    }
    expect(screen.getByRole("button", { name: "Patvirtinti" })).toHaveClass("MuiButton-colorPrimary");
  });
});
