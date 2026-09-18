import { defineConfig } from "vitest/config";

/**
 * The tests run on Node, not on a phone.
 *
 * What is covered here is the part of the app that does not need one: the rules
 * a row of a genealogy obeys, the arithmetic of panning and zooming, where a
 * line is drawn, what makes a password worth having, how a date reads. Those
 * modules are pure on purpose — that is what makes them testable at all, and
 * why the interface around them can be reshaped a dozen times without fear.
 *
 * React Native components are deliberately not tested: rendering them needs a
 * simulator or a mountain of mocks, and what would be checked is mostly that
 * React still works.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
