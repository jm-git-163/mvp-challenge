"""
/analyze/beats  — BGM BPM 및 비트 타임스탬프 분석
입력: 오디오 파일 (mp3/wav/m4a)
출력: { bpm, beats: [초 단위 타임스탬프] }
"""
from pathlib import Path
import tempfile

import librosa
import numpy as np
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse

router = APIRouter()


@router.post("/beats")
async def analyze_beats(audio: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(suffix=Path(audio.filename or "audio.mp3").suffix, delete=False) as f:
        f.write(await audio.read())
        tmp_path = f.name

    y, sr = librosa.load(tmp_path, mono=True)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

    return JSONResponse({
        "bpm": round(float(tempo), 1),
        "beats": [round(t, 3) for t in beat_times],
    })
