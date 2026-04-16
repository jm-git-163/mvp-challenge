"""
/edit/auto  — 태그 타임라인 기반 자동 편집
입력: 영상 파일 + FrameTag 배열 (JSON)
출력: 편집된 영상 파일
"""
import json
import tempfile
import os
from pathlib import Path
from typing import List

import ffmpeg
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()


def _extract_success_segments(
    tag_timeline: list[dict],
    min_tag: str = "good",
    min_duration_ms: int = 500,
) -> list[tuple[float, float]]:
    """성공(good/perfect) 구간의 (start_sec, end_sec) 리스트를 반환."""
    accepted = {"good", "perfect"}
    segments: list[tuple[float, float]] = []
    seg_start: float | None = None

    for frame in sorted(tag_timeline, key=lambda f: f["timestamp_ms"]):
        ts = frame["timestamp_ms"] / 1000
        tag = frame.get("tag", "fail")

        if tag in accepted:
            if seg_start is None:
                seg_start = ts
        else:
            if seg_start is not None:
                duration_ms = (ts - seg_start) * 1000
                if duration_ms >= min_duration_ms:
                    segments.append((seg_start, ts))
                seg_start = None

    return segments


@router.post("/auto")
async def auto_edit(
    video: UploadFile = File(...),
    tag_timeline: str = Form(...),  # JSON 문자열
):
    try:
        timeline: list[dict] = json.loads(tag_timeline)
    except json.JSONDecodeError:
        raise HTTPException(400, "tag_timeline JSON 파싱 실패")

    segments = _extract_success_segments(timeline)

    if not segments:
        raise HTTPException(422, "성공 구간이 없습니다. 다시 촬영해주세요.")

    with tempfile.TemporaryDirectory() as tmpdir:
        # 1. 원본 영상 저장
        raw_path = Path(tmpdir) / "raw.mp4"
        raw_path.write_bytes(await video.read())

        # 2. 각 구간 클립 추출
        clip_paths: list[str] = []
        for i, (start, end) in enumerate(segments):
            clip_path = str(Path(tmpdir) / f"clip_{i:03d}.mp4")
            (
                ffmpeg
                .input(str(raw_path), ss=start, to=end)
                .output(clip_path, c="copy")
                .overwrite_output()
                .run(quiet=True)
            )
            clip_paths.append(clip_path)

        # 3. concat filter로 합치기 (crossfade 0.3초)
        out_path = Path(tmpdir) / "edited.mp4"
        if len(clip_paths) == 1:
            os.rename(clip_paths[0], str(out_path))
        else:
            # concat demuxer 방식
            list_file = Path(tmpdir) / "list.txt"
            list_file.write_text(
                "\n".join(f"file '{p}'" for p in clip_paths)
            )
            (
                ffmpeg
                .input(str(list_file), format="concat", safe=0)
                .output(str(out_path), c="copy")
                .overwrite_output()
                .run(quiet=True)
            )

        # 4. 결과 반환
        result_path = Path(tempfile.gettempdir()) / "result_edited.mp4"
        out_path.rename(result_path)

    return FileResponse(
        str(result_path),
        media_type="video/mp4",
        filename="edited.mp4",
    )
