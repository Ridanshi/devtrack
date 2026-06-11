import { describe, it, expect } from "vitest";
import { isValidGitHubUsername, normalizeGitHubUsername } from "../src/lib/validate-github-username";

describe("isValidGitHubUsername", () => {
  // --- valid usernames ---

  it("accepts simple lowercase username", () => {
    expect(isValidGitHubUsername("johndoe")).toBe(true);
  });

  it("accepts username with numbers", () => {
    expect(isValidGitHubUsername("user123")).toBe(true);
  });

  it("accepts username with a single internal hyphen", () => {
    expect(isValidGitHubUsername("john-doe")).toBe(true);
  });

  it("accepts username starting with a digit", () => {
    expect(isValidGitHubUsername("123john")).toBe(true);
  });

  it("accepts username ending with a digit", () => {
    expect(isValidGitHubUsername("john123")).toBe(true);
  });

  it("accepts username with multiple non-consecutive hyphens", () => {
    expect(isValidGitHubUsername("john-doe-smith")).toBe(true);
  });

  it("accepts single-character username (min length)", () => {
    expect(isValidGitHubUsername("a")).toBe(true);
  });

  it("accepts 39-character username (max length)", () => {
    expect(isValidGitHubUsername("a".repeat(39))).toBe(true);
  });

  it("accepts mixed-case username (case-insensitive)", () => {
    expect(isValidGitHubUsername("JohnDoe")).toBe(true);
  });

  it("accepts octocat", () => {
    expect(isValidGitHubUsername("octocat")).toBe(true);
  });

  it("accepts Priyanshu-byte-coder", () => {
    expect(isValidGitHubUsername("Priyanshu-byte-coder")).toBe(true);
  });

  it("accepts user123", () => {
    expect(isValidGitHubUsername("user123")).toBe(true);
  });

  // --- invalid: structural rule violations ---

  it("rejects username starting with a hyphen", () => {
    expect(isValidGitHubUsername("-johndoe")).toBe(false);
  });

  it("rejects username ending with a hyphen", () => {
    expect(isValidGitHubUsername("johndoe-")).toBe(false);
  });

  it("rejects username with consecutive hyphens", () => {
    expect(isValidGitHubUsername("john--doe")).toBe(false);
  });

  it("rejects username with three consecutive hyphens", () => {
    expect(isValidGitHubUsername("user---name")).toBe(false);
  });

  it("rejects username that is exactly a hyphen", () => {
    expect(isValidGitHubUsername("-")).toBe(false);
  });

  it("rejects 40-character username (exceeds max length)", () => {
    expect(isValidGitHubUsername("a".repeat(40))).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidGitHubUsername("")).toBe(false);
  });

  // --- invalid: forbidden characters ---

  it("rejects username with underscore", () => {
    expect(isValidGitHubUsername("john_doe")).toBe(false);
  });

  it("rejects username with space", () => {
    expect(isValidGitHubUsername("john doe")).toBe(false);
  });

  it("rejects username with @ symbol", () => {
    expect(isValidGitHubUsername("@johndoe")).toBe(false);
  });

  it("rejects username with dot", () => {
    expect(isValidGitHubUsername("john.doe")).toBe(false);
  });

  it("rejects username with colon", () => {
    expect(isValidGitHubUsername("user:name")).toBe(false);
  });

  it("rejects username with forward slash", () => {
    expect(isValidGitHubUsername("user/org")).toBe(false);
  });

  it("rejects username with percent sign", () => {
    expect(isValidGitHubUsername("user%20name")).toBe(false);
  });

  it("rejects username with asterisk", () => {
    expect(isValidGitHubUsername("user*")).toBe(false);
  });

  it("rejects username with plus sign", () => {
    expect(isValidGitHubUsername("user+name")).toBe(false);
  });

  // --- invalid: query injection payloads ---

  it("rejects search operator injection: test+repo:abc/xyz", () => {
    expect(isValidGitHubUsername("test+repo:abc/xyz")).toBe(false);
  });

  it("rejects search operator injection: test repo (space)", () => {
    expect(isValidGitHubUsername("test repo")).toBe(false);
  });

  it("rejects search operator injection: repo:owner/name", () => {
    expect(isValidGitHubUsername("repo:owner/name")).toBe(false);
  });

  it("rejects search operator injection: user:name", () => {
    expect(isValidGitHubUsername("user:name")).toBe(false);
  });

  it("rejects search operator injection: user/org", () => {
    expect(isValidGitHubUsername("user/org")).toBe(false);
  });

  it("rejects URL-encoded space: user%20name", () => {
    expect(isValidGitHubUsername("user%20name")).toBe(false);
  });

  it("rejects URL-encoded plus: user%2Brepo%3Aowner%2Frepo", () => {
    expect(isValidGitHubUsername("user%2Brepo%3Aowner%2Frepo")).toBe(false);
  });

  it("rejects org filter injection: user+org:private-org", () => {
    expect(isValidGitHubUsername("user+org:private-org")).toBe(false);
  });

  it("rejects language filter injection: user+language:python", () => {
    expect(isValidGitHubUsername("user+language:python")).toBe(false);
  });

  it("rejects path traversal attempt: ../search/repositories?q=test", () => {
    expect(isValidGitHubUsername("../search/repositories?q=test")).toBe(false);
  });
});

