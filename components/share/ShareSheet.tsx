/**
 * components/share/ShareSheet.tsx
 *
 * **Single share modal used across the app** — result page (video share + reply)
 * and home page (invite share) both mount this. No other modal implements
 * share actions.
 *
 * Architecture: docs/SHARE_ARCHITECTURE.md.
 *
 * State machine (stateful per mount):
 *   idle → preparing → ready → sharing → (success | cancelled | failed)
 *
 * iOS Safari rule: the File is prepared in useEffect (async) into a ref.
 * The tap handler itself is synchronous until it calls shareVideo()/shareInvite(),
 * whose navigator.share() call is the first awaitable. This preserves the user
 * activation token on iOS 16+.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import {
  prepareVideoFile, shareVideo, shareInvite, shareReply, sharePlatform,
  type ShareResult, type TargetPlatform,
} from '../../utils/share';

// ─── Payload types ─────────────────────────────────────────────────────

interface VideoPayload {
  mode: 'video';
  source: Blob | string;       // Blob or blob: URL (already composed)
  caption: string;
  templateName: string;
  scoreNum: number;
}

interface InvitePayload {
  mode: 'invite';
  slug: string;
  fromName: string;
  templateName: string;
  thumbnailUrl: string;
  score?: number;
  message?: string;
}

interface ReplyPayload {
  mode: 'reply';
  source: Blob | string | null;    // may be null if composition failed
  caption: string;
  templateName: string;
}

export type SharePayload = VideoPayload | InvitePayload | ReplyPayload;

export interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  payload: SharePayload;
}

type MachineState =
  | { phase: 'idle' }
  | { phase: 'preparing' }
  | { phase: 'ready' }
  | { phase: 'sharing' }
  | { phase: 'success' | 'cancelled' | 'failed'; message: string };

// ─── Component ─────────────────────────────────────────────────────────

export default function ShareSheet({ visible, onClose, payload }: ShareSheetProps) {
  const [machine, setMachine] = useState<MachineState>({ phase: 'idle' });
  const fileRef = useRef<File | null>(null);

  // ── 1) Prepare on mount / payload change. iOS gesture-preservation. ──
  useEffect(() => {
    if (!visible) {
      setMachine({ phase: 'idle' });
      fileRef.current = null;
      return;
    }

    // Invite payload has no file to prep — the PNG card is generated inside
    // shareInvite() itself (cheap, synchronous relative to tap).
    if (payload.mode === 'invite') {
      setMachine({ phase: 'ready' });
      return;
    }

    // video / reply — may need to fetch a blob: URL.
    let cancelled = false;
    setMachine({ phase: 'preparing' });
    (async () => {
      const src = payload.source;
      if (src === null) {                                  // reply with no video
        setMachine({ phase: 'ready' });
        return;
      }
      const file = await prepareVideoFile(src, payload.templateName);
      if (cancelled) return;
      fileRef.current = file;
      setMachine(file ? { phase: 'ready' } : { phase: 'failed', message: '영상 준비에 실패했어요. 다시 시도해주세요.' });
    })();
    return () => { cancelled = true; };
  }, [visible, payload]);

  // ── 2) Primary tap handler — synchronous until Promise from share.ts. ──
  const handlePrimary = useCallback(() => {
    if (machine.phase !== 'ready') return;
    setMachine({ phase: 'sharing' });

    let promise: Promise<ShareResult>;
    if (payload.mode === 'video') {
      const f = fileRef.current;
      if (!f) { setMachine({ phase: 'failed', message: '영상이 준비되지 않았어요.' }); return; }
      promise = shareVideo({ file: f, caption: payload.caption, title: payload.templateName });
    } else if (payload.mode === 'reply') {
      promise = shareReply({ file: fileRef.current, caption: payload.caption, templateName: payload.templateName });
    } else {
      promise = shareInvite({
        slug: payload.slug,
        fromName: payload.fromName,
        templateName: payload.templateName,
        thumbnailUrl: payload.thumbnailUrl,
        score: payload.score,
        message: payload.message,
      });
    }

    promise.then((res) => {
      if (res.kind === 'web-share' || res.kind === 'web-share-text' || res.kind === 'fallback') {
        setMachine({ phase: 'success', message: res.message });
        setTimeout(onClose, 1400);
      } else if (res.kind === 'cancelled') {
        setMachine({ phase: 'cancelled', message: res.message });
      } else {
        setMachine({ phase: 'failed', message: res.message });
      }
    }).catch((e: any) => {
      setMachine({ phase: 'failed', message: `공유 실패: ${e?.message || e?.name || '알 수 없는 오류'}` });
    });
  }, [machine.phase, payload, onClose]);

  // ── 3) Secondary button: "저장만" for video, "링크만 복사" for invite ──
  const handleSecondary = useCallback(async () => {
    if (payload.mode === 'invite') {
      // Force clipboard-only path: reuse shareInvite but treat any kind as success.
      setMachine({ phase: 'sharing' });
      const res = await shareInvite({
        slug: payload.slug, fromName: payload.fromName,
        templateName: payload.templateName, thumbnailUrl: payload.thumbnailUrl,
        score: payload.score, message: payload.message,
      });
      setMachine(
        res.captionCopied
          ? { phase: 'success', message: '✓ 링크가 복사됐어요. 메신저에 붙여넣어주세요.' }
          : { phase: 'failed', message: res.message },
      );
      if (res.captionCopied) setTimeout(onClose, 1600);
      return;
    }
    // video / reply — save only
    const f = fileRef.current;
    if (!f) { setMachine({ phase: 'failed', message: '영상이 준비되지 않았어요.' }); return; }
    try {
      const url = URL.createObjectURL(f);
      const a = document.createElement('a');
      a.href = url; a.download = f.name; document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMachine({ phase: 'success', message: '✓ 영상이 저장됐어요.' });
      setTimeout(onClose, 1400);
    } catch (e: any) {
      setMachine({ phase: 'failed', message: `저장 실패: ${e?.message || '브라우저 권한을 확인해주세요.'}` });
    }
  }, [payload, onClose]);

  // ── 3.5) Platform picker — video mode only ──
  const handlePlatform = useCallback((platform: TargetPlatform) => {
    if (payload.mode !== 'video') return;
    const f = fileRef.current;
    if (!f) { setMachine({ phase: 'failed', message: '영상이 준비되지 않았어요.' }); return; }
    setMachine({ phase: 'sharing' });
    sharePlatform({ file: f, caption: payload.caption, platform })
      .then((res) => {
        if (res.kind === 'fallback' || res.kind === 'web-share' || res.kind === 'web-share-text') {
          setMachine({ phase: 'success', message: res.message });
          setTimeout(onClose, 2400);
        } else {
          setMachine({ phase: 'failed', message: res.message });
        }
      })
      .catch((e: any) => {
        setMachine({ phase: 'failed', message: `${e?.message || '공유 실패'}` });
      });
  }, [payload, onClose]);

  // ── 4) Copy link only (invite-specific) ──
  // Secondary already covers this; we don't add a third button.

  // ── 5) UI copy ──
  const title =
    payload.mode === 'video' ? '영상 공유'
    : payload.mode === 'reply' ? '답장 보내기'
    : '도전장 보내기';
  const subtitle =
    payload.mode === 'video' ? `${payload.templateName} · ${payload.scoreNum}점`
    : payload.mode === 'reply' ? `${payload.templateName}`
    : `${payload.templateName}${typeof payload.score === 'number' ? ` · ${payload.score}점` : ''}`;

  const primaryLabel =
    payload.mode === 'video' ? '영상 저장 후 메신저로 보내기'
    : payload.mode === 'reply' ? '답장 공유하기'
    : '도전장 보내기';
  const secondaryLabel =
    payload.mode === 'invite' ? '링크만 복사하기' : '기기에 저장만 하기';

  // FIX-KAKAO (2026-04-23): 모드별 안내 문구. primary 버튼 위에 한 줄로 표시해
  //   사용자가 어떻게 동작할지 미리 알게 한다.
  // FIX-SHARE-CAMERA-FINAL (2026-04-24): 사용자 혼동 방지를 위해 명확한 안내.
  //   "앱이 자동으로 안 열려요. 영상을 저장한 뒤 카톡/인스타에서 갤러리로 직접 선택"
  //   이라는 사실을 가장 위에 노출.
  const helpText =
    payload.mode === 'invite'
      ? '버튼을 누르면 카카오톡에서 썸네일 카드가 자동으로 떠요'
      : payload.mode === 'video'
        ? '영상이 기기에 먼저 저장돼요. 그 다음 카톡/인스타 등 원하는 앱을 직접 열어 채팅창의 + 버튼 → 갤러리에서 방금 저장된 영상을 선택해 주세요.'
        : null;

  const canTap = machine.phase === 'ready';
  const busy = machine.phase === 'preparing' || machine.phase === 'sharing';

  const statusMessage =
    machine.phase === 'preparing' ? '영상 준비 중…'
    : machine.phase === 'sharing' ? '공유 창 여는 중…'
    : (machine.phase === 'success' || machine.phase === 'cancelled' || machine.phase === 'failed')
      ? machine.message
      : null;

  const statusTone: 'info' | 'success' | 'warn' | 'error' =
    machine.phase === 'success' ? 'success'
    : machine.phase === 'cancelled' ? 'warn'
    : machine.phase === 'failed' ? 'error'
    : 'info';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <View style={st.handle} />

          <Text style={st.title}>{title}</Text>
          <Text style={st.subtitle}>{subtitle}</Text>

          {helpText ? <Text style={st.helpText}>{helpText}</Text> : null}

          <Pressable
            style={[st.primaryBtn, !canTap && st.primaryBtnDisabled]}
            disabled={!canTap}
            onPress={handlePrimary}
          >
            <Text style={st.primaryBtnText}>
              {busy && machine.phase === 'preparing' ? '준비 중…' : primaryLabel}
            </Text>
          </Pressable>

          <Pressable
            style={[st.secondaryBtn, busy && { opacity: 0.55 }]}
            disabled={busy}
            onPress={handleSecondary}
          >
            <Text style={st.secondaryBtnText}>{secondaryLabel}</Text>
          </Pressable>

          {payload.mode === 'video' ? (
            <View style={st.platformSection}>
              <Text style={st.platformHeader}>저장 후 앱에서 첨부</Text>
              <View style={st.platformGrid}>
                {[
                  { key: 'kakao' as const, label: '카카오톡', emoji: '💬', bg: '#FEE500', fg: '#191919' },
                  { key: 'instagram-story' as const, label: '인스타\n스토리', emoji: '📷', bg: '#E1306C', fg: '#fff' },
                  { key: 'instagram-feed' as const, label: '인스타\n피드', emoji: '🖼️', bg: '#833AB4', fg: '#fff' },
                  { key: 'tiktok' as const, label: '틱톡', emoji: '🎵', bg: '#000000', fg: '#fff' },
                  { key: 'youtube' as const, label: '유튜브\n쇼츠', emoji: '▶️', bg: '#FF0000', fg: '#fff' },
                ].map((p) => (
                  <Pressable
                    key={p.key}
                    style={[st.platformBtn, { backgroundColor: p.bg }, busy && { opacity: 0.45 }]}
                    disabled={busy || !canTap}
                    onPress={() => handlePlatform(p.key)}
                  >
                    <Text style={st.platformEmoji}>{p.emoji}</Text>
                    <Text style={[st.platformLabel, { color: p.fg }]}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={st.platformHint}>
                각 버튼을 누르면 영상이 기기에 저장돼요.{'\n'}
                해당 앱을 직접 열어 채팅창 또는 업로드 화면의 + 버튼 → 갤러리에서{'\n'}
                방금 저장된 영상을 선택해 주세요. (앱 자동 실행은 보안상 차단돼 있어요)
              </Text>
            </View>
          ) : null}

          {statusMessage ? (
            <View style={[st.statusPill, st[`status_${statusTone}` as const]]}>
              {busy ? <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} /> : null}
              <Text style={st.statusText}>{statusMessage}</Text>
            </View>
          ) : null}

          <Pressable style={st.cancelBtn} onPress={onClose}>
            <Text style={st.cancelText}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────

const SAN = Platform.select({
  web: '"Pretendard Variable",Pretendard,"Inter","SF Pro Text","Segoe UI",system-ui,-apple-system,sans-serif',
  default: 'System',
}) as string;

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40,
    gap: 10,
    maxWidth: 520, width: '100%', alignSelf: 'center',
    // @ts-ignore web
    boxShadow: '0 -14px 36px -14px rgba(10,10,10,0.22)',
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    backgroundColor: '#D4D4D8',
    borderRadius: 2,
    marginBottom: 10,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#0A0A0A', fontFamily: SAN, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: '#71717A', marginBottom: 8, fontFamily: SAN },
  helpText: {
    fontSize: 12,
    color: '#52525B',
    backgroundColor: '#F4F4F5',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 4,
    fontFamily: SAN,
    lineHeight: 17,
  },

  primaryBtn: {
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 18,
    alignItems: 'center',
    // @ts-ignore web
    cursor: 'pointer',
    // @ts-ignore web
    transition: 'opacity 160ms ease, background-color 160ms ease',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', fontFamily: SAN, letterSpacing: -0.1 },

  secondaryBtn: {
    backgroundColor: '#F4F4F5',
    borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E5E5',
  },
  secondaryBtnText: { color: '#0A0A0A', fontSize: 14, fontWeight: '600', fontFamily: SAN },

  statusPill: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10,
  },
  status_info:    { backgroundColor: '#3F3F46' },
  status_success: { backgroundColor: '#166534' },
  status_warn:    { backgroundColor: '#854D0E' },
  status_error:   { backgroundColor: '#991B1B' },
  statusText: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: SAN, textAlign: 'center' },

  cancelBtn: { marginTop: 4, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#71717A', fontSize: 14, fontFamily: SAN },

  platformSection: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    gap: 8,
  },
  platformHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#52525B',
    fontFamily: SAN,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  platformBtn: {
    flexBasis: '18%',
    flexGrow: 1,
    minWidth: 64,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    // @ts-ignore web
    cursor: 'pointer',
  },
  platformEmoji: { fontSize: 20, lineHeight: 22 },
  platformLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: SAN,
    textAlign: 'center',
    lineHeight: 13,
  },
  platformHint: {
    fontSize: 11,
    color: '#71717A',
    fontFamily: SAN,
    lineHeight: 15,
    marginTop: 2,
  },
});
