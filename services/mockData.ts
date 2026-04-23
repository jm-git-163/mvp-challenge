/**
 * mockData.ts — 19개 다양한 템플릿 (gesture / voice_read / timing / expression)
 * v2: Rich intro / outro / layers — CapCut/TikTok-level production quality
 */
import type { Template } from '../types/template';
import type { UserSession, UserProfile } from '../types/session';

// FIX-SCRIPT-POOL (2026-04-23): voice_read 미션 대본 풀.
//   사용자가 같은 템플릿을 반복 실행해도 매번 다른 문장을 읽도록 풀 기반 로테이션.
//   useJudgement 가 pickScriptWithHistory 로 localStorage 최근 3개 제외 랜덤 선택.
//   각 문장 2~4초 분량 (30~60자). 한국어/영어 일관성 유지.

const POOL_DAILY_VLOG: string[] = [
  '안녕하세요! 오늘의 일상 브이로그를 시작할게요.',
  '오늘 아침은 따뜻한 커피 한 잔으로 시작했어요.',
  '햇살 좋은 날이라 동네 산책을 다녀왔답니다.',
  '오늘도 평범하지만 소중한 하루를 기록해요.',
  '점심은 가볍게 샐러드와 빵으로 먹었어요.',
  '카페에 앉아 좋아하는 책을 읽는 중이에요.',
  '오후엔 공원에서 바람을 쐬며 사색했어요.',
  '저녁 노을이 너무 예뻐서 한참 바라봤어요.',
  '집에 돌아와 따뜻한 차를 마시며 쉬었어요.',
  '오늘 하루도 무사히 지나가서 감사해요.',
  '내일은 조금 더 부지런한 하루를 보낼게요.',
  '여러분도 오늘 하루 수고 많으셨어요.',
  '오늘은 작은 행복을 찾는 하루를 보냈어요.',
  '아침 일찍 일어나 요가로 몸을 풀었어요.',
  '퇴근 후 좋아하는 플레이리스트를 들으며 걸었어요.',
  '주말엔 집 정리하면서 미니멀 라이프를 실천했어요.',
  '오늘 처음으로 새로운 카페에 도전해봤어요.',
  '소소한 취미로 화분에 물을 주는 시간이 좋아요.',
  '오늘은 오랜 친구와 수다 떠는 행복한 하루였어요.',
  '비 오는 날엔 창가에서 책 읽는 게 최고예요.',
  '오늘 저녁은 간단하게 집밥으로 마무리했어요.',
  '잠들기 전 일기 쓰는 루틴이 마음을 편하게 해줘요.',
  '오늘 배운 새로운 것을 여러분과 나누고 싶어요.',
  '평범한 하루에도 감사할 일이 참 많네요.',
];

const POOL_NEWS_GREETING: string[] = [
  '안녕하세요, 오늘의 주요 뉴스를 전해드리겠습니다.',
  '시청자 여러분, 오늘도 저녁 뉴스 시간이 돌아왔습니다.',
  '늦은 시각 뉴스를 찾아주셔서 감사합니다.',
  '오늘의 헤드라인부터 차례대로 보시겠습니다.',
  '안녕하십니까, 정시 뉴스를 시작하겠습니다.',
  '반갑습니다, 뉴스 데스크 시간입니다.',
  '오늘 하루 세상 이야기, 지금 시작합니다.',
  '좋은 아침입니다, 조간 뉴스부터 전해드립니다.',
  '오늘도 정확하고 빠른 소식으로 찾아뵙겠습니다.',
  '시청자 여러분께 오늘의 주요 이슈를 전해드리겠습니다.',
  '지금부터 속보 브리핑을 시작합니다.',
  '오늘 저녁, 세상의 중요한 순간들을 함께 보시죠.',
];

const POOL_NEWS_WEATHER: string[] = [
  '오늘 날씨는 전국적으로 맑겠으며, 기온은 25도까지 오르겠습니다.',
  '내일 아침은 쌀쌀하니 겉옷을 챙기시기 바랍니다.',
  '주말에는 전국에 비 소식이 있겠습니다.',
  '미세먼지 농도가 높으니 외출 시 마스크를 착용하세요.',
  '태풍이 북상하고 있어 해안가 주민분들은 주의가 필요합니다.',
  '오늘 밤 중부지방에 첫눈이 내리겠습니다.',
  '낮 동안 강한 햇볕이 예상되니 자외선 차단에 유의하세요.',
  '내일은 황사가 유입되어 공기질이 나쁘겠습니다.',
  '이번 주말엔 벚꽃 개화 소식이 전국적으로 전해집니다.',
  '갑작스러운 소나기가 예상되니 우산을 챙기시기 바랍니다.',
  '한파 특보가 발효되어 외출 시 보온에 각별히 유의하세요.',
  '단풍 절정 시기가 다가오며 산간 지역은 특히 아름답겠습니다.',
];

const POOL_NEWS_REPORT: string[] = [
  '현장 기자에 따르면 오늘 챌린지 도전자가 새로운 기록을 세웠다고 합니다.',
  '시민들은 이번 행사에 큰 관심을 보이고 있다고 전해집니다.',
  '관계 당국은 빠른 시일 내 조치를 취하겠다고 밝혔습니다.',
  '전문가들은 이번 결과를 긍정적으로 평가하고 있습니다.',
  '오늘 코스피 지수는 소폭 상승 마감했습니다.',
  '국내 스포츠 대표팀이 오늘 값진 승리를 거두었습니다.',
  '문화계에서는 신작 영화가 개봉 첫날 흥행 1위를 차지했습니다.',
  '최신 연구 결과, 새로운 치료법이 주목받고 있다고 합니다.',
  '전국 곳곳에서 봄꽃 축제가 성황리에 진행되고 있습니다.',
  '정부는 서민 주거 안정 대책을 추가 발표했습니다.',
  '국제 정세 관련, 외교부가 공식 입장을 내놓았습니다.',
  '교통량 증가로 주요 고속도로 정체가 계속되고 있습니다.',
];

const POOL_NEWS_CLOSING: string[] = [
  '이상으로 오늘의 뉴스를 마치겠습니다. 감사합니다.',
  '지금까지 뉴스 앵커 챌린지였습니다. 시청해주셔서 감사합니다.',
  '다음 뉴스 시간에 또 찾아뵙겠습니다. 안녕히 계십시오.',
  '오늘 하루도 편안한 저녁 되시기 바랍니다.',
  '시청해 주신 모든 분들께 깊이 감사드립니다.',
  '내일 아침 뉴스에서 다시 뵙겠습니다.',
  '좋은 밤 보내시고, 내일 또 만나요.',
  '오늘 뉴스는 여기까지입니다. 평안한 하루 되세요.',
  '앞으로도 정확한 보도로 함께하겠습니다.',
  '끝까지 함께해 주셔서 진심으로 감사합니다.',
  '다음 주에도 믿을 수 있는 뉴스로 찾아뵙겠습니다.',
  '오늘 하루 마무리, 편안하게 쉬시기 바랍니다.',
];

// 뉴스 전체 풀 합계: 12+12+12+12 = 48.

const POOL_STORYBOOK_INTRO: string[] = [
  '옛날 옛적에 숲속 깊은 곳에 작은 오두막이 있었어요.',
  '옛날 옛날 아주 먼 옛날, 착한 형제 흥부와 놀부가 살았어요.',
  '옛날에 마음씨 고운 콩쥐와 심술궂은 팥쥐가 살았답니다.',
  '오래전 하늘 아래 마을에 해님과 달님을 섬기는 남매가 있었어요.',
  '어느 마을에 가난하지만 따뜻한 나무꾼이 살았어요.',
  '깊은 산속에 호랑이와 지혜로운 할머니가 살고 있었어요.',
  '바닷가 작은 섬에 인어 공주가 살고 있었답니다.',
  '푸른 하늘 구름 위에는 작은 요정들의 나라가 있었어요.',
  '아주 먼 옛날, 용감한 왕자가 큰 모험을 떠났어요.',
  '어느 추운 겨울밤, 성냥팔이 소녀가 길을 걷고 있었어요.',
  '옛날 어느 마을에 은혜를 갚을 줄 아는 두꺼비가 살았어요.',
  '꽃밭 한가운데 작은 엄지공주가 꽃잎 위에서 잠들었어요.',
];

const POOL_STORYBOOK_MIDDLE: string[] = [
  '그곳에는 마음씨 착한 소녀가 살고 있었답니다.',
  '흥부는 제비의 부러진 다리를 정성껏 치료해 주었어요.',
  '콩쥐는 울면서도 맡겨진 일을 묵묵히 해냈어요.',
  '남매는 하늘에서 내려온 동아줄을 꼭 붙잡았답니다.',
  '나무꾼은 은혜 갚은 까치의 도움으로 목숨을 구했어요.',
  '호랑이는 할머니의 지혜에 깜짝 놀라고 말았답니다.',
  '인어 공주는 바다 마녀에게 목소리를 내어주고 다리를 얻었어요.',
  '왕자는 무서운 용을 물리치고 공주를 구해냈답니다.',
  '요정들은 어린 소녀에게 소원 세 가지를 들어주었어요.',
  '작은 두꺼비는 마을을 위협하는 지네를 물리쳤어요.',
  '엄지공주는 제비의 등에 업혀 따뜻한 남쪽으로 날아갔답니다.',
  '성냥팔이 소녀는 성냥 불빛 속에서 할머니를 만났어요.',
];

const POOL_STORYBOOK_END: string[] = [
  '마법사가 소녀에게 말했어요. 소원을 말해봐!',
  '제비가 물어다 준 박씨에서 금은보화가 쏟아졌답니다.',
  '착한 콩쥐는 결국 행복을 찾고 행복하게 살았어요.',
  '해님이 된 오빠는 누이를 따뜻하게 비추어 주었어요.',
  '까치는 날개를 퍼덕이며 멀리 날아갔답니다.',
  '그 후로 마을엔 평화와 웃음이 가득했답니다.',
  '두 사람은 오래오래 행복하게 살았어요.',
  '왕자와 공주는 성대한 결혼식을 올렸답니다.',
  '요정들의 축복 속에 모두가 소원을 이루었어요.',
  '용감한 주인공은 전설이 되어 오래도록 전해졌답니다.',
  '별빛 아래 이야기는 이렇게 끝이 났어요.',
  '이야기는 여기서 끝. 여러분도 좋은 꿈 꾸세요.',
];

// 스토리북 전체 풀: 12+12+12 = 36.

const POOL_TRAVEL: string[] = [
  '안녕하세요! 지금 제가 여기 왔는데요, 진짜 대박이에요!',
  '드디어 꿈에 그리던 이 여행지에 도착했어요.',
  '바다가 눈앞에 펼쳐져서 정말 감동적이에요.',
  '이 골목길, 사진으로 본 것보다 훨씬 예뻐요.',
  '여기 카페는 현지인들이 꼭 추천하는 곳이래요.',
  '전망대에 올라오니 도시 전체가 한눈에 보여요.',
  '오늘 이 순간을 평생 잊지 못할 것 같아요.',
  '여행 오길 정말 잘했다는 생각이 들어요.',
  '다음엔 꼭 가족이랑 같이 오고 싶어요.',
  '이 맛집 줄 서서 기다린 보람이 있네요.',
  '현지 사람들이 너무 친절해서 기분이 좋아요.',
  '오늘의 여행 인증 여러분께 자랑할게요.',
  '이 도시의 야경은 정말 잊을 수가 없네요.',
  '숙소 전망이 그림엽서 같아서 감탄했어요.',
  '오랜 역사가 느껴지는 이 거리를 걸어봤어요.',
  '현지 재래시장 구경이 여행의 진짜 재미네요.',
  '바닷바람을 맞으며 걷는 이 기분 최고예요.',
  '산 정상에서 일출을 보니 감동이 밀려와요.',
  '이 박물관, 생각보다 볼거리가 정말 많았어요.',
  '골목 구석구석 발견하는 작은 카페들이 예뻐요.',
  '여기 특산품은 꼭 선물로 사서 돌아갈 거예요.',
  '여행 중에 만난 친구들, 정말 소중한 인연이에요.',
  '다음 여행지는 어디로 떠나볼까 벌써 고민돼요.',
  '오늘 찍은 사진들, 평생 간직할 추억이 되겠어요.',
];

