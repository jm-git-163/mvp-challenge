/**
 * mockData.ts — 19개 다양한 템플릿 (gesture / voice_read / timing / expression)
 * v2: Rich intro / outro / layers — CapCut/TikTok-level production quality
 */
import type { Template } from '../types/template';
import type { UserSession, UserProfile } from '../types/session';

// FIX-SCRIPT-I18N (2026-04-23 v4): English teleprompter 는 원문(영어) + 한글 번역을
//   함께 보여줘야 사용자가 맥락을 이해하고 자신있게 낭독할 수 있다.
//   따라서 풀 원소는 단순 string 또는 { text, translation } 객체 둘 다 허용.
//   - text: 음성인식 타겟 & 프롬프터 메인(큰 글씨)
//   - translation: 프롬프터 보조(작은 회색 글씨). 한글 번역.
export type ScriptEntry = { text: string; translation?: string };
export type ScriptPoolItem = string | ScriptEntry;

export function getScriptText(item: ScriptPoolItem): string {
  return typeof item === 'string' ? item : item.text;
}
export function getScriptTranslation(item: ScriptPoolItem): string {
  return typeof item === 'string' ? '' : (item.translation ?? '');
}

// FIX-SCRIPT-POOL (2026-04-23): voice_read 미션 대본 풀.
//   사용자가 같은 템플릿을 반복 실행해도 매번 다른 문장을 읽도록 풀 기반 로테이션.
//   useJudgement 가 pickScriptWithHistory 로 localStorage 최근 3개 제외 랜덤 선택.
//   각 문장 2~4초 분량 (30~60자). 한국어/영어 일관성 유지.
//
// FIX-SCRIPT-TONE (2026-04-23 v3): 사용자 불만 "뉴스 프롬프트 말투가 뉴스톤이어야
//   하는데 어색함. 뉴스는 뉴스톤, 동화는 동화톤". 각 풀을 챌린지 성격에 맞게 톤
//   일관성(voice)을 엄격히 맞춰 재작성. 인사/본문/날씨/마무리처럼 뉴스 내부 세그먼트도
//   톤은 격식체로 통일, 내용만 다르게.

const POOL_DAILY_VLOG: string[] = [
  // 친근체 (~해요, ~였어요) — 소소한 일상을 카메라 앞에서 들려주듯.

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
  // 격식체 오프닝 — 9시 뉴스 앵커 톤. "안녕하십니까" 고정, 자기소개·시작 선언.
  '안녕하십니까, 9시 뉴스입니다.',
  '시청자 여러분, 안녕하십니까. 오늘의 주요 소식을 전해드리겠습니다.',
  '안녕하십니까, 정시 뉴스 시작하겠습니다.',
  '시청자 여러분 안녕하십니까, 오늘의 헤드라인입니다.',
  '안녕하십니까, 속보와 함께 뉴스를 시작합니다.',
  '반갑습니다, 오늘 저녁 뉴스 데스크입니다.',
  '시청자 여러분 안녕하십니까, 정확한 소식으로 찾아뵙겠습니다.',
  '안녕하십니까, 지금부터 오늘의 브리핑을 시작하겠습니다.',
  '좋은 저녁입니다. 오늘 하루 주요 이슈를 정리해 드리겠습니다.',
  '안녕하십니까, 오늘의 뉴스를 전해드릴 앵커입니다.',
];

const POOL_NEWS_WEATHER: string[] = [
  // 기상 리포트 톤 — 3인칭 서술, "~겠습니다", "예상됩니다".
  '내일 전국이 대체로 맑겠으며, 낮 기온은 평년 수준을 유지하겠습니다.',
  '오늘 밤부터 중부지방에 비가 내리겠으며, 시간당 10밀리미터 안팎으로 예상됩니다.',
  '내일 아침 전국 기온이 영하로 떨어지겠으니, 외출 시 보온에 유의하시기 바랍니다.',
  '주말 동안 전국에 강한 바람이 불겠고, 해안 지역은 너울성 파도에 주의가 필요합니다.',
  '태풍이 북상하고 있어 남부지방은 이틀간 많은 비가 예상됩니다.',
  '낮 동안 자외선 지수가 매우 높겠으니, 자외선 차단에 각별히 유의하시기 바랍니다.',
  '내일은 전국적으로 미세먼지 농도가 나쁨 수준을 보이겠습니다.',
  '이번 주말 벚꽃 개화가 전국적으로 절정에 이를 것으로 전망됩니다.',
  '한파 특보가 발효 중이며, 노약자 분들은 외출을 자제하시는 것이 좋겠습니다.',
  '내일 낮부터 황사가 유입되어 공기질이 크게 나빠지겠습니다.',
  '오늘 밤사이 전국 대부분 지역에 첫눈이 내리겠습니다.',
  '이번 주말 단풍이 절정을 이루겠으며, 산간 지역 기온은 5도 안팎을 기록하겠습니다.',
];

