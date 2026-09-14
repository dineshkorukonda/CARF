import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("CARF Minimal Showcase SPA", () => {
  it("renders CARF brand and headline", () => {
    render(<App />);
    expect(screen.getAllByText(/CARF/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Dynamic, risk-calibrated error tolerances/i)).toBeInTheDocument();
  });

  it("contains direct links to authentication and dashboard", () => {
    render(<App />);
    
    // Check Sign In link
    const signInLinks = screen.getAllByRole("link", { name: /sign in/i });
    expect(signInLinks.some(link => link.getAttribute("href") === "https://dashboard.carf.indevs.in/login")).toBe(true);

    // Check Sign Up / Get Started link
    const signUpLinks = screen.getAllByRole("link", { name: /get started|create account/i });
    expect(signUpLinks.some(link => link.getAttribute("href") === "https://dashboard.carf.indevs.in/signup")).toBe(true);

    // Check Dashboard link
    const dashboardLinks = screen.getAllByRole("link", { name: /open dashboard|dashboard/i });
    expect(dashboardLinks.some(link => link.getAttribute("href") === "https://dashboard.carf.indevs.in/dashboard")).toBe(true);
  });

  it("strictly omits paper and repository links", () => {
    render(<App />);
    const allLinks = screen.getAllByRole("link");
    for (const link of allLinks) {
      const href = link.getAttribute("href") || "";
      expect(href).not.toContain("github.com");
      expect(href).not.toContain("drive.google.com");
      expect(href).not.toContain("/paper");
    }
  });

  it("renders the 3 architectural pillars", () => {
    render(<App />);
    expect(screen.getByText(/Tier 1 Path Rules/i)).toBeInTheDocument();
    expect(screen.getByText(/Tier 2 Tree-Sitter AST/i)).toBeInTheDocument();
    expect(screen.getByText(/Real-Time Canary Tuning/i)).toBeInTheDocument();
  });

  it("renders the interactive calibration playground and scenario presets", () => {
    render(<App />);
    expect(screen.getByText(/Interactive Calibration Playground/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulate Tree-Sitter AST & Dynamic Canary Thresholds/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Test Suite Addition/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Core Algorithmic Refactor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Database Schema Migration/i })).toBeInTheDocument();
    expect(screen.getByText(/A\/B Rollback Decision Comparison/i)).toBeInTheDocument();
  });
});

