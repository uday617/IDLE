import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectService } from "../../src/project/ProjectService.js";

describe("ProjectService", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  it("opens an existing directory and returns a project", async () => {
    const root = await mkdtemp(join(tmpdir(), "idle-project-"));
    temporaryPaths.push(root);
    await mkdir(join(root, "src"));

    const service = new ProjectService();
    const project = await service.open(root);

    expect(project.id).toEqual(expect.any(String));
    expect(project.path).toBe(root);
    expect(await service.get(project.id)).toEqual(project);
  });

  it("rejects a file path", async () => {
    const root = await mkdtemp(join(tmpdir(), "idle-project-"));
    temporaryPaths.push(root);
    const filePath = join(root, "README.md");
    await writeFile(filePath, "test");

    const service = new ProjectService();

    await expect(service.open(filePath)).rejects.toThrow("not a directory");
  });

  it("closes an opened project", async () => {
    const root = await mkdtemp(join(tmpdir(), "idle-project-"));
    temporaryPaths.push(root);

    const service = new ProjectService();
    const project = await service.open(root);

    await service.close(project.id);

    expect(await service.get(project.id)).toBeNull();
  });
});