const POOL_NEWS_REPORT: string[] = [
  // FIX-SCRIPT-I18N (2026-04-23 v4): 정치/현직정치인/정당/이념 관련 문장 전면 제거.
  //   생활·경제지표·스포츠·문화·과학·재난 일반 보도만 남김. 격식체 "~습니다/~됐습니다".
  '이번 주 전국 고속도로 귀성 차량이 몰리며, 주요 구간에서 정체가 이어지고 있습니다.',
  '코스피 지수가 장중 2퍼센트 넘게 오르며, 올해 최고치를 다시 경신했습니다.',
  '국내 연구진이 개발한 신소재 기술이 국제 학술지에 게재되며 주목을 받고 있습니다.',
  '한국 대표팀은 오늘 경기에서 값진 승리를 거두며, 결승 진출 가능성을 높였습니다.',
  '소방 당국은 현장 진화를 마친 뒤, 정확한 화재 원인을 조사 중이라고 전했습니다.',
  '이번 주말 전국 주요 관광지는 단풍 절정을 맞아 많은 인파가 몰릴 것으로 보입니다.',
  '올해 프로야구 한국시리즈가 오늘 저녁 개막전을 시작으로 본격적인 막을 올립니다.',
  '최근 조사에 따르면 국내 커피 소비량이 지난해보다 8퍼센트 증가한 것으로 나타났습니다.',
  '세계적인 오케스트라의 서울 공연이 전석 매진되며 큰 관심을 모으고 있습니다.',
  '기상청은 이번 주말 전국에 강한 바람이 불겠으며, 해안가 안전에 유의해야 한다고 밝혔습니다.',
  '국내 스타트업이 개발한 인공지능 기술이 해외 박람회에서 최우수상을 수상했습니다.',
  '한국 영화가 국제 영화제 본상에 노미네이트되며, 영화계의 주목을 받고 있습니다.',
];

const POOL_NEWS_CLOSING: string[] = [
  // 뉴스 마무리 멘트 — "지금까지 ... 뉴스였습니다" 형식 고정.
  '지금까지 뉴스였습니다. 시청해주셔서 감사합니다.',
  '이상으로 오늘의 주요 뉴스를 마치겠습니다. 편안한 밤 되시기 바랍니다.',
  '오늘 뉴스는 여기까지입니다. 내일 이 시간에 다시 찾아뵙겠습니다.',
  '지금까지 오늘의 헤드라인을 전해드렸습니다. 감사합니다.',
  '여기까지 저녁 뉴스였습니다. 시청해주신 여러분께 감사드립니다.',
  '다음 뉴스 시간에 다시 뵙겠습니다. 안녕히 계십시오.',
  '오늘의 뉴스를 마칩니다. 언제나 정확한 보도로 찾아뵙겠습니다.',
  '지금까지 9시 뉴스 앵커였습니다. 평안한 저녁 되십시오.',
  '이상 오늘의 종합 뉴스였습니다. 내일 아침에 다시 뵙겠습니다.',
  '끝까지 함께해주셔서 감사합니다. 지금까지 뉴스였습니다.',
];

// 뉴스 전체 풀 합계: 12+12+12+12 = 48.