const POOL_FOOD_REVIEW: string[] = [
  '안녕하세요! 오늘 제가 신상 아이템을 언박싱해볼게요!',
  '오늘의 맛집, 직접 먹어보고 솔직하게 알려드릴게요.',
  '비주얼부터 완전 합격이에요. 한 입 먹어볼게요.',
  '이 소스 진짜 예술이에요. 따라 만들고 싶을 정도!',
  '고기가 부드러워서 입에서 살살 녹아요.',
  '가격 대비 양도 많고 맛도 훌륭해요.',
  '이 집 시그니처 메뉴, 왜 유명한지 알겠어요.',
  '디저트까지 완벽해서 놀랐어요.',
  '분위기도 좋고 음악도 좋아서 데이트 코스로 추천해요.',
  '다음에 꼭 다시 오고 싶은 맛집이네요.',
  '여러분도 근처 오시면 꼭 들러보세요.',
  '오늘 리뷰는 여기까지! 별점 다섯 개 드립니다.',
  '국물이 깊고 진해서 한 숟가락마다 감탄이 나와요.',
  '면발이 쫄깃해서 식감이 정말 좋아요.',
  '매운맛과 단맛의 균형이 완벽해요.',
  '한우의 마블링이 예술이네요, 육즙이 가득해요.',
  '치즈가 길게 늘어나는 거 보이세요? 진짜 신선해요.',
  '플레이팅이 너무 예뻐서 먹기가 아까울 정도예요.',
  '이 빵, 겉은 바삭하고 속은 촉촉해요.',
  '오늘의 스페셜 메뉴, 꼭 한 번 드셔보세요.',
  '이 가격에 이 퀄리티라니, 가성비 최고예요.',
  '사장님의 정성이 음식에서 느껴져요.',
  '재방문 의사 100%, 제 인생 맛집 리스트에 추가합니다.',
  '오늘 리뷰 도움 되셨다면 구독과 좋아요 부탁해요!',
];

const POOL_ENGLISH: string[] = [
  'Hello everyone! Nice to meet you!',
  'The weather is beautiful today!',
  'I love learning English every single day!',
  'Challenge accepted and completed! Yes!',
  'Hello! My name is Challenge Master!',
  'My pronunciation is getting better and better!',
  'Today is a wonderful day for a new start!',
  'Thank you so much for watching my video.',
  'Please like and subscribe if you enjoyed!',
  'I am so excited to share this with you.',
  'Let me know what you think in the comments.',
  'See you in the next video! Take care!',
  'Practice makes perfect, keep going!',
  'Every small step counts, I believe in myself!',
  'Speaking English boosts my confidence daily.',
  'Good morning! I hope you have a great day.',
  'Never give up on your dreams and goals.',
  'This is my favorite time of the year.',
  'I am grateful for this amazing opportunity.',
  'Let me introduce myself to all of you.',
  'Have a fantastic weekend, everyone!',
  'Believe in yourself and anything is possible.',
  'Today, I learned something new and exciting.',
  'Keep smiling, it makes the world brighter.',
];

const POOL_MOTIVATION: string[] = [
  '내가 제일 잘 나가!',
  '내가 원하는 건 자유, 나만의 스타일로!',
  '이게 나야, 아무도 막을 수 없어!',
  '도전을 멈추지 마, 계속 전진해!',
  '오늘의 나는 어제보다 한 걸음 더 나아가!',
  '한계는 내가 정하는 거야, 한 번 더 가보자!',
  '실패해도 괜찮아, 다시 일어서면 되니까!',
  '나는 할 수 있다, 지금 이 순간 증명한다!',
  '포기하지 마, 네 꿈은 반드시 이루어져!',
  '내 인생의 주인공은 바로 나야!',
  '지금 이 순간, 최고의 나를 만나!',
  '어떤 벽도 내 의지를 막을 수 없어!',
  '성공은 준비된 자의 것이다, 나는 준비됐어!',
  '두려움을 이겨내는 것이 진짜 용기야!',
  '오늘 흘린 땀이 내일의 나를 빛나게 해!',
  '할 수 있다, 될 수 있다, 해낼 것이다!',
];

/**
 * FIX-SCRIPT-POOL-PROD (2026-04-23):
 * Supabase DB 의 기존 템플릿은 `read_text` 가 단일 문자열로 저장되어 있어 로테이션이 불가능했음.
 * genre/theme_id 로 적절한 풀을 찾아 fallback 으로 제공하는 맵.
 * useJudgement.ts 에서 `read_text` 가 string 일 때 이 맵을 조회해 로테이션.
 */
/**
 * FIX-SCRIPT-SUBPOOL (2026-04-23 v2):
 * 사용자 불만 "자막 챌린지 중 '지금까지 시청 감사합니다' 같은 엉뚱한 문장이 뜸".
 * 원인: news 템플릿의 greeting/weather/report/closing 서브풀을 하나로 합쳐 로테이션해서
 *       인사 미션에 마무리 멘트가 튀어나옴.
 * 해결: 원본 read_text 문자열이 어느 서브풀에 속하는지(또는 가장 닮았는지) 먼저 판정하고,
 *       그 서브풀 안에서만 로테이션. 미션의 의도(greeting/weather/report/closing 등)를 유지.
 */
export const SCRIPT_SUBPOOLS: Record<string, string[]> = {
  daily_vlog: POOL_DAILY_VLOG,
  news_greeting: POOL_NEWS_GREETING,
  news_weather: POOL_NEWS_WEATHER,
  news_report: POOL_NEWS_REPORT,
  news_closing: POOL_NEWS_CLOSING,
  storybook_intro: POOL_STORYBOOK_INTRO,
  storybook_middle: POOL_STORYBOOK_MIDDLE,
  storybook_end: POOL_STORYBOOK_END,
  travel: POOL_TRAVEL,
  food_review: POOL_FOOD_REVIEW,
  english: POOL_ENGLISH,
  motivation: POOL_MOTIVATION,
};

/** 원본 read_text 에 가장 잘 맞는 서브풀을 반환. 매칭 실패 시 null. */
export function pickSubPoolForText(originalText: string): string[] | null {
  if (!originalText) return null;
  const src = originalText.trim();
  // 1) 원문이 이미 풀에 들어있으면 그 풀 확정.
  for (const pool of Object.values(SCRIPT_SUBPOOLS)) {
    if (pool.includes(src)) return pool;
  }
  // 2) 키워드 힌트 매칭 (공지성 문구 / 뉴스 세그먼트 등).
  const t = src.toLowerCase();
  const has = (s: string) => t.includes(s.toLowerCase());
  if (has('시청해주셔') || has('시청 감사') || has('다음 시간') || has('마칩니다') || has('감사합니다')) {
    return SCRIPT_SUBPOOLS.news_closing;
  }
  if (has('날씨') || has('기온') || has('비 ') || has('눈 ') || has('맑겠') || has('흐리')) {
    return SCRIPT_SUBPOOLS.news_weather;
  }
  if (has('뉴스입니다') || has('안녕하십니까') || has('뉴스를 시작') || has('속보') || has('아침 뉴스')) {
    return SCRIPT_SUBPOOLS.news_greeting;
  }
  if (has('보도') || has('발표') || has('예정입니다') || has('공개') || has('집계')) {
    return SCRIPT_SUBPOOLS.news_report;
  }
  if (has('옛날 옛적') || has('살았습니다') || has('공주') || has('왕자') || has('꿈을 꿨')) {
    return SCRIPT_SUBPOOLS.storybook_intro;
  }
  if (has('행복하게 살았') || has('그 후로') || has('끝입니다') || has('이야기의 끝')) {
    return SCRIPT_SUBPOOLS.storybook_end;
  }
  if (has('hello') || has('nice to meet') || has('thank you') || has('good morning')) {
    return SCRIPT_SUBPOOLS.english;
  }
  return null;
}

export const SCRIPT_POOLS_BY_THEME: Record<string, string[]> = {
  daily: POOL_DAILY_VLOG,
  daily_vlog: POOL_DAILY_VLOG,
  vlog: POOL_DAILY_VLOG,
  news: [...POOL_NEWS_GREETING, ...POOL_NEWS_WEATHER, ...POOL_NEWS_REPORT, ...POOL_NEWS_CLOSING],
  news_greeting: POOL_NEWS_GREETING,
  news_weather: POOL_NEWS_WEATHER,
  news_report: POOL_NEWS_REPORT,
  news_closing: POOL_NEWS_CLOSING,
  fairy_tale: [...POOL_STORYBOOK_INTRO, ...POOL_STORYBOOK_MIDDLE, ...POOL_STORYBOOK_END],
  kids: [...POOL_STORYBOOK_INTRO, ...POOL_STORYBOOK_MIDDLE, ...POOL_STORYBOOK_END],
  storybook: [...POOL_STORYBOOK_INTRO, ...POOL_STORYBOOK_MIDDLE, ...POOL_STORYBOOK_END],
  storybook_intro: POOL_STORYBOOK_INTRO,
  storybook_middle: POOL_STORYBOOK_MIDDLE,
  storybook_end: POOL_STORYBOOK_END,
  travel: POOL_TRAVEL,
  food: POOL_FOOD_REVIEW,
  food_review: POOL_FOOD_REVIEW,
  english: POOL_ENGLISH,
  english_lesson: POOL_ENGLISH,
  motivation: POOL_MOTIVATION,
  fitness: POOL_MOTIVATION,
  kpop: POOL_MOTIVATION,
};