describe("normalizeGitHubUsername", () => {
  // --- valid inputs ---

  it("returns the username unchanged when already trimmed", () => {
    expect(normalizeGitHubUsername("johndoe")).toBe("johndoe");
  });

  it("trims leading and trailing whitespace before validating", () => {
    expect(normalizeGitHubUsername("  johndoe  ")).toBe("johndoe");
  });

  it("trims and returns octocat", () => {
    expect(normalizeGitHubUsername("  octocat  ")).toBe("octocat");
  });

  it("returns Priyanshu-byte-coder unchanged", () => {
    expect(normalizeGitHubUsername("Priyanshu-byte-coder")).toBe("Priyanshu-byte-coder");
  });

  it("returns user123 unchanged", () => {
    expect(normalizeGitHubUsername("user123")).toBe("user123");
  });

  // --- null/undefined/empty inputs ---

  it("returns null for null input", () => {
    expect(normalizeGitHubUsername(null)).toBe(null);
  });

  it("returns null for undefined input", () => {
    expect(normalizeGitHubUsername(undefined)).toBe(null);
  });

  it("returns null for empty string", () => {
    expect(normalizeGitHubUsername("")).toBe(null);
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeGitHubUsername("   ")).toBe(null);
  });

  it("returns null for tab/newline whitespace", () => {
    expect(normalizeGitHubUsername("\t\n")).toBe(null);
  });

  it("returns null for non-string numbers", () => {
    expect(normalizeGitHubUsername(123 as unknown as string)).toBe(null);
  });

  it("returns null for non-string object", () => {
    expect(normalizeGitHubUsername({} as unknown as string)).toBe(null);
  });

  it("returns null for non-string array", () => {
    expect(normalizeGitHubUsername([] as unknown as string)).toBe(null);
  });

  // --- invalid: structural violations ---

  it("returns null for username starting with hyphen", () => {
    expect(normalizeGitHubUsername("-johndoe")).toBe(null);
  });

  it("returns null for username ending with hyphen", () => {
    expect(normalizeGitHubUsername("johndoe-")).toBe(null);
  });

  it("returns null for username with consecutive hyphens", () => {
    expect(normalizeGitHubUsername("user--")).toBe(null);
  });

  it("returns null for username exceeding 39 characters", () => {
    expect(normalizeGitHubUsername("a".repeat(40))).toBe(null);
  });

  // --- invalid: query injection payloads ---

  it("returns null for search operator injection via space", () => {
    expect(normalizeGitHubUsername("test repo")).toBe(null);
  });

  it("returns null for search operator injection: test+repo:abc/xyz", () => {
    expect(normalizeGitHubUsername("test+repo:abc/xyz")).toBe(null);
  });

  it("returns null for repo filter: repo:owner/name", () => {
    expect(normalizeGitHubUsername("repo:owner/name")).toBe(null);
  });

  it("returns null for colon injection: user:name", () => {
    expect(normalizeGitHubUsername("user:name")).toBe(null);
  });

  it("returns null for slash injection: user/org", () => {
    expect(normalizeGitHubUsername("user/org")).toBe(null);
  });

  it("returns null for percent-encoded space: user%20name", () => {
    expect(normalizeGitHubUsername("user%20name")).toBe(null);
  });

  it("returns null for percent-encoded operators: user%2Brepo%3Aowner%2Frepo", () => {
    expect(normalizeGitHubUsername("user%2Brepo%3Aowner%2Frepo")).toBe(null);
  });

  it("returns null for asterisk wildcard injection", () => {
    expect(normalizeGitHubUsername("user*")).toBe(null);
  });

  it("returns null for org filter injection", () => {
    expect(normalizeGitHubUsername("user+org:private-org")).toBe(null);
  });
});