const POOL_STORYBOOK_INTRO: string[] = [
  // 아이에게 읽어주듯 따뜻한 어미 "~있었어요/~살았어요/~있었답니다".
  // "옛날 옛적에" 또는 "어느 ~에" 로 시작.
  '옛날 옛적에 아름다운 숲 속에 작은 오두막이 있었어요.',
  '옛날 옛날 아주 먼 옛날, 착한 형제 흥부와 놀부가 살고 있었어요.',
  '어느 마을에 마음씨 고운 콩쥐와 심술궂은 팥쥐가 함께 살았답니다.',
  '아주 오래전, 하늘 아래 작은 마을에 해님과 달님 남매가 있었어요.',
  '옛날 어느 깊은 산속에 가난하지만 마음이 따뜻한 나무꾼이 살았어요.',
  '옛날 옛적 바닷속 깊은 궁전에 노래를 좋아하는 인어 공주가 있었어요.',
  '푸른 하늘 구름 위에는 작은 요정들이 모여 사는 마법의 나라가 있었답니다.',
  '아주 먼 옛날, 용감한 왕자님이 공주님을 구하기 위해 여행을 떠났어요.',
  '어느 추운 겨울밤, 성냥팔이 소녀가 눈 내리는 길을 걷고 있었어요.',
  '숲 속 작은 집에 동물 친구들이 모여 살고 있었어요.',
  '어느 따뜻한 봄날, 꽃밭 한가운데 작은 엄지공주가 태어났어요.',
  '옛날에 착한 나무꾼이 선녀의 날개옷을 발견했답니다.',
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
  // 동화 마무리 — "모두 행복하게 살았답니다. 끝." 톤.
  '그리고 모두 오래오래 행복하게 살았답니다. 끝.',
  '착한 콩쥐는 마침내 행복을 되찾고 행복하게 살았어요. 끝.',
  '왕자님과 공주님은 결혼해서 행복하게 살았답니다. 끝.',
  '마을에는 평화와 웃음이 다시 찾아왔답니다. 이야기는 여기까지예요.',
  '요정들의 축복 속에 모두가 소원을 이루었어요. 그 후로도 행복하게 지냈답니다.',
  '용감한 주인공의 이야기는 마을에 오래도록 전해졌답니다. 끝.',
  '별빛이 반짝이는 밤, 동화는 이렇게 끝이 났어요. 잘 자요.',
  '모든 동물 친구들이 함께 웃으며 오래오래 행복했답니다. 끝.',
  '그 후로 숲속 마을에는 언제나 따뜻한 햇살이 비쳤답니다. 끝.',
  '오늘의 동화는 여기까지예요. 여러분도 좋은 꿈 꾸세요.',
  '착한 사람은 반드시 복을 받는답니다. 이야기 끝.',
  '두 사람은 서로를 아끼며 행복하게 살았어요. 끝.',
];

// 스토리북 전체 풀: 12+12+12 = 36.

