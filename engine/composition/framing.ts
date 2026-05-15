/**
 * engine/composition/framing.ts
 *
 * Phase 5a — **카메라 프레이밍**. docs/COMPOSITION.md §8.
 *
 * 카메라를 풀스크린이 아닌 창의적 형태로 클리핑한다. 6종 기본 + 이미지/마스크.
 * 각 프레이밍은 canvas 2D path 커맨드로 환원되어 `ctx.clip()` + `ctx.drawImage()` 파이프라인에 주입.
 *
 * 설계:
 *   - 프레이밍 사양(zCameraFraming)은 런타임 데이터.
 *   - `buildFramingPath(fr, pb, canvasW, canvasH)`가 PathBuilder에 path 명령을 발행.
 *   - PathBuilder는 `CanvasRenderingContext2D`와 인터페이스 호환 → 실 canvas에도, 테스트용 스텁에도 동작.
 *
 * 이 모듈은 **순수 기하**만 다룬다. 렌더 주체는 Phase 5b LayerEngine.
 */

import type { CameraFraming } from '../templates/schema';

/** Canvas 2D path 호환 최소 인터페이스. `CanvasRenderingContext2D`가 이 모두를 만족. */
export interface PathBuilder {
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, s: number, e: number, ccw?: boolean): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number): void;
}

/** 프레이밍의 AABB(축정렬 경계 사각형). 글로우/섀도우 레이어가 참조. */
export interface FramingBox { x: number; y: number; w: number; h: number; }

/**
 * 프레이밍에 따라 path를 PathBuilder에 기록. 클리핑 경계가 된다.
 * 호출자는 이후 `ctx.clip()` 후 카메라 영상을 그린다.
 */
export function buildFramingPath(
  framing: CameraFraming,
  pb: PathBuilder,
  canvasW: number,
  canvasH: number,
): void {
  pb.beginPath();
  switch (framing.kind) {
    case 'fullscreen':
      pb.rect(0, 0, canvasW, canvasH);
      break;
    case 'portrait_split':
      // 카메라 영역은 전체 프레임 (하체까지 담기도록). 상/하 시각 분할은 별도 레이어.
      pb.rect(0, 0, canvasW, canvasH);
      break;
    case 'circle':
      pb.arc(framing.centerX, framing.centerY, framing.radius, 0, Math.PI * 2);
      break;
    case 'rounded_rect': {
      const { x, y, w, h, radius } = framing;
      const r = Math.min(radius, w / 2, h / 2);
      pb.moveTo(x + r, y);
      pb.lineTo(x + w - r, y);
      pb.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
      pb.lineTo(x + w, y + h - r);
      pb.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
      pb.lineTo(x + r, y + h);
      pb.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
      pb.lineTo(x, y + r);
      pb.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
      break;
    }
    case 'hexagon': {
      const { centerX, centerY, size } = framing;
      // 꼭지점이 위아래 있는 포인티톱 육각형 (아레나 느낌)
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 3;
        const x = centerX + size * Math.cos(angle);
        const y = centerY + size * Math.sin(angle);
        if (i === 0) pb.moveTo(x, y); else pb.lineTo(x, y);
      }
      break;
    }
    case 'heart': {
      const { centerX, centerY, size } = framing;
      // 파라메트릭 하트 (t=0..2π). Canvas path 근사는 베지어로.
      // 단순화: 두 개의 반원 + 아래쪽 V.
      const r = size / 2;
      // 왼쪽 반원 (위쪽 왼쪽 둔덕)
      pb.moveTo(centerX, centerY + size * 0.25);
      pb.bezierCurveTo(
        centerX - r * 1.2, centerY - r * 0.6,
        centerX - r * 1.2, centerY - r * 1.3,
        centerX,           centerY - r * 0.3,
      );
      // 오른쪽 반원
      pb.bezierCurveTo(
        centerX + r * 1.2, centerY - r * 1.3,
        centerX + r * 1.2, centerY - r * 0.6,
        centerX,           centerY + size * 0.25,
      );
      break;
    }
    case 'tv_frame':
      // TV 프레임은 외곽 이미지이며 클리핑 경계는 안쪽 사각형. 이미지 자체는 별도 레이어.
      // 기본 inset 10%로 근사.
      pb.rect(canvasW * 0.05, canvasH * 0.08, canvasW * 0.9, canvasH * 0.84);
      break;
    case 'custom_mask':
      // SVG path 파싱은 Phase 5b에서. 여기선 안전하게 fullscreen 폴백.
      pb.rect(0, 0, canvasW, canvasH);
      break;
  }
  pb.closePath();
}

