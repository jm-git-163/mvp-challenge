# SHARE_ARCHITECTURE.md

**Ground-up redesign of MotiQ SNS share + invite flow (2026-04-23).**
Replaces the 8-wave incremental patches on `utils/shareVideo.ts` + inline
handlers in `app/result/index.tsx` + `app/(main)/home/index.tsx`.

This document is the single source of truth. If code disagrees with this
doc, the code is wrong.

---

## 1. Goals

1. **One button → one share sheet** — the user never has to pick a platform
   twice. OS share sheet is preferred; platform-specific deep links are a
   graceful degradation, not a menu.
2. **Failure is always visible** — every `shareVideo()` / `shareInvite()`
   call resolves a `ShareResult` with a Korean message. UI ALWAYS shows a
   toast. No silent drops, no black-boxed Promise chains.
3. **100 % client-side** — no uploads, no analytics (CLAUDE.md §12).
4. **iOS Safari user-gesture preserved** — the `File` object is prepared on
   mount into a `ref`; the tap handler is fully synchronous up to and
   including `navigator.share(...)`.
5. **One source of truth** — `utils/share.ts`. All call sites import from it.
   No inline `navigator.share` calls anywhere else.

---

## 2. Public API (`utils/share.ts`)

```ts
shareVideo(opts: {
  file: File;              // prepared mp4/webm File
  caption: string;         // hashtagged caption
  title?: string;
}): Promise<ShareResult>

shareInvite(opts: {
  slug: string;            // official challenge slug
  fromName: string;        // sender display name
  templateName: string;
  score?: number;          // omitted on home invite
  thumbnailUrl: string;    // high-res thumb for PNG card
}): Promise<ShareResult>

// Helper — prepares a File up-front so the tap handler stays synchronous.
prepareVideoFile(source: Blob | string, name: string): Promise<File | null>
```

`ShareResult` shape:
```ts
{ kind: 'web-share' | 'fallback' | 'cancelled' | 'unsupported' | 'error';
  message: string;         // Korean, toast-ready
  downloaded?: boolean;
  captionCopied?: boolean;
  error?: unknown; }
```

---

## 3. Environment detection

A `detectEnvironment()` helper classifies the runtime **once**:

| Flag                 | Meaning                                                       |
|----------------------|---------------------------------------------------------------|
| `inAppBrowser`       | KakaoTalk / Instagram / Facebook / Line in-app browser        |
| `canShareFiles`      | `navigator.canShare({files:[f]})` returns true                |
| `canShareText`       | `navigator.share` exists (text-only)                          |
| `ios` / `android`    | UA sniff                                                       |
| `hasClipboard`       | `navigator.clipboard.writeText` exists                        |

In-app browsers are treated as **Web-Share broken** even if the API exists
— Kakao intercepts the intent and silently aborts. Observed in field.

---

## 4. Fallback matrix

### 4.1 `shareVideo(file)`

| Env                                   | Path                                                                  |
|---------------------------------------|-----------------------------------------------------------------------|
| Normal mobile browser, canShare files | `navigator.share({files})` → done. Abort = `cancelled`.               |
| iOS Safari + webm file                | Skip Web Share (Safari rejects webm). Fall to B.                      |
| Desktop / no file share               | **B:** save file + copy caption → toast "저장·복사됨".                 |
| Kakao / IG / FB in-app                | **B**, plus try `navigator.share({text})` after DL (often works).     |
| No clipboard + no Web Share           | **B** minus clipboard → toast explains WHY + offers manual copy.      |

**Path B** = download + clipboard copy + (optional) `text-only` share.

### 4.2 `shareInvite({slug, fromName, ...})`

| Env                                   | Path                                                                   |
|---------------------------------------|------------------------------------------------------------------------|
| canShareFiles (PNG card)              | Generate PNG via `inviteShareCard.ts` → `share({files:[png], text})`.  |
| canShareText only                     | `share({text: caption, url})` — text has URL inline, no card.           |
| In-app Kakao                          | Copy caption+URL to clipboard → toast "복사됨, 채팅에 붙여넣기".        |
| No Web Share at all                   | Clipboard + `sms:?body=...` deep link fallback.                         |

The PNG card ALWAYS burns the short URL into pixels (`buildDisplayUrl`) so
messengers that drop metadata still let the receiver type it.

---

## 5. UI layer

Single component: `components/share/ShareSheet.tsx`.

- Props: `{ mode: 'video' | 'invite', payload, visible, onClose }`.
- Internal state machine: `idle → preparing → sharing → success|failed|cancelled`.
- Each state has a visible UI cue — chrome-coloured pill at the bottom of
  the sheet. No invisible states.
- Actions are surfaced as **one primary button** + one secondary "저장만"
  button. No 9-option grid; that was the old design's failure.

`useEffect` on mount prepares the `File` (for video) or preloads the thumb
(for invite card). This runs BEFORE the user taps, so the tap handler is
synchronous up to `navigator.share`.

---

## 6. Invite link lifecycle

1. **Send** — `buildInviteUrl(slug, fromName, {score?})` → v2 compact
   `/challenge/<slug>?c=<base64url(f,m?,s?)>`. (`utils/inviteLinks.ts` — unchanged, works.)
2. **Transport** — via Kakao/IG/SMS. The shared payload includes:
   - PNG card (pixel-burned URL as safety net)
   - caption with `url` inline
   - `navigator.share({url})` field (dropped by some messengers)
3. **Receive** — `app/challenge/[slug]/index.tsx` reads
   `window.location.href` (1st choice), falls back to expo-router params.
   `parseInviteUrl` extracts context; `setInviteContext` stores it.
4. **Accept** — permission pre-flight → `startSession(template)` →
   `/record`. `inviteContext` survives record→result via `inviteStore`.
5. **Reply** — result page's "답장 보내기" calls `shareVideo()` with
   reply caption `@fromName 나도 했어! 점수: 87점 url`.

---

## 7. Logging

All share-path events log `console.info('[share] <event>', payload)` with
a correlation id (timestamp). Users reporting bugs can copy the console
and we can reconstruct the failure path.

Events: `prepare.start`, `prepare.ok`, `prepare.fail`, `attempt.websrc`,
`attempt.fallback`, `result.<kind>`.

---

## 8. What's deleted

- `ShareModal` inline component in `app/result/index.tsx` (~220 lines).
- `handleInvite` inline in `app/(main)/home/index.tsx` (~90 lines).
- `handleSendInvite`, `handleReplyBack` inline in result (~170 lines).
- The 9-option grid in the old ShareModal (TikTok/Twitter/Threads/etc. are
  now represented by the OS share sheet, not separate buttons).

`utils/shareVideo.ts` and `utils/shareHelpers.ts` are kept as **internal
primitives** — `share.ts` imports from them. External call sites use only
`share.ts`.

---

## 9. Smoke test matrix (paper)

| Scenario                                  | Expected                                           |
|-------------------------------------------|----------------------------------------------------|
| iOS Safari, result → 영상 공유             | Web Share sheet opens with mp4 attached            |
| iOS Safari, result → 답장 보내기           | Web Share sheet with caption+URL                   |
| Android Chrome, home card → 도전장 보내기 | Web Share sheet with PNG card attached             |
| KakaoTalk in-app, home → 도전장 보내기    | Clipboard copy + toast "채팅에 붙여넣기"           |
| Desktop Chrome, result → 영상 공유         | File downloaded + caption copied + toast           |
| No mic/camera permission                  | Unaffected — share acts on already-recorded blob   |