const POOL_TRAVEL: string[] = [
  // 여행 체크인 — 현장 중계 톤, "여기 정말 멋지죠?" 같은 감탄.
  '여러분 안녕하세요! 저 지금 여기 왔는데요, 정말 멋지죠?',
  '드디어 꿈에 그리던 여행지에 도착했어요! 같이 둘러볼까요?',
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
  // 푸드 리뷰 — 솔직 평가, "한 입 먹어볼게요" 로테이션.
  '여러분 안녕하세요! 오늘의 맛집, 직접 먹어보고 솔직하게 알려드릴게요.',
  '비주얼부터 완전 합격이에요. 한 입 먹어볼게요.',
  '음, 한 입 먹어볼게요... 와, 이건 진짜예요.',
  '향이 정말 좋네요. 한 입 먹어보겠습니다.',
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

// FIX-SCRIPT-I18N (2026-04-23 v4): English speaking 챌린지 — 공공영역/널리 인용되는
//   유명 명언. 각 항목은 { text, translation } 으로 프롬프터가 영문 원문(큰 글씨) +
//   한글 번역(작은 회색 글씨) 2단 표시. 8~25 단어, 저작권/출처 귀속 안전.
const POOL_ENGLISH: ScriptEntry[] = [
  { text: 'Stay hungry, stay foolish.',
    translation: '항상 갈망하라, 우직하게 나아가라. — 스티브 잡스' },
  { text: 'The only way to do great work is to love what you do.',
    translation: '위대한 일을 해내는 유일한 방법은, 자신이 하는 일을 사랑하는 것이다. — 스티브 잡스' },
  { text: 'I have learned that people will forget what you said, but they will never forget how you made them feel.',
    translation: '사람들은 당신이 한 말은 잊어도, 당신이 그들에게 남긴 감정은 결코 잊지 않는다. — 마야 안젤루' },
  { text: 'The best and most beautiful things in the world cannot be seen or even touched; they must be felt with the heart.',
    translation: '세상에서 가장 아름다운 것들은 보거나 만질 수 없고, 오직 마음으로 느껴야 한다. — 헬렌 켈러' },
  { text: 'Darkness cannot drive out darkness; only light can do that. Hate cannot drive out hate; only love can.',
    translation: '어둠은 어둠을 몰아낼 수 없다. 오직 빛만이 그렇게 할 수 있다. 증오는 증오를 몰아낼 수 없다. 오직 사랑만이. — 마틴 루터 킹' },
  { text: 'Education is the most powerful weapon which you can use to change the world.',
    translation: '교육은 세상을 바꾸기 위해 당신이 사용할 수 있는 가장 강력한 무기다. — 넬슨 만델라' },
  { text: 'Imagination is more important than knowledge.',
    translation: '상상력은 지식보다 더 중요하다. — 알버트 아인슈타인' },
  { text: 'In the middle of every difficulty lies opportunity.',
    translation: '모든 어려움의 한가운데에는 기회가 숨어 있다. — 알버트 아인슈타인' },
  { text: 'The future belongs to those who believe in the beauty of their dreams.',
    translation: '미래는 자신의 꿈의 아름다움을 믿는 사람들의 것이다. — 엘리너 루스벨트' },
  { text: 'Life is what happens when you are busy making other plans.',
    translation: '인생이란, 당신이 다른 계획을 세우느라 바쁠 때 일어나는 일이다. — 존 레논' },
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
    translation: '성공은 끝이 아니고, 실패는 치명적이지 않다. 계속 나아가는 용기야말로 중요하다. — 윈스턴 처칠' },
  { text: 'Do not go where the path may lead, go instead where there is no path and leave a trail.',
    translation: '길이 이끄는 곳으로 가지 말고, 길이 없는 곳으로 가 자취를 남겨라. — 랠프 월도 에머슨' },
];

// FIX-SCRIPT-I18N (2026-04-23 v4): motivation-speech 챌린지 — 역사적 한국 인물
//   (독립운동가/시인/장군/학자) 명언. 현직정치인·현대 정치인 제외, 공공역사 인물만.
const POOL_MOTIVATION: string[] = [
  '내가 죽으면 한 개의 별이 되리라. — 안중근',
  '하루라도 책을 읽지 않으면 입안에 가시가 돋는다. — 안중근',
  '죽고자 하면 살 것이요, 살고자 하면 죽을 것이다. — 이순신',
  '신에게는 아직 열두 척의 배가 남아 있사옵니다. — 이순신',
  '나의 소원은 첫째도 독립이요, 둘째도 독립이요, 셋째도 완전한 자주독립이다. — 김구',
  '눈길을 걸어갈 때 함부로 걷지 마라. 오늘 내가 걸어간 발자국은 뒷사람의 이정표가 되리니. — 서산대사',
  '죽는 날까지 하늘을 우러러 한 점 부끄럼이 없기를. — 윤동주',
  '펜은 칼보다 강하다, 그러나 뜻은 펜보다 강하다. — 주시경',
  '내가 원하는 우리나라는 오직 한없이 가지고 싶은 것은 높은 문화의 힘이다. — 백범 김구',
  '뜻이 있는 곳에 반드시 길이 있다. — 도산 안창호',
  '나라를 잃은 민족은 천만 번 자강하여야 한다. — 도산 안창호',
  '우리 민족은 세계에서 가장 훌륭한 민족이 될 수 있다. 그 밑거름이 되자. — 도산 안창호',
];

// FIX-SCRIPT-TONE (2026-04-23 v3) — 신규 톤 풀.