/** 프레이밍 AABB를 계산. 글로우/섀도우/hit-test용. */
export function framingBox(
  framing: CameraFraming,
  canvasW: number,
  canvasH: number,
): FramingBox {
  switch (framing.kind) {
    case 'fullscreen':
      return { x: 0, y: 0, w: canvasW, h: canvasH };
    case 'portrait_split':
      return { x: 0, y: 0, w: canvasW, h: canvasH };
    case 'circle':
      return {
        x: framing.centerX - framing.radius,
        y: framing.centerY - framing.radius,
        w: framing.radius * 2,
        h: framing.radius * 2,
      };
    case 'rounded_rect':
      return { x: framing.x, y: framing.y, w: framing.w, h: framing.h };
    case 'hexagon': {
      // 포인티톱: 높이 = 2*size, 너비 = size*√3
      const w = framing.size * Math.sqrt(3);
      const h = framing.size * 2;
      return { x: framing.centerX - w / 2, y: framing.centerY - h / 2, w, h };
    }
    case 'heart': {
      const { centerX, centerY, size } = framing;
      const r = size / 2;
      // 근사 AABB
      return {
        x: centerX - r * 1.2,
        y: centerY - r * 1.3,
        w: r * 2.4,
        h: size * 1.55,
      };
    }
    case 'tv_frame':
      return { x: canvasW * 0.05, y: canvasH * 0.08, w: canvasW * 0.9, h: canvasH * 0.84 };
    case 'custom_mask':
      return { x: 0, y: 0, w: canvasW, h: canvasH };
  }
}

/**
 * 점(px)이 프레이밍 영역 내부인지. 클릭/터치 라우팅용.
 * 단순한 AABB + 원 정확 판정. 육각/하트는 AABB로 근사.
 */
export function isPointInsideFraming(
  framing: CameraFraming,
  px: number,
  py: number,
  canvasW: number,
  canvasH: number,
): boolean {
  if (framing.kind === 'circle') {
    const dx = px - framing.centerX;
    const dy = py - framing.centerY;
    return dx * dx + dy * dy <= framing.radius * framing.radius;
  }
  const b = framingBox(framing, canvasW, canvasH);
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

/**
 * 카메라 원본(srcW × srcH, 보통 720×1280)을 프레이밍 AABB에 **cover** 전략으로 맞춘 draw 파라미터.
 * `ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh)` 에 그대로 전달.
 */
export function computeCoverDrawArgs(
  srcW: number,
  srcH: number,
  box: FramingBox,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const srcAspect = srcW / srcH;
  const dstAspect = box.w / box.h;
  let sx: number, sy: number, sw: number, sh: number;
  if (srcAspect > dstAspect) {
    // src가 더 넓음 → 좌우 크롭
    sh = srcH;
    sw = srcH * dstAspect;
    sx = (srcW - sw) / 2;
    sy = 0;
  } else {
    // src가 더 좁음 → 상하 크롭
    sw = srcW;
    sh = srcW / dstAspect;
    sx = 0;
    sy = (srcH - sh) / 2;
  }
  return { sx, sy, sw, sh, dx: box.x, dy: box.y, dw: box.w, dh: box.h };
}