export const MOCK_TEMPLATES: Template[] = [

  // ─── 1. 일상 브이로그 (daily_vlog) ───────────────────────────────────────
  {
    id: 'daily-vlog-001',
    name: '오늘의 브이로그',
    genre: 'daily',
    theme_id: 'daily',
    camera_mode: 'selfie',
    difficulty: 1,
    duration_sec: 30,
    bpm: 100,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '📱',
    scene: '오늘 하루를 셀카로 기록해보세요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3000,
      title: '오늘의 브이로그',
      subtitle: '일상을 영상으로 기록해봐요!',
      bgColor: '#667eea',
      bgColor2: '#764ba2',
      animation: 'slide_up',
      accentColor: '#d8b4fe',
    },
    outro: {
      duration_ms: 2500,
      title: '브이로그 완성!',
      subtitle: '오늘 하루도 수고했어요 ✨',
      animation: 'confetti',
      accentColor: '#9b59b6',
    },
    layers: [
      { type: 'vignette', opacity: 0.3 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      frameColor: '#9b59b6',
    },
    sns_template: {
      hashtags: ['일상브이로그', '오늘하루', '일상기록', 'dailyvlog', '브이로그'],
      caption_template: '오늘도 기분 좋은 하루 🌟 {template_name} 점수 {score}점! #일상 #vlog',
      video_frame_css: 'border: 3px solid #9b59b6; border-radius: 16px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3000,  text: '👋 안녕하세요! 오늘의 브이로그 시작!', style: 'highlight' },
      { start_ms: 3000, end_ms: 6000,  text: '😊 오늘 기분은 어때요?',              style: 'bold' },
      { start_ms: 6000, end_ms: 9000,  text: '💝 사랑스러운 하루를 기록해봐요',     style: 'normal' },
      { start_ms: 9000, end_ms: 12000, text: '✌️ 오늘의 브이로그 챌린지!',          style: 'highlight' },
      { start_ms: 12000,end_ms: 16000, text: '📸 최고의 순간을 담아봐요',           style: 'bold' },
      { start_ms: 16000,end_ms: 20000, text: '🌟 일상의 소중함을 느껴봐요',         style: 'normal' },
      { start_ms: 20000,end_ms: 24000, text: '👍 오늘도 최고야!',                   style: 'highlight' },
      { start_ms: 24000,end_ms: 27000, text: '❤️ 구독 좋아요 눌러줘요!',            style: 'bold' },
      { start_ms: 27000,end_ms: 30000, text: '🎉 브이로그 완성! 수고했어요~',        style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 5000,
        type: 'gesture', gesture_id: 'wave', gesture_emoji: '👋',
        threshold: 0.6, guide_text: '손 흔들어 인사!', guide_emoji: '👋', anim_type: 'float',
      },
      {
        seq: 2, start_ms: 5000, end_ms: 10000,
        type: 'voice_read',
        read_text: POOL_DAILY_VLOG,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '인사 멘트!', guide_emoji: '😊', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 10000, end_ms: 16000,
        type: 'gesture', gesture_id: 'heart', gesture_emoji: '💝',
        threshold: 0.65, guide_text: '하트 만들기!', guide_emoji: '💝', anim_type: 'pulse',
      },
      {
        seq: 4, start_ms: 16000, end_ms: 22000,
        type: 'gesture', gesture_id: 'v_sign', gesture_emoji: '✌️',
        threshold: 0.6, guide_text: 'V 사인!', guide_emoji: '✌️', anim_type: 'bounce',
      },
      {
        seq: 5, start_ms: 22000, end_ms: 27000,
        type: 'expression',
        threshold: 0.65, guide_text: '최고의 미소!', guide_emoji: '😄', anim_type: 'pulse',
      },
      {
        seq: 6, start_ms: 27000, end_ms: 30000,
        type: 'gesture', gesture_id: 'thumbs_up', gesture_emoji: '👍',
        threshold: 0.65, guide_text: '엄지 척!', guide_emoji: '👍', anim_type: 'bounce',
      },
    ],
  },

  // ─── 2. 뉴스 앵커 (news_anchor) ───────────────────────────────────────────
  {
    id: 'news-anchor-002',
    name: '뉴스 앵커 챌린지',
    genre: 'news',
    theme_id: 'news',
    camera_mode: 'selfie',
    difficulty: 2,
    duration_sec: 30,
    bpm: 90,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '📺',
    scene: '뉴스 스튜디오에서 앵커가 되어봐요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 4000,
      title: '📺 LIVE NEWS',
      subtitle: '지금 바로 방송 시작합니다',
      bgColor: '#0a1628',
      bgColor2: '#1a3a6a',
      animation: 'glitch',
      soundEffect: 'impact',
      accentColor: '#1565c0',
    },
    outro: {
      duration_ms: 3000,
      title: '방송 완료!',
      subtitle: '완벽한 앵커였습니다 👏',
      animation: 'score_explosion',
      accentColor: '#1565c0',
    },
    layers: [
      { type: 'ticker', color: '#c62828', text: '🔴 속보 · BREAKING NEWS · 챌린지 뉴스 · LIVE · 속보 · BREAKING · 오늘의 뉴스 · ' },
      { type: 'lower_third', color: '#1565c0', text: 'MC 챌린저 | 뉴스 챌린지 앵커' },
      { type: 'scanlines', opacity: 0.08 },
    ],
    ticker: '🔴 속보 · BREAKING NEWS · 오늘의 챌린지 뉴스 · LIVE BROADCAST · ',
    virtual_bg: {
      type: 'pattern',
      css: 'linear-gradient(180deg, #0a1628 0%, #1a2e4a 50%, #0d1f35 100%)',
      overlayTop: '📺 LIVE NEWS',
      overlayBottom: '🔴 속보 · 오늘의 뉴스 · BREAKING NEWS · 최신 뉴스 · ',
      frameColor: '#1565c0',
    },
    sns_template: {
      hashtags: ['뉴스앵커', '챌린지', '뉴스스타', 'newsanchor', '앵커챌린지'],
      caption_template: '내가 뉴스 앵커가 됐어요! 📺 {template_name} {score}점 달성! #뉴스앵커 #챌린지',
      video_frame_css: 'border: 3px solid #1565c0; border-radius: 8px; background: #0a1628;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 4000,  text: '📺 안녕하세요. 뉴스 시작합니다.',                      style: 'news' },
      { start_ms: 4000, end_ms: 8000,  text: '오늘의 주요 뉴스를 전해드리겠습니다.',                  style: 'news' },
      { start_ms: 8000, end_ms: 12000, text: '⚡ 속보: 챌린지 도전자가 기록을 세웠습니다!',           style: 'highlight' },
      { start_ms: 12000,end_ms: 16000, text: '전국적으로 맑겠으며 기온은 25도까지 오르겠습니다.',      style: 'news' },
      { start_ms: 16000,end_ms: 20000, text: '오늘 주식시장은 강세를 보이고 있습니다.',               style: 'news' },
      { start_ms: 20000,end_ms: 24000, text: '🔴 LIVE: 현장 연결합니다. 상황을 전해주세요.',          style: 'highlight' },
      { start_ms: 24000,end_ms: 27000, text: '이상으로 오늘의 뉴스를 마치겠습니다.',                  style: 'news' },
      { start_ms: 27000,end_ms: 30000, text: '시청해주셔서 감사합니다. 👏',                          style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 5000,
        type: 'timing',
        threshold: 0.6, guide_text: '카메라를 정면으로 바라봐요', guide_emoji: '📷', anim_type: 'pulse',
      },
      {
        seq: 2, start_ms: 5000, end_ms: 11000,
        type: 'voice_read',
        read_text: POOL_NEWS_GREETING,
        read_lang: 'ko',
        threshold: 0.55, guide_text: '앵커처럼 읽어보세요!', guide_emoji: '🎙️', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 11000, end_ms: 18000,
        type: 'voice_read',
        read_text: POOL_NEWS_WEATHER,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '날씨 예보를 읽어요!', guide_emoji: '🌤️', anim_type: 'pulse',
      },
      {
        seq: 4, start_ms: 18000, end_ms: 25000,
        type: 'voice_read',
        read_text: POOL_NEWS_REPORT,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '현장 리포트!', guide_emoji: '📡', anim_type: 'pulse',
      },
      {
        seq: 5, start_ms: 25000, end_ms: 30000,
        type: 'voice_read',
        read_text: POOL_NEWS_CLOSING,
        read_lang: 'ko',
        threshold: 0.55, guide_text: '마무리 멘트!', guide_emoji: '🎬', anim_type: 'float',
      },
    ],
  },

  // ─── 3. 영어 레슨 (english_lesson) ───────────────────────────────────────
  {
    id: 'english-lesson-003',
    name: '영어 한마디 챌린지',
    genre: 'english',
    theme_id: 'english',
    camera_mode: 'selfie',
    difficulty: 2,
    duration_sec: 25,
    bpm: 95,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🇺🇸',
    scene: '영어 문장을 자신있게 읽어봐요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3000,
      title: 'English Challenge!',
      subtitle: '자신있게 영어로 말해봐요',
      bgColor: '#0f4c75',
      bgColor2: '#1b6ca8',
      animation: 'zoom_in',
      accentColor: '#3498db',
    },
    outro: {
      duration_ms: 2500,
      title: 'Great Job!',
      subtitle: '영어 실력이 늘고 있어요 🎓',
      animation: 'confetti',
      accentColor: '#2196f3',
    },
    layers: [
      { type: 'vignette', opacity: 0.25 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      overlayTop: '🇺🇸 English Challenge',
      frameColor: '#2196f3',
    },
    sns_template: {
      hashtags: ['영어챌린지', '영어공부', 'englishchallenge', '영어한마디', 'speakenglish'],
      caption_template: '영어 말하기 도전! 🇺🇸 {template_name} {score}점! 나도 영어 할 수 있어! #영어챌린지',
      video_frame_css: 'border: 3px solid #2196f3; border-radius: 12px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3000,  text: '🇺🇸 영어로 말해봐요!',                       style: 'bold' },
      { start_ms: 3000, end_ms: 7000,  text: 'Hello everyone! Nice to meet you!',         style: 'highlight' },
      { start_ms: 7000, end_ms: 11000, text: 'Today is a wonderful day for a challenge!', style: 'highlight' },
      { start_ms: 11000,end_ms: 15000, text: 'I love learning English every single day!', style: 'highlight' },
      { start_ms: 15000,end_ms: 19000, text: 'My English is getting better and better!',  style: 'bold' },
      { start_ms: 19000,end_ms: 22000, text: 'Challenge accepted and completed! Yes!',    style: 'highlight' },
      { start_ms: 22000,end_ms: 25000, text: 'See you next time! Bye bye! 👋',            style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4000,
        type: 'gesture', gesture_id: 'wave', gesture_emoji: '👋',
        threshold: 0.6, guide_text: '손 흔들어 인사!', guide_emoji: '👋', anim_type: 'bounce',
      },
      {
        seq: 2, start_ms: 4000, end_ms: 9000,
        type: 'voice_read',
        read_text: POOL_ENGLISH,
        read_lang: 'en',
        threshold: 0.5, guide_text: '큰 소리로 읽어봐요!', guide_emoji: '🗣️', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 9000, end_ms: 14000,
        type: 'voice_read',
        read_text: POOL_ENGLISH,
        read_lang: 'en',
        threshold: 0.5, guide_text: '자신있게!', guide_emoji: '💪', anim_type: 'pulse',
      },
      {
        seq: 4, start_ms: 14000, end_ms: 20000,
        type: 'voice_read',
        read_text: POOL_ENGLISH,
        read_lang: 'en',
        threshold: 0.55, guide_text: '도전 완료 선언!', guide_emoji: '🏆', anim_type: 'bounce',
      },
      {
        seq: 5, start_ms: 20000, end_ms: 25000,
        type: 'gesture', gesture_id: 'wave', gesture_emoji: '👋',
        threshold: 0.6, guide_text: '작별 인사!', guide_emoji: '👋', anim_type: 'bounce',
      },
    ],
  },

  // ─── 4. 동화 낭독 (fairy_tale_reader) ────────────────────────────────────
  {
    id: 'fairy-tale-004',
    name: '동화책 낭독 챌린지',
    genre: 'kids',
    theme_id: 'fairy_tale',
    camera_mode: 'selfie',
    difficulty: 1,
    duration_sec: 25,
    bpm: 80,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '📖',
    scene: '동화책 주인공이 되어 낭독해봐요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3500,
      title: '📖 동화 나라',
      subtitle: '옛날 옛날에...',
      bgColor: '#6a0572',
      bgColor2: '#e91e8c',
      animation: 'particle_burst',
      accentColor: '#ff80ab',
    },
    outro: {
      duration_ms: 3000,
      title: '이야기 완성!',
      subtitle: '멋진 낭독이었어요 🌈',
      animation: 'confetti',
      accentColor: '#ff80ab',
    },
    layers: [
      { type: 'star_rain', color: '#fce7f3', opacity: 0.6, speed: 0.7 },
      { type: 'vignette', opacity: 0.2 },
    ],
    virtual_bg: {
      type: 'pattern',
      css: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      overlayTop: '📖 옛날 옛날에...',
      frameColor: '#ff9800',
    },
    sns_template: {
      hashtags: ['동화낭독', '동화챌린지', '동화책', '낭독챌린지', 'storytelling'],
      caption_template: '나만의 동화 낭독 🏰 {template_name} {score}점 달성! #동화 #낭독챌린지',
      video_frame_css: 'border: 4px solid #ff9800; border-radius: 20px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3500,  text: '📖 옛날 옛날에...',                              style: 'story' },
      { start_ms: 3500, end_ms: 7000,  text: '숲속 깊은 곳에 작은 오두막이 있었어요.',          style: 'story' },
      { start_ms: 7000, end_ms: 11000, text: '그곳에는 마음씨 착한 소녀가 살고 있었답니다.',    style: 'story' },
      { start_ms: 11000,end_ms: 15000, text: '어느 날 소녀는 신기한 마법사를 만났어요.',        style: 'story' },
      { start_ms: 15000,end_ms: 19000, text: '마법사가 말했어요: 소원을 말해봐!',               style: 'highlight' },
      { start_ms: 19000,end_ms: 22000, text: '소녀는 용기를 내어 대답했어요.',                  style: 'story' },
      { start_ms: 22000,end_ms: 25000, text: '이야기는 계속됩니다... 🌙',                       style: 'story' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4000,
        type: 'expression',
        threshold: 0.6, guide_text: '이야기 시작 표정!', guide_emoji: '😊', anim_type: 'pulse',
      },
      {
        seq: 2, start_ms: 4000, end_ms: 9000,
        type: 'voice_read',
        read_text: POOL_STORYBOOK_INTRO,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '동화처럼 읽어봐요!', guide_emoji: '📖', anim_type: 'float',
      },
      {
        seq: 3, start_ms: 9000, end_ms: 14000,
        type: 'voice_read',
        read_text: POOL_STORYBOOK_MIDDLE,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '계속 이야기해요!', guide_emoji: '🏡', anim_type: 'float',
      },
      {
        seq: 4, start_ms: 14000, end_ms: 20000,
        type: 'voice_read',
        read_text: POOL_STORYBOOK_END,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '마법사 목소리로!', guide_emoji: '🧙', anim_type: 'float',
      },
      {
        seq: 5, start_ms: 20000, end_ms: 25000,
        type: 'gesture', gesture_id: 'heart', gesture_emoji: '💕',
        threshold: 0.6, guide_text: '해피엔딩 하트!', guide_emoji: '💕', anim_type: 'pulse',
      },
    ],
  },

  // ─── 5. 여행 인증 (travel_cert) ───────────────────────────────────────────
  {
    id: 'travel-cert-005',
    name: '여행지 인증 챌린지',
    genre: 'travel',
    theme_id: 'travel',
    camera_mode: 'normal',
    difficulty: 1,
    duration_sec: 20,
    bpm: 110,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '✈️',
    scene: '여행지, 핫플, 카페 앞에서 인증해봐요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3000,
      title: '✈️ 여행 챌린지',
      subtitle: '지금 어디 계세요?',
      bgColor: '#1a0533',
      bgColor2: '#4a1060',
      animation: 'zoom_in',
      accentColor: '#f97316',
    },
    outro: {
      duration_ms: 2500,
      title: '여행 인증 완료!',
      subtitle: '멋진 곳에 있군요 🌏',
      animation: 'confetti',
      accentColor: '#f97316',
    },
    layers: [
      { type: 'vignette', opacity: 0.3 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #0099f7 0%, #f11712 100%)',
      overlayTop: '✈️ TRAVEL CERT',
      frameColor: '#00bcd4',
    },
    sns_template: {
      hashtags: ['여행인증', '여행스타그램', '핫플', 'travelgram', '여행챌린지'],
      caption_template: '여기 왔어요! ✈️ {template_name} {score}점! 강추 여행지 #여행인증 #여행스타그램',
      video_frame_css: 'border: 3px solid #00bcd4; border-radius: 12px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3000,  text: '✈️ 어디야? 배경 보여줘!',         style: 'bold' },
      { start_ms: 3000, end_ms: 6000,  text: '📍 지금 여기가 진짜 핫플이에요!', style: 'highlight' },
      { start_ms: 6000, end_ms: 9000,  text: '✌️ 여기 왔어요~',                 style: 'bold' },
      { start_ms: 9000, end_ms: 12000, text: '📸 인증샷 찍어줘!',               style: 'normal' },
      { start_ms: 12000,end_ms: 15000, text: '🗺️ 이런 곳을 알고 있다니!',       style: 'highlight' },
      { start_ms: 15000,end_ms: 18000, text: '🙌 여기 강추입니다!!',             style: 'bold' },
      { start_ms: 18000,end_ms: 20000, text: '🌏 또 여행 갈게요!',              style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4000,
        type: 'timing',
        threshold: 0.6, guide_text: '배경 보여줘!', guide_emoji: '🌍', anim_type: 'float',
      },
      {
        seq: 2, start_ms: 4000, end_ms: 8000,
        type: 'voice_read',
        read_text: POOL_TRAVEL,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '여행지 소개!', guide_emoji: '🎤', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 8000, end_ms: 12000,
        type: 'gesture', gesture_id: 'v_sign', gesture_emoji: '✌️',
        threshold: 0.65, guide_text: 'V 사인!', guide_emoji: '✌️', anim_type: 'bounce',
      },
      {
        seq: 4, start_ms: 12000, end_ms: 16000,
        type: 'gesture', gesture_id: 'point_cam', gesture_emoji: '👉',
        threshold: 0.65, guide_text: '배경 가리켜!', guide_emoji: '📸', anim_type: 'shake',
      },
      {
        seq: 5, start_ms: 16000, end_ms: 20000,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.7, guide_text: '양손 번쩍!', guide_emoji: '🙌', anim_type: 'bounce',
      },
    ],
  },

  // ─── 6. 제품 언박싱 (product_unboxing) ───────────────────────────────────
  {
    id: 'product-unbox-006',
    name: '신상템 언박싱 챌린지',
    genre: 'promotion',
    theme_id: 'product',
    camera_mode: 'selfie',
    difficulty: 1,
    duration_sec: 20,
    bpm: 120,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🛍️',
    scene: '새로 산 아이템을 카메라 앞에서 소개해요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3000,
      title: '🛍️ 언박싱 타임!',
      subtitle: '신상 아이템 등장!',
      bgColor: '#f093fb',
      bgColor2: '#f5576c',
      animation: 'slide_up',
      accentColor: '#e91e63',
    },
    outro: {
      duration_ms: 2500,
      title: '언박싱 완료!',
      subtitle: '강추 아이템 공유하기 📱',
      animation: 'confetti',
      accentColor: '#e91e63',
    },
    layers: [
      { type: 'vignette', opacity: 0.2 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      frameColor: '#e91e63',
    },
    sns_template: {
      hashtags: ['언박싱', '신상템', '제품리뷰', 'unboxing', '쇼핑스타그램'],
      caption_template: '신상 언박싱 완료 🛍️ {template_name} {score}점! 이거 진짜 강추!! #언박싱 #신상',
      video_frame_css: 'border: 3px solid #e91e63; border-radius: 16px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3500,  text: '🛍️ 이거 봐봐요!!!',              style: 'bold' },
      { start_ms: 3500, end_ms: 7000,  text: '👆 두두등장~ 오늘의 신상!',       style: 'highlight' },
      { start_ms: 7000, end_ms: 11000, text: '😍 완전 대박이에요 진짜로!',       style: 'normal' },
      { start_ms: 11000,end_ms: 14000, text: '💯 퀄리티가 정말 최고예요!',       style: 'bold' },
      { start_ms: 14000,end_ms: 17000, text: '👍 이거 진짜 강추!!',              style: 'highlight' },
      { start_ms: 17000,end_ms: 20000, text: '🤩 구경 와줘서 감사해요~',         style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4500,
        type: 'gesture', gesture_id: 'arms_spread', gesture_emoji: '🙆',
        threshold: 0.65, guide_text: '두 팔 벌려 등장!', guide_emoji: '🙆', anim_type: 'bounce',
      },
      {
        seq: 2, start_ms: 4500, end_ms: 9000,
        type: 'voice_read',
        read_text: POOL_FOOD_REVIEW,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '신상 소개 멘트!', guide_emoji: '🎤', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 9000, end_ms: 14000,
        type: 'expression',
        threshold: 0.65, guide_text: '감탄하는 표정!', guide_emoji: '😍', anim_type: 'pulse',
      },
      {
        seq: 4, start_ms: 14000, end_ms: 17500,
        type: 'gesture', gesture_id: 'thumbs_up', gesture_emoji: '👍',
        threshold: 0.7, guide_text: '엄지 척!', guide_emoji: '👍', anim_type: 'bounce',
      },
      {
        seq: 5, start_ms: 17500, end_ms: 20000,
        type: 'gesture', gesture_id: 'wave', gesture_emoji: '👋',
        threshold: 0.65, guide_text: '손 흔들며 마무리!', guide_emoji: '👋', anim_type: 'bounce',
      },
    ],
  },

  // ─── 7. K-POP 아이돌 챌린지 (kpop_idol) ─────────────────────────────────
  {
    id: 'kpop-idol-007',
    name: 'K-POP 아이돌 챌린지',
    genre: 'kpop',
    theme_id: 'kpop',
    camera_mode: 'selfie',
    difficulty: 3,
    duration_sec: 30,
    bpm: 130,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🎤',
    scene: 'K-POP 아이돌이 되어 무대를 불태워요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 4000,
      title: '🎤 K-POP STAGE',
      subtitle: '아이돌처럼 빛나봐요!',
      bgColor: '#0d0d1a',
      bgColor2: '#3a0060',
      animation: 'particle_burst',
      soundEffect: 'fanfare',
      accentColor: '#e94560',
    },
    outro: {
      duration_ms: 3000,
      title: '무대 완성!',
      subtitle: '당신은 이미 아이돌 ⭐',
      animation: 'crown',
      accentColor: '#e94560',
    },
    layers: [
      { type: 'spotlight', color: '#e94560', opacity: 0.6, speed: 1.2 },
      { type: 'star_rain', color: '#fbbf24', opacity: 0.5, speed: 0.9 },
      { type: 'beat_flash', color: '#e94560', opacity: 0.15 },
    ],
    spotlights: true,
    virtual_bg: {
      type: 'pattern',
      css: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      overlayTop: '🎤 K-POP IDOL CHALLENGE',
      frameColor: '#e94560',
    },
    sns_template: {
      hashtags: ['kpop아이돌챌린지', 'kpopchallenge', '케이팝', '아이돌', 'kpop'],
      caption_template: '나도 K-POP 아이돌! 🎤 {template_name} {score}점 달성! #kpop #아이돌챌린지',
      video_frame_css: 'border: 3px solid #e94560; border-radius: 12px; background: #1a1a2e;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3000,  text: '🎤 무대 위에 올라와요!',           style: 'highlight' },
      { start_ms: 3000, end_ms: 6000,  text: '왼쪽으로! 포인트 동작!',            style: 'bold' },
      { start_ms: 6000, end_ms: 9000,  text: '🙌 양손 번쩍! 에너지 충전!',       style: 'highlight' },
      { start_ms: 9000, end_ms: 12000, text: '💃 팔 넓게 벌려봐요~',             style: 'bold' },
      { start_ms: 12000,end_ms: 15000, text: '내가 제일 잘 나가! 🔥',            style: 'highlight' },
      { start_ms: 15000,end_ms: 18000, text: '🤍 하트 포즈로 팬들에게!',          style: 'bold' },
      { start_ms: 18000,end_ms: 21000, text: '클라이맥스! 최고의 퍼포먼스!',      style: 'highlight' },
      { start_ms: 21000,end_ms: 24000, text: '⭐ 오늘 무대 최고야!',              style: 'bold' },
      { start_ms: 24000,end_ms: 27000, text: '✌️ 팬 여러분 사랑해요!',            style: 'highlight' },
      { start_ms: 27000,end_ms: 30000, text: '🏆 챌린지 완료! 최고!',             style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 5000,
        type: 'timing',
        threshold: 0.6, guide_text: '카메라 정면! 무대 위에 서요!', guide_emoji: '🎬', anim_type: 'pulse',
      },
      {
        seq: 2, start_ms: 5000, end_ms: 9000,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.72, guide_text: '양손 번쩍!', guide_emoji: '🙌', anim_type: 'bounce',
      },
      {
        seq: 3, start_ms: 9000, end_ms: 14000,
        type: 'gesture', gesture_id: 'arms_spread', gesture_emoji: '🦅',
        threshold: 0.68, guide_text: '양팔 펼쳐요!', guide_emoji: '🦅', anim_type: 'float',
      },
      {
        seq: 4, start_ms: 14000, end_ms: 18000,
        type: 'voice_read',
        read_text: POOL_MOTIVATION,
        read_lang: 'ko',
        threshold: 0.55, guide_text: '아이돌처럼 외쳐봐요!', guide_emoji: '🎤', anim_type: 'pulse',
      },
      {
        seq: 5, start_ms: 18000, end_ms: 23000,
        type: 'gesture', gesture_id: 'heart', gesture_emoji: '💝',
        threshold: 0.7, guide_text: '하트 만들어!', guide_emoji: '💝', anim_type: 'pulse',
      },
      {
        seq: 6, start_ms: 23000, end_ms: 27000,
        type: 'expression',
        threshold: 0.65, guide_text: '아이돌 표정!', guide_emoji: '🌟', anim_type: 'pulse',
      },
      {
        seq: 7, start_ms: 27000, end_ms: 30000,
        type: 'gesture', gesture_id: 'v_sign', gesture_emoji: '✌️',
        threshold: 0.68, guide_text: 'V 포즈!', guide_emoji: '✌️', anim_type: 'bounce',
      },
    ],
  },

  // ─── 8. 피트니스 스쿼트 마스터 (fitness_squat_master) ────────────────────
  {
    id: 'fitness-squat-master-008',
    name: '💪 스쿼트 마스터 챌린지',
    genre: 'fitness',
    theme_id: 'motivation',
    camera_mode: 'normal',
    difficulty: 2,
    duration_sec: 45,
    bpm: 120,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '💪',
    scene: '스쿼트 챌린지! 바른 자세로 10회 완성하세요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3500,
      title: '💪 FITNESS ON',
      subtitle: '스쿼트로 하체를 불태워봐요!',
      bgColor: '#0d1b0f',
      bgColor2: '#0f3b2e',
      animation: 'zoom_in',
      soundEffect: 'impact',
      accentColor: '#14b8a6',
    },
    outro: {
      duration_ms: 3000,
      title: '스쿼트 완료!',
      subtitle: '오늘도 멋진 운동 했어요 🔥',
      animation: 'score_explosion',
      accentColor: '#14b8a6',
    },
    layers: [
      { type: 'vignette', opacity: 0.4 },
      { type: 'beat_flash', color: '#14b8a6', opacity: 0.1 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #f093fb 0%, #f5a623 100%)',
      frameColor: '#f5a623',
    },
    sns_template: {
      hashtags: ['스쿼트챌린지', '홈트', '다이어트', '운동', 'squat'],
      caption_template: '스쿼트 마스터 완료! 💪 {template_name} {score}점 달성! #스쿼트챌린지 #홈트',
      video_frame_css: 'border: 3px solid #f5a623; border-radius: 12px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 5000,  text: '🦶 발을 어깨 너비로 벌리세요!',         style: 'bold' },
      { start_ms: 5000, end_ms: 10000, text: '⬇️ 1~3개! 자세 유지! 천천히!',          style: 'highlight' },
      { start_ms: 10000,end_ms: 16000, text: '💪 4~6개! 무릎이 발끝을 넘지 않게!',    style: 'bold' },
      { start_ms: 16000,end_ms: 22000, text: '🔥 7~8개! 10개 완성! 포기 금지!',       style: 'highlight' },
      { start_ms: 22000,end_ms: 28000, text: '⚡ 9~10개! 마지막이다! 힘내요!',         style: 'bold' },
      { start_ms: 28000,end_ms: 34000, text: '🎉 10개 완성! 정말 잘했어요!',           style: 'highlight' },
      { start_ms: 34000,end_ms: 39000, text: '🧘 스트레칭으로 마무리해요',             style: 'bold' },
      { start_ms: 39000,end_ms: 42000, text: '💪 다음에 더 잘할 수 있어요!',           style: 'highlight' },
      { start_ms: 42000,end_ms: 45000, text: '🏆 자세 유지! 최고야!',                  style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 5000,
        type: 'timing',
        threshold: 0.6, guide_text: '준비 자세! 발을 어깨 너비로 🦶', anim_type: 'pulse',
      },
      {
        seq: 2, start_ms: 5000, end_ms: 15000,
        type: 'timing',
        threshold: 0.65, guide_text: '1~4개! 천천히 내려가고 올라와요 ⬇️', anim_type: 'bounce',
      },
      {
        seq: 3, start_ms: 15000, end_ms: 26000,
        type: 'timing',
        threshold: 0.7, guide_text: '5~8개! 무릎이 발끝 안쪽으로! 💪', anim_type: 'bounce',
      },
      {
        seq: 4, start_ms: 26000, end_ms: 36000,
        type: 'timing',
        threshold: 0.75, guide_text: '9~10개! 마지막 힘내요! 🔥', anim_type: 'shake',
      },
      {
        seq: 5, start_ms: 36000, end_ms: 41000,
        type: 'expression',
        threshold: 0.6, guide_text: '힘든데 웃어봐요! 파이팅!', guide_emoji: '😤', anim_type: 'pulse',
      },
      {
        seq: 6, start_ms: 41000, end_ms: 45000,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.6, guide_text: '완료! 양손 들어 만세! 🏆', guide_emoji: '🏆', anim_type: 'float',
      },
    ],
  },

  // ─── 9. 영어 발음 마스터 (english_speak) ─────────────────────────────────
  {
    id: 'english-speak-009',
    name: '🌍 영어 발음 마스터',
    genre: 'english',
    theme_id: 'english',
    camera_mode: 'selfie',
    difficulty: 2,
    duration_sec: 30,
    bpm: 90,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🎓',
    scene: '영어 문장을 크게 따라 읽어봐요! 발음 연습 챌린지!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3000,
      title: '🎓 Pronunciation Master',
      subtitle: 'Say it loud and clear!',
      bgColor: '#2193b0',
      bgColor2: '#6dd5ed',
      animation: 'slide_up',
      accentColor: '#2193b0',
    },
    outro: {
      duration_ms: 2500,
      title: 'Perfect Pronunciation!',
      subtitle: 'Your English is amazing 🌟',
      animation: 'confetti',
      accentColor: '#2193b0',
    },
    layers: [
      { type: 'vignette', opacity: 0.25 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
      overlayTop: '🎓 English Pronunciation Master',
      frameColor: '#2193b0',
    },
    sns_template: {
      hashtags: ['영어발음챌린지', '영어공부', '발음연습', 'englishpronunciation', '영어마스터'],
      caption_template: '영어 발음 마스터 도전! 🌍 {template_name} {score}점! 나도 영어 잘해! #영어발음챌린지',
      video_frame_css: 'border: 3px solid #2193b0; border-radius: 12px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 5000,  text: 'Hello! My name is Challenge Master!',    style: 'highlight' },
      { start_ms: 5000, end_ms: 10000, text: 'The weather is beautiful today!',        style: 'highlight' },
      { start_ms: 10000,end_ms: 15000, text: 'I love learning English every day!',     style: 'highlight' },
      { start_ms: 15000,end_ms: 20000, text: 'My pronunciation is getting so good!',   style: 'bold' },
      { start_ms: 20000,end_ms: 25000, text: 'Challenge accepted and completed!',      style: 'highlight' },
      { start_ms: 25000,end_ms: 30000, text: 'See you again! Have a great day! 🌟',   style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 7000,
        type: 'voice_read',
        read_text: POOL_ENGLISH,
        read_lang: 'en',
        threshold: 0.6, guide_text: '크게 말해봐요!', guide_emoji: '🗣️', anim_type: 'pulse',
      },
      {
        seq: 2, start_ms: 7000, end_ms: 14000,
        type: 'voice_read',
        read_text: POOL_ENGLISH,
        read_lang: 'en',
        threshold: 0.6, guide_text: '날씨 표현!', guide_emoji: '☀️', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 14000, end_ms: 21000,
        type: 'voice_read',
        read_text: POOL_ENGLISH,
        read_lang: 'en',
        threshold: 0.6, guide_text: '열정을 담아서!', guide_emoji: '📚', anim_type: 'pulse',
      },
      {
        seq: 4, start_ms: 21000, end_ms: 27000,
        type: 'voice_read',
        read_text: POOL_ENGLISH,
        read_lang: 'en',
        threshold: 0.65, guide_text: '자신있게!', guide_emoji: '🏆', anim_type: 'bounce',
      },
      {
        seq: 5, start_ms: 27000, end_ms: 30000,
        type: 'gesture', gesture_id: 'wave', gesture_emoji: '👋',
        threshold: 0.6, guide_text: 'Bye bye!', guide_emoji: '👋', anim_type: 'bounce',
      },
    ],
  },

  // ─── 10. 어린이 동화 (kids_story) ────────────────────────────────────────
  {
    id: 'kids-story-010',
    name: '🌈 어린이 동화 읽기',
    genre: 'kids',
    theme_id: 'kids',
    camera_mode: 'selfie',
    difficulty: 1,
    duration_sec: 25,
    bpm: 85,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🌈',
    scene: '어린이도 쉽게 따라 읽는 재미있는 동화!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3000,
      title: '🌈 동화 세계로!',
      subtitle: '귀여운 이야기 시작해요',
      bgColor: '#a8edea',
      bgColor2: '#fed6e3',
      animation: 'particle_burst',
      accentColor: '#ff80ab',
    },
    outro: {
      duration_ms: 2500,
      title: '동화 완성! 🌈',
      subtitle: '정말 귀여웠어요!',
      animation: 'confetti',
      accentColor: '#ff80ab',
    },
    layers: [
      { type: 'star_rain', color: '#fce7f3', opacity: 0.7, speed: 0.6 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      overlayTop: '🌈 동화 세계로!',
      frameColor: '#ff80ab',
    },
    sns_template: {
      hashtags: ['어린이동화', '동화읽기', '키즈챌린지', 'kidsstory', '동화'],
      caption_template: '귀여운 동화 낭독 완료 🌈 {template_name} {score}점! 아이와 함께해요~ #어린이동화 #키즈',
      video_frame_css: 'border: 4px solid #ff80ab; border-radius: 20px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3500,  text: '🌈 동화 세계로 출발!',           style: 'story' },
      { start_ms: 3500, end_ms: 7000,  text: '🐰 토끼야, 어디 가니?',           style: 'story' },
      { start_ms: 7000, end_ms: 10000, text: '🥕 나는 당근을 찾아가요!',        style: 'story' },
      { start_ms: 10000,end_ms: 14000, text: '🦔 고슴도치도 따라왔어요',        style: 'story' },
      { start_ms: 14000,end_ms: 18000, text: '🌸 숲속이 너무 예뻐요',           style: 'story' },
      { start_ms: 18000,end_ms: 21000, text: '🎉 모두 함께 신나게!',            style: 'highlight' },
      { start_ms: 21000,end_ms: 25000, text: '❤️ 모두 행복하게 살았대요!',      style: 'story' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4000,
        type: 'expression',
        threshold: 0.6, guide_text: '신나는 표정!', guide_emoji: '😄', anim_type: 'bounce',
      },
      {
        seq: 2, start_ms: 4000, end_ms: 8500,
        type: 'voice_read',
        read_text: POOL_STORYBOOK_INTRO,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '따라 읽어봐요!', guide_emoji: '🐰', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 8500, end_ms: 13000,
        type: 'voice_read',
        read_text: POOL_STORYBOOK_MIDDLE,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '토끼처럼 말해요!', guide_emoji: '🥕', anim_type: 'pulse',
      },
      {
        seq: 4, start_ms: 13000, end_ms: 18000,
        type: 'voice_read',
        read_text: POOL_STORYBOOK_END,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '신나게 읽어요!', guide_emoji: '🌸', anim_type: 'float',
      },
      {
        seq: 5, start_ms: 18000, end_ms: 22000,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.6, guide_text: '만세!', guide_emoji: '🎉', anim_type: 'bounce',
      },
      {
        seq: 6, start_ms: 22000, end_ms: 25000,
        type: 'gesture', gesture_id: 'heart', gesture_emoji: '💕',
        threshold: 0.6, guide_text: '해피엔딩 하트!', guide_emoji: '💕', anim_type: 'pulse',
      },
    ],
  },

  // ─── 11. 여행 브이로그 (travel_vlog) ─────────────────────────────────────
  {
    id: 'travel-vlog-011',
    name: '🌏 여행 브이로그 챌린지',
    genre: 'travel',
    theme_id: 'travel',
    camera_mode: 'normal',
    difficulty: 1,
    duration_sec: 20,
    bpm: 110,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🗺️',
    scene: '여행지의 아름다운 순간을 담아봐요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3000,
      title: '🌏 Travel Vlog',
      subtitle: '세상 어딘가에서',
      bgColor: '#1a0533',
      bgColor2: '#4a1060',
      animation: 'zoom_in',
      accentColor: '#f97316',
    },
    outro: {
      duration_ms: 2500,
      title: '여행 기록 완성!',
      subtitle: '소중한 추억이 됐어요 ✈️',
      animation: 'confetti',
      accentColor: '#f97316',
    },
    layers: [
      { type: 'vignette', opacity: 0.3 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #0099f7 0%, #f11712 100%)',
      overlayTop: '🌏 TRAVEL VLOG',
      frameColor: '#f97316',
    },
    sns_template: {
      hashtags: ['여행브이로그', '여행스타그램', '세계여행', 'travelvlog', '여행'],
      caption_template: '여행 브이로그 완성! 🌏 {template_name} {score}점! #여행브이로그 #여행스타그램',
      video_frame_css: 'border: 3px solid #f97316; border-radius: 12px;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 3000,  text: '🌏 여행 브이로그 시작!',         style: 'bold' },
      { start_ms: 3000, end_ms: 6000,  text: '📍 지금 어디 계세요?',           style: 'highlight' },
      { start_ms: 6000, end_ms: 9000,  text: '📸 이 순간을 기억해요',           style: 'normal' },
      { start_ms: 9000, end_ms: 12000, text: '🎒 여행의 설렘을 담아봐요',       style: 'bold' },
      { start_ms: 12000,end_ms: 15000, text: '✈️ 다음 목적지는 어디?',          style: 'highlight' },
      { start_ms: 15000,end_ms: 18000, text: '🌅 이 풍경, 잊지 못할 거예요',   style: 'bold' },
      { start_ms: 18000,end_ms: 20000, text: '🌟 여행 완성! 수고했어요~',       style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 4000,
        type: 'timing',
        threshold: 0.6, guide_text: '배경 보여줘!', guide_emoji: '🌍', anim_type: 'float',
      },
      {
        seq: 2, start_ms: 4000, end_ms: 8000,
        type: 'expression',
        threshold: 0.65, guide_text: '설레는 표정!', guide_emoji: '😍', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 8000, end_ms: 12000,
        type: 'gesture', gesture_id: 'v_sign', gesture_emoji: '✌️',
        threshold: 0.65, guide_text: 'V 사인!', guide_emoji: '✌️', anim_type: 'bounce',
      },
      {
        seq: 4, start_ms: 12000, end_ms: 16000,
        type: 'gesture', gesture_id: 'arms_spread', gesture_emoji: '🙆',
        threshold: 0.65, guide_text: '팔 벌려 자유!', guide_emoji: '🙆', anim_type: 'float',
      },
      {
        seq: 5, start_ms: 16000, end_ms: 20000,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.7, guide_text: '만세!', guide_emoji: '🙌', anim_type: 'bounce',
      },
    ],
  },

  // ─── 12. 힙합 사이퍼 (hiphop_cypher) ─────────────────────────────────────
  {
    id: 'hiphop-cypher-012',
    name: '🎤 힙합 사이퍼 챌린지',
    genre: 'hiphop',
    theme_id: 'kpop',
    camera_mode: 'selfie',
    difficulty: 3,
    duration_sec: 30,
    bpm: 95,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🎧',
    scene: '힙합 비트에 맞춰 라임을 날려봐요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 4000,
      title: '🎤 CYPHER TIME',
      subtitle: '비트에 올라타봐요!',
      bgColor: '#0a0a0a',
      bgColor2: '#1a1a0a',
      animation: 'glitch',
      soundEffect: 'impact',
      accentColor: '#f7b731',
    },
    outro: {
      duration_ms: 3000,
      title: '사이퍼 완성!',
      subtitle: '당신의 랩은 진짜야 🔥',
      animation: 'score_explosion',
      accentColor: '#f7b731',
    },
    layers: [
      { type: 'beat_flash', color: '#f7b731', opacity: 0.12 },
      { type: 'vignette', opacity: 0.5 },
    ],
    virtual_bg: {
      type: 'pattern',
      css: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #24243e 100%)',
      overlayTop: '🎤 HIPHOP CYPHER',
      frameColor: '#f7b731',
    },
    sns_template: {
      hashtags: ['힙합챌린지', '사이퍼', '랩챌린지', 'hiphop', 'cypher'],
      caption_template: '힙합 사이퍼 완료! 🎤 {template_name} {score}점! 내 랩 들어봐요~ #힙합 #사이퍼',
      video_frame_css: 'border: 3px solid #f7b731; border-radius: 12px; background: #0f0c29;',
    },
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 4000,  text: '🎤 마이크 잡아요!',                      style: 'bold' },
      { start_ms: 4000, end_ms: 8000,  text: '내가 원하는 건 자유 / 나만의 스타일로', style: 'highlight' },
      { start_ms: 8000, end_ms: 12000, text: '비트 위에 올라타 / 라임을 날려봐',       style: 'bold' },
      { start_ms: 12000,end_ms: 16000, text: '🔥 이게 나야 / 아무도 막을 수 없어',     style: 'highlight' },
      { start_ms: 16000,end_ms: 20000, text: '지금 이 순간이 / 최고의 무대야',          style: 'bold' },
      { start_ms: 20000,end_ms: 24000, text: '⚡ 도전을 멈추지 마 / 계속 전진해',       style: 'highlight' },
      { start_ms: 24000,end_ms: 27000, text: '사이퍼 완성! 진짜배기!',                  style: 'bold' },
      { start_ms: 27000,end_ms: 30000, text: '🏆 최고의 래퍼 등장!',                   style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 5000,
        type: 'gesture', gesture_id: 'thumbs_up', gesture_emoji: '👍',
        threshold: 0.6, guide_text: '엄지척으로 입장!', guide_emoji: '👍', anim_type: 'bounce',
      },
      {
        seq: 2, start_ms: 5000, end_ms: 11000,
        type: 'voice_read',
        read_text: POOL_MOTIVATION,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '라임을 날려봐!', guide_emoji: '🎤', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 11000, end_ms: 17000,
        type: 'voice_read',
        read_text: POOL_MOTIVATION,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '자신감 폭발!', guide_emoji: '🔥', anim_type: 'pulse',
      },
      {
        seq: 4, start_ms: 17000, end_ms: 23000,
        type: 'gesture', gesture_id: 'arms_cross', gesture_emoji: '🤜',
        threshold: 0.65, guide_text: '팔 교차 포즈!', guide_emoji: '🤜', anim_type: 'spin',
      },
      {
        seq: 5, start_ms: 23000, end_ms: 27000,
        type: 'voice_read',
        read_text: POOL_MOTIVATION,
        read_lang: 'ko',
        threshold: 0.5, guide_text: '마지막 라임!', guide_emoji: '⚡', anim_type: 'pulse',
      },
      {
        seq: 6, start_ms: 27000, end_ms: 30000,
        type: 'expression',
        threshold: 0.6, guide_text: '쿨한 마무리 표정!', guide_emoji: '😎', anim_type: 'float',
      },
    ],
  },

  // ─── 13. 스쿼트 10회 챌린지 (fitness-squat) ──────────────────────────────
  {
    id: 'fitness-squat-001',
    name: '💪 스쿼트 10회 챌린지',
    genre: 'fitness',
    theme_id: 'motivation',
    camera_mode: 'normal',
    difficulty: 2,
    duration_sec: 30,
    bpm: 100,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '💪',
    scene: '카메라 앞에서 스쿼트 10회를 완성하세요! 무릎을 구부려 엉덩이를 낮춰요.',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3000,
      title: '💪 스쿼트 10회',
      subtitle: '할 수 있다! 파이팅!',
      bgColor: '#0d1b0f',
      bgColor2: '#1a3a2e',
      animation: 'zoom_in',
      soundEffect: 'impact',
      accentColor: '#14b8a6',
    },
    outro: {
      duration_ms: 2500,
      title: '스쿼트 10회 완료!',
      subtitle: '오늘도 멋진 운동 🔥',
      animation: 'score_explosion',
      accentColor: '#14b8a6',
    },
    layers: [
      { type: 'vignette', opacity: 0.35 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #f093fb 0%, #f5a623 100%)',
      frameColor: '#f5a623',
    },
    sns_template: {
      hashtags: ['스쿼트챌린지', '홈트', '다이어트', '운동', 'squat'],
      caption_template: '스쿼트 10회 완료! 💪 {template_name} {score}점 달성! #스쿼트챌린지 #홈트',
      video_frame_css: 'border: 3px solid #f5a623; border-radius: 12px;',
    },
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 3000,  text: '🦶 발을 어깨 너비로 벌리세요!',        style: 'bold' },
      { start_ms: 3000,  end_ms: 10000, text: '⬇️ 1~3번 스쿼트! 천천히 내려가요',     style: 'highlight' },
      { start_ms: 10000, end_ms: 18000, text: '💪 4~7번! 무릎이 발끝을 넘지 않게!',   style: 'bold' },
      { start_ms: 18000, end_ms: 25000, text: '🔥 8~10번! 마지막 힘내요!',            style: 'highlight' },
      { start_ms: 25000, end_ms: 30000, text: '🏆 완료! 승리 포즈!',                  style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 3000,
        type: 'timing',
        threshold: 0.6, guide_text: '준비 자세! 발을 어깨 너비로 벌리세요 🦶', anim_type: 'pulse',
      },
      {
        seq: 2, start_ms: 3000, end_ms: 10000,
        type: 'timing',
        threshold: 0.65, guide_text: '1~3번 스쿼트! 천천히 내려가요 ⬇️', anim_type: 'bounce',
      },
      {
        seq: 3, start_ms: 10000, end_ms: 18000,
        type: 'timing',
        threshold: 0.7, guide_text: '4~7번 스쿼트! 무릎이 발끝을 넘지 않게! 💪', anim_type: 'bounce',
      },
      {
        seq: 4, start_ms: 18000, end_ms: 25000,
        type: 'timing',
        threshold: 0.75, guide_text: '8~10번! 마지막 힘내요! 🔥', anim_type: 'shake',
      },
      {
        seq: 5, start_ms: 25000, end_ms: 30000,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.6, guide_text: '완료! 양손 들어 만세! 🏆', guide_emoji: '🏆', anim_type: 'float',
      },
    ],
  },

  // ─── 14. 플랭크 챌린지 (fitness-plank) ───────────────────────────────────
  {
    id: 'fitness-plank-001',
    name: '🔥 플랭크 30초 챌린지',
    genre: 'fitness',
    theme_id: 'motivation',
    camera_mode: 'normal',
    difficulty: 2,
    duration_sec: 40,
    bpm: 90,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🔥',
    scene: '플랭크 자세로 코어 근육을 강화하세요! 스마트폰 앞에서 도전!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3000,
      title: '🔥 플랭크 30초',
      subtitle: '코어를 불태워봐요!',
      bgColor: '#1a0005',
      bgColor2: '#3a0010',
      animation: 'zoom_in',
      soundEffect: 'impact',
      accentColor: '#ff4b2b',
    },
    outro: {
      duration_ms: 2500,
      title: '플랭크 30초 완료!',
      subtitle: '코어 강화 성공 💪',
      animation: 'score_explosion',
      accentColor: '#ff4b2b',
    },
    layers: [
      { type: 'vignette', opacity: 0.4 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
      frameColor: '#ff4b2b',
    },
    sns_template: {
      hashtags: ['플랭크챌린지', '코어운동', '홈트', '30초플랭크', 'plank'],
      caption_template: '플랭크 30초 성공! 🔥 {template_name} {score}점! 코어 완성! #플랭크챌린지 #홈트',
      video_frame_css: 'border: 3px solid #ff4b2b; border-radius: 12px;',
    },
    // TEAM-UX (2026-04-23): 사용자 피드백 "플랭크는 자세 안내와 버티는 시간을 초로 표시".
    //   10초 단위 카운트다운 자막(매우 큰 폰트) + 자세 안내 서브라인.
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 5000,  text: '🙌 준비 · 팔꿈치 아래로!',         style: 'bold' },
      { start_ms: 5000,  end_ms: 15000, text: '💪 30초 버티기 · 엉덩이 수평!',     style: 'highlight' },
      { start_ms: 15000, end_ms: 25000, text: '🔥 20초 남음 · 배에 힘 꽉!',        style: 'highlight' },
      { start_ms: 25000, end_ms: 35000, text: '⏱ 10초 · 숨 쉬며 버텨!',           style: 'highlight' },
      { start_ms: 35000, end_ms: 40000, text: '🎉 완료! 코어 완성 💪',             style: 'highlight' },
    ],
    // TEAM-UX (2026-04-23): 미션 guide_text 에 큰 초 카운트 삽입.
    //   subtitle_track 에서 숫자 크게 렌더 (이미 style: highlight 지원).
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 5000,
        type: 'gesture', gesture_id: 'arms_spread', gesture_emoji: '🙌',
        threshold: 0.6, guide_text: '팔꿈치 바닥에! 몸은 일자로', anim_type: 'bounce',
      },
      {
        seq: 2, start_ms: 5000, end_ms: 15000,
        type: 'timing',
        threshold: 0.7, guide_text: '30··· 버텨! 엉덩이 들지 마', anim_type: 'pulse',
      },
      {
        seq: 3, start_ms: 15000, end_ms: 25000,
        type: 'timing',
        threshold: 0.75, guide_text: '20··· 배에 힘! 호흡 계속', anim_type: 'shake',
      },
      {
        seq: 4, start_ms: 25000, end_ms: 35000,
        type: 'timing',
        threshold: 0.75, guide_text: '10··· 거의 다 왔어!', anim_type: 'shake',
      },
      {
        seq: 5, start_ms: 35000, end_ms: 40000,
        type: 'expression',
        threshold: 0.6, guide_text: '🎉 완료! 최고야', guide_emoji: '🎉', anim_type: 'float',
      },
    ],
  },

  // ─── 15. K-POP 댄스 챌린지 (dance-kpop) ─────────────────────────────────
  {
    id: 'dance-kpop-001',
    name: '💃 K-POP 댄스 챌린지',
    genre: 'kpop',
    theme_id: 'kpop',
    camera_mode: 'selfie',
    difficulty: 3,
    duration_sec: 30,
    bpm: 128,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '💃',
    scene: 'K-POP 리듬에 맞춰 댄스 챌린지! 개성있는 움직임을 보여주세요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 4000,
      title: '💃 K-POP DANCE',
      subtitle: '온몸으로 표현해봐요!',
      bgColor: '#0f0c29',
      bgColor2: '#3a0060',
      animation: 'particle_burst',
      soundEffect: 'fanfare',
      accentColor: '#e94560',
    },
    outro: {
      duration_ms: 3000,
      title: '댄스 완성!',
      subtitle: '당신의 무대였어요 ⭐',
      animation: 'crown',
      accentColor: '#e94560',
    },
    layers: [
      { type: 'spotlight', color: '#e94560', opacity: 0.5, speed: 1.5 },
      { type: 'beat_flash', color: '#a855f7', opacity: 0.12 },
    ],
    spotlights: true,
    virtual_bg: {
      type: 'pattern',
      css: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      overlayTop: '💃 K-POP DANCE CHALLENGE',
      frameColor: '#e94560',
    },
    sns_template: {
      hashtags: ['kpop댄스챌린지', 'kpopdance', '케이팝댄스', '댄스챌린지', 'kpop'],
      caption_template: 'K-POP 댄스 챌린지 완료! 💃 {template_name} {score}점! 같이 춰요~ #kpop #댄스챌린지',
      video_frame_css: 'border: 3px solid #e94560; border-radius: 12px; background: #0f0c29;',
    },
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 5000,  text: '👋 리듬에 맞춰 손 흔들기!',      style: 'highlight' },
      { start_ms: 5000,  end_ms: 10000, text: '🎵 온몸으로 리듬타기! 자유롭게!', style: 'bold' },
      { start_ms: 10000, end_ms: 15000, text: '🙌 팔 벌려 에너지 업!',           style: 'highlight' },
      { start_ms: 15000, end_ms: 20000, text: '💃 포인트 안무 시작!',             style: 'bold' },
      { start_ms: 20000, end_ms: 25000, text: '🌟 최고 하이라이트! 최선을 다해요!', style: 'highlight' },
      { start_ms: 25000, end_ms: 30000, text: '👍 마무리 포즈!',                 style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 5000,
        type: 'gesture', gesture_id: 'wave', gesture_emoji: '👋',
        threshold: 0.6, guide_text: '리듬에 맞춰 손 흔들기!', guide_emoji: '👋', anim_type: 'float',
      },
      {
        seq: 2, start_ms: 5000, end_ms: 11000,
        type: 'timing',
        threshold: 0.6, guide_text: '온몸으로 리듬타기! 🎵 자유롭게!', anim_type: 'bounce',
      },
      {
        seq: 3, start_ms: 11000, end_ms: 17000,
        type: 'gesture', gesture_id: 'arms_spread', gesture_emoji: '🙌',
        threshold: 0.65, guide_text: '팔 벌려 에너지 업!', guide_emoji: '🙌', anim_type: 'spin',
      },
      {
        seq: 4, start_ms: 17000, end_ms: 23000,
        type: 'timing',
        threshold: 0.65, guide_text: '최고 하이라이트! 최선을 다해요! 🌟', anim_type: 'shake',
      },
      {
        seq: 5, start_ms: 23000, end_ms: 27000,
        type: 'expression',
        threshold: 0.65, guide_text: '아이돌 표정!', guide_emoji: '⭐', anim_type: 'pulse',
      },
      {
        seq: 6, start_ms: 27000, end_ms: 30000,
        type: 'gesture', gesture_id: 'thumbs_up', gesture_emoji: '👍',
        threshold: 0.6, guide_text: '마무리 포즈!', guide_emoji: '👍', anim_type: 'bounce',
      },
    ],
  },

  // ─── 16. 명상 챌린지 (meditation) ────────────────────────────────────────
  {
    id: 'meditation-001',
    name: '🧘 명상 챌린지',
    genre: 'fitness',
    theme_id: 'motivation',
    camera_mode: 'selfie',
    difficulty: 1,
    duration_sec: 30,
    bpm: 60,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🌸',
    scene: '눈을 감고 깊게 호흡해요. 마음을 고요히 하는 30초 챌린지!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 4000,
      title: '🌸 명상 시간',
      subtitle: '마음을 고요히 해봐요',
      bgColor: '#a18cd1',
      bgColor2: '#fbc2eb',
      animation: 'slide_up',
      accentColor: '#a18cd1',
    },
    outro: {
      duration_ms: 3000,
      title: '명상 완료 ✨',
      subtitle: '마음이 한결 가벼워졌어요',
      animation: 'confetti',
      accentColor: '#a18cd1',
    },
    layers: [
      { type: 'vignette', opacity: 0.2 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
      frameColor: '#a18cd1',
    },
    sns_template: {
      hashtags: ['명상챌린지', '마음챙김', '호흡명상', 'meditation', '힐링'],
      caption_template: '명상 챌린지 완료! 🌸 {template_name} {score}점! 마음이 편안해졌어요 #명상챌린지 #힐링',
      video_frame_css: 'border: 3px solid #a18cd1; border-radius: 16px;',
    },
    // TEAM-UX (2026-04-23): 사용자 피드백 "명상은 센 TTS 가 명상을 깨뜨림" → 부드러운 자막만.
    //   record/index.tsx 에서 meditation-001 은 speakMission() 차단.
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 10000, text: '🌬️  들이쉬어요',            style: 'normal' },
      { start_ms: 10000, end_ms: 20000, text: '😌  잠시 멈춰요',             style: 'normal' },
      { start_ms: 20000, end_ms: 30000, text: '✨  천천히 내쉬어요',         style: 'normal' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 10000,
        type: 'timing',
        threshold: 0.6, guide_text: '들이쉬어요 🌬️', anim_type: 'float',
      },
      {
        seq: 2, start_ms: 10000, end_ms: 20000,
        type: 'timing',
        threshold: 0.6, guide_text: '잠시 멈춰요 😌', anim_type: 'float',
      },
      {
        seq: 3, start_ms: 20000, end_ms: 30000,
        type: 'expression',
        threshold: 0.6, guide_text: '천천히 내쉬어요 ✨', guide_emoji: '✨', anim_type: 'pulse',
      },
    ],
  },

  // ─── 17. 팔굽혀펴기 챌린지 (fitness-pushup) ──────────────────────────────
  {
    id: 'fitness-pushup-001',
    name: '💪 팔굽혀펴기 챌린지',
    genre: 'fitness',
    theme_id: 'motivation',
    camera_mode: 'normal',
    difficulty: 3,
    duration_sec: 35,
    bpm: 95,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🦾',
    scene: '스마트폰 앞에서 팔굽혀펴기 10회! 상체 근력을 키워요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3500,
      title: '🦾 PUSH-UP!',
      subtitle: '상체를 불태워봐요!',
      bgColor: '#1c1c1c',
      bgColor2: '#2a0010',
      animation: 'zoom_in',
      soundEffect: 'impact',
      accentColor: '#e94560',
    },
    outro: {
      duration_ms: 2500,
      title: '팔굽혀펴기 완료!',
      subtitle: '상체 근력 UP 💪',
      animation: 'score_explosion',
      accentColor: '#e94560',
    },
    layers: [
      { type: 'vignette', opacity: 0.45 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #1c1c1c 0%, #3a3a3a 50%, #1a1a2e 100%)',
      overlayTop: '🦾 PUSH-UP CHALLENGE',
      frameColor: '#e94560',
    },
    sns_template: {
      hashtags: ['팔굽혀펴기챌린지', '푸시업', '상체운동', '홈트', 'pushup'],
      caption_template: '팔굽혀펴기 10회 완료! 💪 {template_name} {score}점! 상체 완성! #팔굽혀펴기 #홈트',
      video_frame_css: 'border: 3px solid #e94560; border-radius: 12px; background: #1c1c1c;',
    },
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 5000,  text: '🙌 준비 자세! 팔은 어깨 너비로',          style: 'bold' },
      { start_ms: 5000,  end_ms: 15000, text: '💪 1~4번! 가슴이 바닥에 닿을 듯이!',     style: 'highlight' },
      { start_ms: 15000, end_ms: 25000, text: '🔥 5~8번! 포기하지 마세요!',              style: 'bold' },
      { start_ms: 25000, end_ms: 35000, text: '💥 9~10번! 마지막 힘내요!',              style: 'highlight' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 5000,
        type: 'timing',
        threshold: 0.6, guide_text: '준비 자세! 팔은 어깨 너비로 🙌', anim_type: 'pulse',
      },
      {
        seq: 2, start_ms: 5000, end_ms: 15000,
        type: 'timing',
        threshold: 0.7, guide_text: '1~4번! 가슴이 바닥에 닿을 듯이! 💪', anim_type: 'bounce',
      },
      {
        seq: 3, start_ms: 15000, end_ms: 25000,
        type: 'timing',
        threshold: 0.72, guide_text: '5~8번! 포기하지 마세요! 🔥', anim_type: 'shake',
      },
      {
        seq: 4, start_ms: 25000, end_ms: 35000,
        type: 'timing',
        threshold: 0.75, guide_text: '9~10번! 마지막 힘내요! 💥', anim_type: 'shake',
      },
    ],
  },

  // ─── 18. 힙합 댄스 챌린지 (dance-hiphop) ────────────────────────────────
  {
    id: 'dance-hiphop-001',
    name: '🎵 힙합 댄스 챌린지',
    genre: 'hiphop',
    theme_id: 'kpop',
    camera_mode: 'selfie',
    difficulty: 2,
    duration_sec: 25,
    bpm: 95,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🎤',
    scene: '힙합 비트에 맞춰 자유롭게 춤춰요! 나만의 스타일을 보여주세요!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3500,
      title: '🎵 힙합 댄스',
      subtitle: '자유롭게 비트를 타봐요!',
      bgColor: '#0f0c29',
      bgColor2: '#1a150a',
      animation: 'glitch',
      soundEffect: 'impact',
      accentColor: '#f7b731',
    },
    outro: {
      duration_ms: 2500,
      title: '댄스 완성!',
      subtitle: '당신만의 스타일 최고 😎',
      animation: 'score_explosion',
      accentColor: '#f7b731',
    },
    layers: [
      { type: 'beat_flash', color: '#f7b731', opacity: 0.1 },
      { type: 'vignette', opacity: 0.45 },
    ],
    virtual_bg: {
      type: 'pattern',
      css: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #24243e 100%)',
      overlayTop: '🎤 HIPHOP DANCE CHALLENGE',
      frameColor: '#f7b731',
    },
    sns_template: {
      hashtags: ['힙합댄스챌린지', '힙합', '댄스챌린지', 'hiphop', 'freestyle'],
      caption_template: '힙합 댄스 챌린지 완료! 🎵 {template_name} {score}점! 내 스타일 봐봐~ #힙합 #댄스챌린지',
      video_frame_css: 'border: 3px solid #f7b731; border-radius: 12px; background: #0f0c29;',
    },
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 6000,  text: '👍 엄지척으로 입장!',          style: 'bold' },
      { start_ms: 6000,  end_ms: 13000, text: '🎵 비트에 맞춰 자유롭게! 헤드바운싱!', style: 'highlight' },
      { start_ms: 13000, end_ms: 19000, text: '🤜 팔 교차 동작!',             style: 'bold' },
      { start_ms: 19000, end_ms: 22000, text: '⚡ 하이라이트! 폭발해봐요!',     style: 'highlight' },
      { start_ms: 22000, end_ms: 25000, text: '😎 마무리 쿨 포즈!',           style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 6000,
        type: 'gesture', gesture_id: 'thumbs_up', gesture_emoji: '👍',
        threshold: 0.6, guide_text: '엄지척으로 입장!', guide_emoji: '👍', anim_type: 'bounce',
      },
      {
        seq: 2, start_ms: 6000, end_ms: 13000,
        type: 'timing',
        threshold: 0.6, guide_text: '비트에 맞춰 자유롭게! 헤드바운싱! 🎵', anim_type: 'bounce',
      },
      {
        seq: 3, start_ms: 13000, end_ms: 19000,
        type: 'gesture', gesture_id: 'arms_cross', gesture_emoji: '🤜',
        threshold: 0.65, guide_text: '팔 교차 동작!', guide_emoji: '🤜', anim_type: 'spin',
      },
      {
        seq: 4, start_ms: 19000, end_ms: 22000,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.65, guide_text: '하이라이트! 🙌', guide_emoji: '⚡', anim_type: 'bounce',
      },
      {
        seq: 5, start_ms: 22000, end_ms: 25000,
        type: 'expression',
        threshold: 0.6, guide_text: '마무리 쿨 포즈! 😎', guide_emoji: '😎', anim_type: 'float',
      },
    ],
  },

  // ─── 19. 스쿼트 50개 챌린지 (fitness-squat-50) ────────────────────────────
  {
    id: 'fitness-squat-50',
    name: '🏆 스쿼트 50개 챌린지',
    genre: 'fitness',
    theme_id: 'motivation',
    camera_mode: 'normal',
    difficulty: 3,
    duration_sec: 120,
    bpm: 110,
    bgm_url: '',
    thumbnail_url: '',
    theme_emoji: '🏆',
    scene: '스쿼트 50개에 도전! 꾸준히 하면 살이 빠지고 근육이 생겨요. 하루 1세트부터 시작!',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 4000,
      title: '🏆 스쿼트 50개',
      subtitle: '전설의 챌린지 시작!',
      bgColor: '#0f2027',
      bgColor2: '#2c5364',
      animation: 'zoom_in',
      soundEffect: 'fanfare',
      accentColor: '#14b8a6',
    },
    outro: {
      duration_ms: 4000,
      title: '스쿼트 50개 완료!',
      subtitle: '당신은 진정한 챔피언 🏆',
      animation: 'score_explosion',
      accentColor: '#14b8a6',
    },
    layers: [
      { type: 'vignette', opacity: 0.35 },
      { type: 'beat_flash', color: '#14b8a6', opacity: 0.08 },
    ],
    virtual_bg: {
      type: 'gradient',
      css: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
      overlayTop: '🏆 SQUAT 50 CHALLENGE',
      overlayBottom: '#스쿼트50개  #홈트  #다이어트  #하체운동  #squat50challenge  #홈트레이닝',
      frameColor: '#14b8a6',
    },
    sns_template: {
      hashtags: ['스쿼트50개', '스쿼트챌린지', '홈트', '하체운동', '다이어트운동', 'squat50'],
      caption_template: '스쿼트 50개 달성! 🏆 {template_name} {score}점! 같이 도전해봐요~ #스쿼트50개 #홈트',
      video_frame_css: 'border: 3px solid #14b8a6; border-radius: 12px;',
    },
    subtitle_timeline: [
      { start_ms: 0,      end_ms: 8000,   text: '🦶 발을 어깨 너비로! 준비 자세 잡아요', style: 'bold' },
      { start_ms: 8000,   end_ms: 28000,  text: '⬇️ 1~10개! 천천히 내려가고 올라와요', style: 'highlight' },
      { start_ms: 28000,  end_ms: 50000,  text: '💪 11~20개! 무릎이 발끝 안쪽으로!', style: 'bold' },
      { start_ms: 50000,  end_ms: 70000,  text: '🔥 21~30개! 절반! 포기하지 마세요!', style: 'highlight' },
      { start_ms: 70000,  end_ms: 90000,  text: '💥 31~40개! 엉덩이 더 내려요!', style: 'bold' },
      { start_ms: 90000,  end_ms: 108000, text: '🌟 41~50개! 마지막! 최선을 다해요!', style: 'highlight' },
      { start_ms: 108000, end_ms: 120000, text: '🏆 완료! 50개 달성! 당신은 최고야!', style: 'bold' },
    ],
    missions: [
      {
        seq: 1, start_ms: 0, end_ms: 8000,
        type: 'timing',
        threshold: 0.6,
        guide_text: '발을 어깨 너비로 벌려요! 준비 자세 💪',
        guide_emoji: '🦶', anim_type: 'pulse',
      },
      {
        seq: 2, start_ms: 8000, end_ms: 28000,
        type: 'timing',
        threshold: 0.65,
        guide_text: '1~10개! 무릎을 90° 굽혀요 ⬇️',
        guide_emoji: '🏋️', anim_type: 'bounce',
      },
      {
        seq: 3, start_ms: 28000, end_ms: 50000,
        type: 'timing',
        threshold: 0.70,
        guide_text: '11~20개! 엉덩이를 낮게! 💪',
        guide_emoji: '🔥', anim_type: 'bounce',
      },
      {
        seq: 4, start_ms: 50000, end_ms: 70000,
        type: 'timing',
        threshold: 0.72,
        guide_text: '21~30개! 절반 달성! 포기 금지! 🔥',
        guide_emoji: '💥', anim_type: 'shake',
      },
      {
        seq: 5, start_ms: 70000, end_ms: 90000,
        type: 'timing',
        threshold: 0.75,
        guide_text: '31~40개! 무릎 발끝 안쪽! 💥',
        guide_emoji: '💪', anim_type: 'shake',
      },
      {
        seq: 6, start_ms: 90000, end_ms: 108000,
        type: 'timing',
        threshold: 0.78,
        guide_text: '41~50개! 마지막 스퍼트! 🌟',
        guide_emoji: '🌟', anim_type: 'bounce',
      },
      {
        seq: 7, start_ms: 108000, end_ms: 120000,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.6, guide_text: '50개 완료! 만세 포즈! 🏆', guide_emoji: '🏆', anim_type: 'float',
      },
    ],
  },
];

