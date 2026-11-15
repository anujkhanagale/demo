import { ExtrudeGeometry, Matrix4, Shape, ShapeGeometry } from "three";

export const LID_WIDTH = 3.26;
export const LID_HEIGHT = (LID_WIDTH * 624) / 960;
export const LID_CORNER_RADIUS = 0.14;
export const VINYL_THICKNESS = 0.0005;
export const LID_DEPTH = 0.09;
export const LID_BEVEL_SIZE = 0.025;
export const LID_BEVEL_THICKNESS = 0.025;

export function createRoundedRectangle(width, height, radius) {
  const left = -width / 2;
  const right = width / 2;
  const top = height;
  const bottom = 0;
  const shape = new Shape();
  shape.moveTo(left + radius, bottom);
  shape.lineTo(right - radius, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + radius);
  shape.lineTo(right, top - radius);
  shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(left + radius, top);
  shape.quadraticCurveTo(left, top, left, top - radius);
  shape.lineTo(left, bottom + radius);
  shape.quadraticCurveTo(left, bottom, left + radius, bottom);
  return shape;
}

export function createLidShellGeometry(shape) {
  const geometry = new ExtrudeGeometry(shape, {
    depth: LID_DEPTH,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: LID_BEVEL_SIZE,
    bevelThickness: LID_BEVEL_THICKNESS,
    curveSegments: 8,
  });
  geometry.computeBoundingBox();
  return geometry;
}

export function createOuterLidGeometry(shape, outerSurfaceZ) {
  const geometry = new ShapeGeometry(shape, 8);
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;

  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(
      index,
      (positions.getX(index) + LID_WIDTH / 2) / LID_WIDTH,
      positions.getY(index) / LID_HEIGHT,
    );
  }
  uvs.needsUpdate = true;

  geometry.translate(0, 0, outerSurfaceZ + VINYL_THICKNESS);
  geometry.computeBoundingBox();
  return geometry;
}

export function createInnerDisplayGeometry(innerSurfaceZ) {
  const width = 2.94;
  const height = 1.83;
  const shape = createRoundedRectangle(width, height, 0.09);
  const geometry = new ShapeGeometry(shape, 8);
  geometry.applyMatrix4(new Matrix4().makeRotationY(Math.PI));
  geometry.translate(0, 0.15, innerSurfaceZ - VINYL_THICKNESS);
  geometry.computeBoundingBox();
  return geometry;
}
