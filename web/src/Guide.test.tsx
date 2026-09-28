import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Guide from "./Guide";
import Root from "./Root";

describe("usage guide page", () => {
  it("documents a normal GitHub project before any adapter", () => {
    render(<Guide />);
    expect(screen.getByRole("heading", { name: /How to use CARF with your stack/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Any GitHub project/i })).toBeInTheDocument();
    expect(screen.getByText(/Create a CARF account/i)).toBeInTheDocument();
    expect(screen.getByText(/Install the GitHub App/i)).toBeInTheDocument();
    expect(screen.getByText(/Link a project/i)).toBeInTheDocument();
  });

  it("renders a section for every current integration", () => {
    render(<Guide />);
    expect(screen.getByRole("heading", { name: /PM2 \(Node\.js \/ VPS\)/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Render & Railway/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Kubernetes & Argo Rollouts/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Prometheus & observability/i })).toBeInTheDocument();
  });

  it("shows standalone PM2 yaml with adapter kind", () => {
    render(<Guide />);
    const blocks = screen.getAllByText(/kind:\s*pm2/);
    expect(blocks.length).toBeGreaterThan(0);
  });
});

describe("hash routing to the guide", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("shows the guide when the hash is #guide", () => {
    window.location.hash = "#guide";
    render(<Root />);
    expect(screen.getByRole("heading", { name: /How to use CARF with your stack/i })).toBeInTheDocument();
  });

  it("keeps the landing page when the hash is empty", () => {
    window.location.hash = "";
    render(<Root />);
    expect(screen.getByText(/Dynamic, risk-calibrated error tolerances/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /How to use CARF with your stack/i })).not.toBeInTheDocument();
  });
});