const POOL_KPOP_HYPE: string[] = [
  // K-POP 댄스 — 에너지 폭발, 짧은 외침.
  'Let\'s go! 박자 맞춰서 가보자!',
  '준비됐어? 뛰어 뛰어!',
  '이 비트 미쳤어! 같이 춤 춰!',
  '원 투 쓰리 포! 모두 손 들어!',
  '하이! 따라와 따라와!',
  'Drop the beat! 놓지 마!',
  '박자 타! 느낌 오지?',
  'Yeah! 오늘 우리가 주인공이야!',
  '크게 외쳐! 루나 루나!',
  '렛츠 고! Are you ready?',
];

const POOL_UNBOXING_PROMO: string[] = [
  // 언박싱 — 텐션 높은 프로모 톤, 박스 오프닝 순간.
  '여러분! 드디어 도착했습니다! 오늘의 언박싱!',
  '자, 지금 바로 박스를 열어보겠습니다. 긴장되네요!',
  '오늘의 주인공 공개합니다! 두구두구두구...',
  '와! 이거 실물 진짜 예술이에요! 보세요!',
  '신상 도착했습니다! 제가 먼저 뜯어볼게요!',
  '기다리셨죠? 바로 공개합니다! 짜잔!',
  '오늘의 아이템, 반응 궁금하시죠? 같이 봐요!',
  '이건 진짜 대박입니다! 여러분 놓치지 마세요!',
  '자, 뚜껑 열어볼게요. 기대되시죠?',
  '박스부터 고퀄이에요! 안에는 뭐가 있을까요?',
];