export const MOCK_USER_ID = 'mock-user-0001';

export const MOCK_PROFILE: UserProfile = {
  user_id: MOCK_USER_ID,
  preferred_genres: ['daily', 'kpop', 'travel', 'kids', 'news'],
  success_rates: {
    'daily-vlog-001':     0.82,
    'kpop-idol-007':      0.75,
    'travel-cert-005':    0.68,
  },
  total_sessions: 8,
  weak_joints: ['left_wrist', 'right_wrist'],
};

export const MOCK_SESSIONS: UserSession[] = [
  {
    id: 'session-001',
    user_id: MOCK_USER_ID,
    template_id: 'daily-vlog-001',
    recorded_at: new Date(Date.now() - 86400000).toISOString(),
    avg_score: 0.82,
    success_rate: 0.80,
    tag_timeline: [],
    video_url: null,
    edited_video_url: null,
  },
  {
    id: 'session-002',
    user_id: MOCK_USER_ID,
    template_id: 'kpop-idol-007',
    recorded_at: new Date(Date.now() - 172800000).toISOString(),
    avg_score: 0.71,
    success_rate: 0.75,
    tag_timeline: [],
    video_url: null,
    edited_video_url: null,
  },
  {
    id: 'session-003',
    user_id: MOCK_USER_ID,
    template_id: 'news-anchor-002',
    recorded_at: new Date(Date.now() - 259200000).toISOString(),
    avg_score: 0.65,
    success_rate: 0.70,
    tag_timeline: [],
    video_url: null,
    edited_video_url: null,
  },
];
