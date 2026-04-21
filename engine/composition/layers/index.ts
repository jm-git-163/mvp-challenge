/**
 * engine/composition/layers/index.ts
 *
 * Focused Session-2 Candidate E: **Layer Dispatcher**.
 *
 * 모든 레이어 타입 → 렌더 함수 매핑의 단일 지점.
 *   - `utils/videoCompositor.ts` 의 신형 경로는 `dispatchLayer(layer.type)` 만 부른다.
 *   - 신규 렌더러 추가 시 이 파일만 편집하면 되도록 단일 테이블로 정리.
 *   - 미지원 타입은 `null` 반환 → 상위에서 조용히 스킵(CLAUDE §3 "개별 레이어 예외는 격리").
 */
import type { BaseLayer } from '../templates/schema';

import gradient_mesh   from './gradient_mesh';
import animated_grid   from './animated_grid';
import star_field      from './star_field';
import noise_pattern   from './noise_pattern';
import camera_feed     from './camera_feed';
import camera_frame    from './camera_frame';
import counter_hud     from './counter_hud';
import subtitle_track  from './subtitle_track';
// 이후 candidate D 에서 추가 등록:
//   kinetic_text

/** 렌더러 공통 시그니처. 모든 타입 렌더러가 준수. */
export type LayerRenderFn = (
  ctx: CanvasRenderingContext2D,
  layer: BaseLayer,
  timeMs: number,
  state: any,
) => void;

/**
 * 레이어 타입 → 렌더러 레지스트리.
 * 신규 타입 지원은 이 맵에 1줄 추가하는 것으로 끝난다.
 */
export const LAYER_REGISTRY: Record<string, LayerRenderFn> = {
  gradient_mesh,
  animated_grid,
  star_field,
  noise_pattern,
  camera_feed,
  camera_frame,
  counter_hud,
  subtitle_track,
};

/**
 * layer.type → 렌더러 조회. 미지원 타입은 null.
 * 호출자(renderLayeredFrame)는 null 을 받으면 해당 레이어를 건너뛴다.
 */
export function dispatchLayer(type: string): LayerRenderFn | null {
  return LAYER_REGISTRY[type] ?? null;
}

/** 진단용: 현재 지원되는 레이어 타입 문자열 목록. */
export function supportedLayerTypes(): string[] {
  return Object.keys(LAYER_REGISTRY).sort();
}