const POOL_SOCIAL_VIRAL: string[] = [
  // 소셜 바이럴 — 짧고 임팩트, 팔로우·좋아요 유도.
  '이거 놓치면 후회해요! 팔로우 필수!',
  '오늘의 챌린지, 같이 해볼 사람?',
  '좋아요 누르고 저장해주세요!',
  '세 줄 요약! 바로 갑니다!',
  '이거 본 사람만 아는 꿀팁!',
  '지금 바로 따라해보세요!',
  '댓글로 의견 남겨주세요!',
  '팔로우하고 알림 설정까지!',
  '조용히 올라가는 중인 영상!',
  'FYP에서 만나요! 가보자고!',
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
export const SCRIPT_SUBPOOLS: Record<string, ScriptPoolItem[]> = {
  daily_vlog: POOL_DAILY_VLOG,
  news_greeting: POOL_NEWS_GREETING,
  news_weather: POOL_NEWS_WEATHER,
  news_report: POOL_NEWS_REPORT,
  news_closing: POOL_NEWS_CLOSING,
  storybook_intro: POOL_STORYBOOK_INTRO,
  storybook_middle: POOL_STORYBOOK_MIDDLE,
  storybook_end: POOL_STORYBOOK_END,
  travel_greeting: POOL_TRAVEL,
  travel: POOL_TRAVEL,
  food_review: POOL_FOOD_REVIEW,
  english: POOL_ENGLISH,
  english_intro: POOL_ENGLISH,
  english_closing: POOL_ENGLISH,
  motivation: POOL_MOTIVATION,
  motivation_speech: POOL_MOTIVATION,
  kpop_hype: POOL_KPOP_HYPE,
  unboxing_promo: POOL_UNBOXING_PROMO,
  social_viral: POOL_SOCIAL_VIRAL,
};

/** 원본 read_text 에 가장 잘 맞는 서브풀을 반환. 매칭 실패 시 null. */
export function pickSubPoolForText(originalText: string): ScriptPoolItem[] | null {
  if (!originalText) return null;
  const src = originalText.trim();
  // 1) 원문이 이미 풀에 들어있으면 그 풀 확정. (객체 풀은 text 필드로 비교)
  for (const pool of Object.values(SCRIPT_SUBPOOLS)) {
    if (pool.some(item => getScriptText(item) === src)) return pool;
  }
  // 2) 키워드 힌트 매칭 (공지성 문구 / 뉴스 세그먼트 등).
  const t = src.toLowerCase();
  const has = (s: string) => t.includes(s.toLowerCase());
  // 뉴스 마무리 — "지금까지 ... 뉴스" 또는 "시청해주셔 ... 감사" 강한 신호.
  if (has('지금까지') && (has('뉴스') || has('감사'))) return SCRIPT_SUBPOOLS.news_closing;
  if (has('시청해주셔') || has('시청 감사') || has('마치겠습니다') || has('다음 뉴스 시간') || has('이상으로 오늘')) {
    return SCRIPT_SUBPOOLS.news_closing;
  }
  // 날씨 리포트
  if (has('날씨') || has('기온') || has('맑겠') || has('흐리') || has('강수') || has('미세먼지') || has('태풍') || has('한파') || has('황사') || has('자외선')) {
    return SCRIPT_SUBPOOLS.news_weather;
  }
  // 뉴스 인사
  if (has('안녕하십니까') || has('9시 뉴스') || has('뉴스 시작') || has('뉴스입니다') || has('저녁 뉴스') || has('오늘의 주요 소식')) {
    return SCRIPT_SUBPOOLS.news_greeting;
  }
  // 뉴스 본문 리포트 (3인칭 서술)
  if (has('정부는') || has('발표했') || has('밝혔습니다') || has('전해졌') || has('전문가') || has('한국은행') || has('코스피') || has('외교부') || has('교육부')) {
    return SCRIPT_SUBPOOLS.news_report;
  }
  // 동화 도입
  if (has('옛날 옛적') || has('옛날 옛날') || has('어느 마을') || has('숲 속') || has('공주') || has('왕자') || has('요정')) {
    return SCRIPT_SUBPOOLS.storybook_intro;
  }
  // 동화 마무리
  if (has('행복하게 살았') || has('오래오래 행복') || has('이야기는 여기') || has('이야기 끝') || has('좋은 꿈 꾸') || has('끝.')) {
    return SCRIPT_SUBPOOLS.storybook_end;
  }
  // 여행
  if (has('여행') || has('도착했') || has('여기 정말') || has('여권') || has('체크인')) {
    return SCRIPT_SUBPOOLS.travel;
  }
  // 푸드
  if (has('한 입') || has('맛있') || has('식감') || has('맛집') || has('별점')) {
    return SCRIPT_SUBPOOLS.food_review;
  }
  // 동기부여
  if (has('포기하지') || has('한계') || has('도전') || has('꿈은') || has('성공은') || has('rise up') || has('believe')) {
    return SCRIPT_SUBPOOLS.motivation;
  }
  // K-POP / 바이럴 / 언박싱
  if (has('박자') || has('let\'s go') || has('yeah') || has('렛츠 고')) {
    return SCRIPT_SUBPOOLS.kpop_hype;
  }
  if (has('언박싱') || has('뜯어') || has('뚜껑') || has('도착했습니다')) {
    return SCRIPT_SUBPOOLS.unboxing_promo;
  }
  if (has('팔로우') || has('좋아요') || has('fyp') || has('바이럴')) {
    return SCRIPT_SUBPOOLS.social_viral;
  }
  // 영어
  if (has('hello') || has('nice to meet') || has('thank you') || has('good morning') || has('welcome')) {
    return SCRIPT_SUBPOOLS.english;
  }
  return null;
}

export const SCRIPT_POOLS_BY_THEME: Record<string, ScriptPoolItem[]> = {
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
  motivation_speech: POOL_MOTIVATION,
  fitness: POOL_MOTIVATION,
  // FIX-SCRIPT-TONE (2026-04-23 v3): kpop 은 동기부여 톤이 아니라 댄스 하이프 톤.
  kpop: POOL_KPOP_HYPE,
  kpop_dance: POOL_KPOP_HYPE,
  dance: POOL_KPOP_HYPE,
  unboxing: POOL_UNBOXING_PROMO,
  unboxing_promo: POOL_UNBOXING_PROMO,
  promotion: POOL_UNBOXING_PROMO,
  social: POOL_SOCIAL_VIRAL,
  viral: POOL_SOCIAL_VIRAL,
  social_viral: POOL_SOCIAL_VIRAL,
  travel_checkin: POOL_TRAVEL,
  travel_greeting: POOL_TRAVEL,
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
    // FIX-SQUAT-COACH (2026-04-23): 하드코딩 "N~M개" 멘트 전부 제거.
    // 실제 카운트를 알 수 없는 시점에 "9~10개! 마지막!" 같은 거짓 멘트가 떠서 어색.
    // 코칭은 자세 가이드만 남긴다.
    subtitle_timeline: [
      { start_ms: 0,    end_ms: 5000,  text: '🦶 발을 어깨 너비로 벌리세요',         style: 'bold' },
      { start_ms: 5000, end_ms: 16000, text: '⬇️ 천천히 내려가고 올라와요',           style: 'highlight' },
      { start_ms: 16000,end_ms: 28000, text: '💪 무릎이 발끝을 넘지 않게',            style: 'bold' },
      { start_ms: 28000,end_ms: 39000, text: '🔥 호흡 유지하며 자세 그대로',           style: 'highlight' },
      { start_ms: 39000,end_ms: 45000, text: '🧘 마무리 스트레칭',                    style: 'bold' },
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
        threshold: 0.65, guide_text: '천천히 내려가고 올라와요 ⬇️', anim_type: 'bounce',
      },
      {
        seq: 3, start_ms: 15000, end_ms: 26000,
        type: 'timing',
        threshold: 0.7, guide_text: '무릎이 발끝 안쪽으로 💪', anim_type: 'bounce',
      },
      {
        seq: 4, start_ms: 26000, end_ms: 36000,
        type: 'timing',
        threshold: 0.75, guide_text: '힘내세요! 자세 유지 🔥', anim_type: 'shake',
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
    scene: '카메라 앞에서 스쿼트를 시작하세요! 무릎을 구부려 엉덩이를 낮춰요.',
    created_at: new Date().toISOString(),
    intro: {
      duration_ms: 3000,
      title: '💪 스쿼트 챌린지',
      subtitle: '할 수 있다! 파이팅!',
      bgColor: '#0d1b0f',
      bgColor2: '#1a3a2e',
      animation: 'zoom_in',
      soundEffect: 'impact',
      accentColor: '#14b8a6',
    },
    // FIX-SQUAT-COUNT (2026-04-23): outro 에 "10회 완료" 박지 않고
    // 결과 페이지가 실제 측정 카운트로 채우도록 placeholder 유지.
    outro: {
      duration_ms: 2500,
      title: '스쿼트 완료!',
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
      caption_template: '스쿼트 챌린지 완료! 💪 {template_name} {score}점 달성! #스쿼트챌린지 #홈트',
      video_frame_css: 'border: 3px solid #f5a623; border-radius: 12px;',
    },
    // FIX-SQUAT-COACH (2026-04-23): "1~3번", "4~7번" 등 가짜 카운트 멘트 제거.
    // 자세 가이드만 남긴다. 실제 카운트는 SquatHUD 가 표시.
    subtitle_timeline: [
      { start_ms: 0,     end_ms: 3000,  text: '🦶 발을 어깨 너비로 벌리세요',        style: 'bold' },
      { start_ms: 3000,  end_ms: 12000, text: '⬇️ 천천히 내려가고 올라와요',          style: 'highlight' },
      { start_ms: 12000, end_ms: 22000, text: '💪 무릎이 발끝을 넘지 않게',           style: 'bold' },
      { start_ms: 22000, end_ms: 30000, text: '🔥 호흡 유지하며 끝까지',              style: 'highlight' },
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
        threshold: 0.65, guide_text: '천천히 내려가고 올라와요 ⬇️', anim_type: 'bounce',
      },
      {
        seq: 3, start_ms: 10000, end_ms: 18000,
        type: 'timing',
        threshold: 0.7, guide_text: '무릎이 발끝을 넘지 않게 💪', anim_type: 'bounce',
      },
      {
        seq: 4, start_ms: 18000, end_ms: 25000,
        type: 'timing',
        threshold: 0.75, guide_text: '힘내세요! 자세 유지 🔥', anim_type: 'shake',
      },
      {
        seq: 5, start_ms: 25000, end_ms: 30000,
        type: 'gesture', gesture_id: 'hands_up', gesture_emoji: '🙌',
        threshold: 0.6, guide_text: '완료! 양손 들어 만세 🏆', guide_emoji: '🏆', anim_type: 'float',
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
