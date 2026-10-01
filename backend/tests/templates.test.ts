import { describe, expect, it } from "vitest";
import {
  buildTemplateVars,
  findUnknownPlaceholders,
  renderTemplate,
} from "../src/reminders/templates";

const config = { businessName: "Demo Studio", publicApiUrl: "http://localhost:14000" };
const invoice = {
  client_name: "Ann",
  number: "INV-7",
  amount_cents: 125000,
  currency: "USD",
  due_date: "2026-01-01",
  pay_token: "abc123",
};

describe("templates", () => {
  it("renders all placeholders", () => {
    const vars = buildTemplateVars(invoice, "2026-01-13", config);
    const t =
      "{{client_name}}|{{invoice_number}}|{{amount}}|{{due_date}}|{{days_overdue}}|{{business_name}}|{{pay_link}}";
    expect(renderTemplate(t, vars)).toBe(
      "Ann|INV-7|$1,250.00|2026-01-01|12|Demo Studio|http://localhost:14000/pay/abc123",
    );
  });

  it("allows whitespace inside braces", () => {
    const vars = buildTemplateVars(invoice, "2026-01-02", config);
    expect(renderTemplate("{{ client_name }} {{  days_overdue}} {{amount  }}", vars)).toBe(
      "Ann 1 $1,250.00",
    );
  });

  it("formats money by currency", () => {
    const vars = buildTemplateVars(
      { ...invoice, amount_cents: 30000, currency: "EUR" },
      "2026-01-02",
      config,
    );
    expect(vars.amount).toBe("€300.00");
  });

  it("clamps days_overdue at 0", () => {
    expect(buildTemplateVars(invoice, "2025-12-20", config).days_overdue).toBe("0");
  });

  it("finds unknown placeholders", () => {
    expect(findUnknownPlaceholders("{{client_name}} {{ foo }} {{bar}} {{foo}}")).toEqual([
      "foo",
      "bar",
    ]);
    expect(findUnknownPlaceholders("{{amount}}")).toEqual([]);
  });
});
