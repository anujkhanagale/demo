import assert from "node:assert/strict";
import { after, test } from "node:test";
import { FrontSide, Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import {
  createInnerDisplayGeometry,
  createLidShellGeometry,
  createOuterLidGeometry,
  createRoundedRectangle,
  LID_CORNER_RADIUS,
  LID_HEIGHT,
  LID_WIDTH,
  VINYL_THICKNESS,
} from "../src/laptopGeometry.js";

const shape = createRoundedRectangle(LID_WIDTH, LID_HEIGHT, LID_CORNER_RADIUS);
const shell = createLidShellGeometry(shape);
const outerCover = createOuterLidGeometry(shape, shell.boundingBox.max.z);
const display = createInnerDisplayGeometry(shell.boundingBox.min.z);

after(() => {
  shell.dispose();
  outerCover.dispose();
  display.dispose();
});

test("vinyl and display occupy opposite faces of the same lid shell", () => {
  assert.notStrictEqual(outerCover, display);
  assert.ok(
    outerCover.boundingBox.min.z > display.boundingBox.max.z,
    "the vinyl must be on the exterior side, separated from the display",
  );
  assert.ok(
    Math.abs(outerCover.boundingBox.min.z - shell.boundingBox.max.z - VINYL_THICKNESS) < 1e-6,
    "the vinyl should sit just outside the exterior lid face",
  );
  assert.ok(
    Math.abs(shell.boundingBox.min.z - display.boundingBox.max.z - VINYL_THICKNESS) < 1e-6,
    "the display should sit just outside the opposite, user-facing lid face",
  );

  const outerNormals = outerCover.attributes.normal;
  for (let index = 0; index < outerNormals.count; index += 1) {
    assert.ok(outerNormals.getZ(index) > 0.999);
  }

  const displayNormals = display.attributes.normal;
  for (let index = 0; index < displayNormals.count; index += 1) {
    assert.ok(displayNormals.getZ(index) < -0.999);
  }
});

test("red/blue debug faces point toward the back-cover and display cameras", () => {
  const assembly = new Group();
  assembly.rotation.x = Math.PI / 2 + 0.23;
  const outerDebugMesh = new Mesh(
    outerCover,
    new MeshBasicMaterial({ color: "red", side: FrontSide }),
  );
  const screenDebugMesh = new Mesh(
    display,
    new MeshBasicMaterial({ color: "blue", side: FrontSide }),
  );
  assembly.add(outerDebugMesh, screenDebugMesh);
  assembly.updateMatrixWorld(true);

  const outerNormal = new Vector3(0, 0, 1).transformDirection(
    outerDebugMesh.matrixWorld,
  );
  const screenNormal = new Vector3(0, 0, -1).transformDirection(
    screenDebugMesh.matrixWorld,
  );

  assert.equal(outerDebugMesh.material.color.getHexString(), "ff0000");
  assert.equal(screenDebugMesh.material.color.getHexString(), "0000ff");
  assert.ok(outerNormal.y < -0.9, "red exterior faces the back-cover camera");
  assert.ok(screenNormal.y > 0.9, "blue screen faces the front-display camera");
  outerDebugMesh.material.dispose();
  screenDebugMesh.material.dispose();
});

test("outer vinyl UVs cover the rounded lid in the artwork's native aspect ratio", () => {
  const uvs = outerCover.attributes.uv;
  for (let index = 0; index < uvs.count; index += 1) {
    assert.ok(uvs.getX(index) >= 0 && uvs.getX(index) <= 1);
    assert.ok(uvs.getY(index) >= 0 && uvs.getY(index) <= 1);
  }
  assert.ok(Math.abs(LID_WIDTH / LID_HEIGHT - 960 / 624) < 1e-12);
});
