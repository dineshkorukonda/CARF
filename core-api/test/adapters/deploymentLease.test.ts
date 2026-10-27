import { expect, it } from "vitest";
import { acquireDeploymentLease } from "../../src/adapters/deploymentLease.js";
import { leasePrisma } from "../helpers/leasePrisma.js";

it("serializes revisions and case variants of one repository and fences an expired holder", async () => {
  const client = leasePrisma();
  const first = (await acquireDeploymentLease(client, "Org", "App"))!;
  expect(await acquireDeploymentLease(client, "org", "app")).toBeNull();
  expect(await acquireDeploymentLease(client, "org", "other")).not.toBeNull();
  client.rows.get("org/app@__deployment__")!.heartbeatAt = new Date(0);
  const successor = (await acquireDeploymentLease(client, "org", "app"))!;
  await expect(first.assertHeld()).rejects.toThrow("ownership was lost");
  await first.release();
  await expect(successor.assertHeld()).resolves.toBeUndefined();
  await successor.release();
  expect(await acquireDeploymentLease(client, "org", "app")).not.toBeNull();
});
