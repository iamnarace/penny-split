import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { sampleBill } from "./lib/sample";
import { encodeBill } from "./lib/share";

function totalFor(name: string) {
  const list = screen.getByRole("list", { name: "What each person owes" });
  const row = within(list).getByText(name).closest("summary");
  return row?.querySelector(".amount")?.textContent;
}

describe("App", () => {
  it("starts empty and invites you to add people", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Split the bill to the cent." })).toBeInTheDocument();
    expect(screen.getByText("Add the people at the table to see who owes what.")).toBeInTheDocument();
  });

  it("splits a small bill end to end", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Add a person"), "Ana, Ben{Enter}");
    expect(screen.getByLabelText("Name for Ana")).toBeInTheDocument();
    expect(screen.getByLabelText("Name for Ben")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.type(screen.getByLabelText("Item 1 name"), "Pizza");
    await user.type(screen.getByLabelText("Price"), "30");
    // Shared by everyone by default.
    expect(totalFor("Ana")).toMatch(/15\.00/);
    expect(totalFor("Ben")).toMatch(/15\.00/);

    // Only Ana had it.
    await user.click(within(screen.getByRole("group", { name: "Who had Pizza" })).getByRole("button", { name: "Ana" }));
    expect(totalFor("Ana")).toMatch(/30\.00/);
    expect(totalFor("Ben")).toMatch(/0\.00/);

    // Add a 10% tip, shared by what each ordered.
    await user.click(screen.getByRole("button", { name: "+ Tip" }));
    expect(totalFor("Ana")).toMatch(/33\.00/);
  });

  it("supports uneven portions", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Add a person"), "Ana, Ben{Enter}");
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.type(screen.getByLabelText("Item 1 name"), "Cake");
    await user.type(screen.getByLabelText("Price"), "12");
    const group = screen.getByRole("group", { name: "Who had Cake" });
    await user.click(within(group).getByRole("button", { name: "Ana" }));
    await user.click(within(group).getByRole("button", { name: "Ben" }));
    await user.click(within(group).getByRole("button", { name: "More portions for Ana" }));
    expect(totalFor("Ana")).toMatch(/8\.00/);
    expect(totalFor("Ben")).toMatch(/4\.00/);
  });

  it("shows an error for an unreadable price and keeps the last good value", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Add a person"), "Ana{Enter}");
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.type(screen.getByLabelText("Price"), "12.345");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an amount like 12.50");
    expect(screen.getByLabelText("Price")).toHaveAttribute("aria-invalid", "true");
  });

  it("loads the example and checks it against the receipt", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Try an example bill" }));
    expect(screen.getByLabelText("Bill name")).toHaveValue("Friday dinner at Lucia's");
    await user.type(screen.getByLabelText("Total printed on the receipt"), "174.49");
    expect(screen.getByText("Matches the receipt to the cent.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Total printed on the receipt"));
    await user.type(screen.getByLabelText("Total printed on the receipt"), "170");
    expect(screen.getByText(/more than the receipt/)).toBeInTheDocument();
  });

  it("settles up with the payer", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Try an example bill" }));
    const debts = screen.getByRole("list", { name: "Who owes the payer" });
    expect(within(debts).getAllByRole("listitem")).toHaveLength(3);
    await user.selectOptions(screen.getByLabelText("Who paid?"), "Nobody yet");
    expect(screen.queryByRole("list", { name: "Who owes the payer" })).not.toBeInTheDocument();
  });

  it("undoes removing a person", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Try an example bill" }));
    await user.click(screen.getByRole("button", { name: "Remove Ben" }));
    expect(screen.queryByLabelText("Name for Ben")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByLabelText("Name for Ben")).toBeInTheDocument();
  });

  it("opens a shared link and tidies the address bar", () => {
    window.history.replaceState(null, "", `/#b=${encodeBill(sampleBill("AUD"))}`);
    render(<App />);
    expect(screen.getByLabelText("Bill name")).toHaveValue("Friday dinner at Lucia's");
    expect(screen.getByText(/Opened a shared bill/)).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });

  it("explains a broken shared link", () => {
    window.history.replaceState(null, "", "/#b=1.broken!!");
    render(<App />);
    expect(screen.getByText(/looks incomplete/)).toBeInTheDocument();
  });

  it("remembers the bill on this device", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.type(screen.getByLabelText("Bill name"), "Brunch");
    unmount();
    render(<App />);
    expect(screen.getByLabelText("Bill name")).toHaveValue("Brunch");
  });

  it("converts amounts when switching to a currency without cents", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Try an example bill" }));
    await user.selectOptions(screen.getByLabelText("Currency"), "JPY");
    // 24.00 becomes 24 when the currency has no minor units.
    expect(screen.getByLabelText("Line total for Margherita pizza")).toHaveTextContent("24");
  });
});
