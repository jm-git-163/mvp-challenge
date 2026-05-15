/**
 * engine/composition/layers/backgroundMatte.ts
 *
 * FIX-Z25 (2026-04-22) PLACEHOLDER — 사용자 뒤 배경 합성 (segmentation).
 *
 * ────────────────────────────────────────────────────────────────────────
 * TODO (향후 라운드):
 *  1. MediaPipe `@mediapipe/tasks-vision` ImageSegmenter (SelfieSegmentation 모델)
 *     을 도입해 카메라 프레임마다 사람/배경 마스크를 산출.
 *  2. 이 레이어는 props.bgAsset (이미지/동영상) 을 받아, 마스크의 "배경" 픽셀
 *     위치에만 그 에셋을 그린다. 사람 픽셀은 알파 0 유지하여 카메라 피드가
 *     그대로 보이게 한다.
 *  3. 성능 부담: SelfieSegmentation 모델만 별도 worker 로 돌리고, 마스크는
 *     저해상도 (256x256) 로 처리 후 upscale. docs/PERFORMANCE.md §5 참조.
 *  4. zIndex 는 camera_feed(20) 직후, camera_frame(21) 직전에 들어가야
 *     카메라 영상과 합성된다. 즉 zIndex = 20.5 → `reactiveBinding.ts` 에서
 *     특수 오더링 훅이 필요할 수 있음.
 *
 * 현재 상태:
 *   - 렌더러는 no-op. 레지스트리에 등록되지 않았으므로 템플릿에서
 *     `type: 'background_matte'` 로 참조해도 무시된다.
 *   - 단기적으로는 cameraFraming (hexagon/heart/rounded_rect 등) 의
 *     "창의적 프레이밍" 이 배경 차별화 역할을 대신한다.
 *
 * 사용자 피드백 맥락: "사용자 뒤 배경도 챌린지 주제에 맞춰 바꾸는 것도
 * 좋겠다." → 현재는 레이어드 배경(skyline/studio/star_field) 으로 간접 구현,
 * 이 파일은 진짜 segmentation 합성이 필요할 때 채운다.
 */
import type { BaseLayer } from '../../templates/schema';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function render(
  _ctx: CanvasRenderingContext2D,
  _layer: BaseLayer,
  _timeMs: number,
  _state: any,
): void {
  // Intentionally no-op until MediaPipe SelfieSegmentation is wired.
  // See TODO above.
}
