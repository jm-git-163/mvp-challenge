/**
 * services/templateThumbnails.ts
 *
 * 자동 생성 — scripts/fetch-pixabay-thumbnails.js 로 재생성.
 * 각 템플릿 ID → Pixabay 큐레이션 이미지 URL (정적, CDN, 키 없음).
 * 출처 표기: Pixabay 무료 라이선스 (크레딧 불필요, 상업적 사용 가능).
 */

export interface TemplateThumb {
  url: string;       // webformat ~640px
  largeURL: string;  // full-res
  tags: string;
  user: string;
  pixabayId: number;
}

export const TEMPLATE_THUMBNAILS: Record<string, TemplateThumb> = {
  "daily-vlog-001": {
    "url": "https://pixabay.com/get/g5daae4d230ed783e466bbc82a2d759ce57abda2d42b234b6c4085a4e783dc0dc8ba9883c9a739649591643fd9974fc3f520fa6439b01dd337f895eb5b9007df0_640.jpg",
    "largeURL": "https://pixabay.com/get/g2e4f6f442a8dea5314452a3f633376808ec41d5b62803abff6106c1a0c5657e57587ca8249ad2cc2a6b1469b6554ca14bdb2056cdc1030500b81f1908b436c30_1280.jpg",
    "tags": "woman, young woman, excursion, holiday, gran canaria, canary islands, hat, phone, mobile phone, selfie, selfie, selfie, selfie, selfie, selfie",
    "user": "summerstock",
    "pixabayId": 1993219
  },
  "news-anchor-002": {
    "url": "https://pixabay.com/get/g408554d7d10b0a37765b936645a64cbf71d4ef33028612ae385881d8ff7d64ec75a784a79c7dba15b275219e3bc9b3860ebe46e7c77596fb90ed4be45a769684_640.jpg",
    "largeURL": "https://pixabay.com/get/g29bfd30b522e8388fe8b243d7c1efef99b49db32f114edd491e73338b827686c2ae23366c7d8ccef80f2e92e7ab22d3fdc7889d5af3b04ba13665b7851f370d4_1280.jpg",
    "tags": "tube microphone, dual tube microphone, gemini, recording, large diaphragm microphone, percussion, precise, studio, live sound, tour sound, rental company, audience, performing arts, concert, rock star, country music, singer, gemini, country music, country music, country music, country music, country music",
    "user": "tonischerrenberg",
    "pixabayId": 3780707
  },
  "english-lesson-003": {
    "url": "https://pixabay.com/get/gb09de625816925bc07b4b525e166f418a6cbdfbf129fd16e899796529f43c0701fabe87dcb1c28376a8a1ed82cbc540a8c82cc92bf64fb1a87cf66dd88a25c20_640.jpg",
    "largeURL": "https://pixabay.com/get/gd1f5d894fe0a0e4a64cd4fd746aa62088342a6451d0a14c122d612f8ddd205cbacfd462a5d53827b22f127d689363b4d6f537569d1702a64899024bc7de6019e_1280.jpg",
    "tags": "education, photo, language learning, glasses, read, english, hungarian, dictionary, research, school, study, book, attention, paper, diary, notes, notebook, to learn, note, text, language learning, dictionary, dictionary, dictionary, dictionary, dictionary",
    "user": "akirEVarga",
    "pixabayId": 4382169
  },
  "fairy-tale-004": {
    "url": "https://pixabay.com/get/gc5fac0e023f035b0de57cffc3e94dd95c5dff4a5cb99af7b244ec9acd56febd0246790366f47286173fa85a46556419bfab003884d5db9801eba8b029f02e261_640.jpg",
    "largeURL": "https://pixabay.com/get/g71790395777a0033c3c1e0ccedd7591769950a9892d269ccd4acd94a393f12e7ca4fc6e8d3f03535172cb8869168a91e98a1cd6a44dc31117a06dd0afa81be01_1280.jpg",
    "tags": "christmas, digital background, background, laptop wallpaper, rabbit, snow, hd wallpaper, winter, winter landscape, desktop backgrounds, full hd wallpaper, beautiful wallpaper, free wallpaper, 4k wallpaper, cool backgrounds, windows wallpaper, fairy tale, free background, fantasy, mac wallpaper, wallpaper hd, 4k wallpaper 1920x1080, nature, wallpaper 4k, christmas card",
    "user": "BiancaVanDijk",
    "pixabayId": 6723086
  },
  "travel-cert-005": {
    "url": "https://pixabay.com/get/g6571567ebd36cede014be5b68de1a5798ca272697828d0b34792a885a092eba5044056ed0d571720578d9f363b4b6c9ef9da6945f901ce8cc7eb6bd0c2c6bf24_640.jpg",
    "largeURL": "https://pixabay.com/get/g8b17c15708fdf11be10d3395e243987fff3380dbf2f64a56b51781bb8e068bcede9635dee30befaa6db53c1595723ed95ee7e827560abed6bbe42236ca7b8068_1280.jpg",
    "tags": "angkor, ruin, cambodia, temple, architecture, to travel, buddhism, asia, khmer, stone, unesco, archaeology, landmark, tourist, selfie, angkor, cambodia, cambodia, cambodia, khmer, khmer, khmer, khmer, khmer, archaeology, selfie",
    "user": "Sushuti",
    "pixabayId": 3741233
  },
  "product-unbox-006": {
    "url": "https://pixabay.com/get/ga7b47737a84b243cc653d4cace24dac0e6ad0ce58c81d34ef3304ee92e3ed15e4e074e57fdfc99e047b6ba9e836b6cab6f068e960786f4e4a9f7b3efbfb5a1fa_640.jpg",
    "largeURL": "https://pixabay.com/get/gbf0e1f5afba57fc0bee055c4443e0f7cba916dc536c3ba8188a1eba19a1e94720cfaf1d4c49ec45a6706fdee3aba89f899fad9283b26add9a717c785fc786723_1280.jpg",
    "tags": "space, wood, deliver, logistics, receive, transportation, business, logistic, transfer, courier, office, paper, pack, send, fragile, service, object, container, carton, box, storage, shipping, cardboard, parcel, package, brown office, brown box, brown service, logistics, courier, courier, box, box, box, parcel, parcel, parcel, parcel, parcel, package, package",
    "user": "ha11ok",
    "pixabayId": 4967335
  },
  "kpop-idol-007": {
    "url": "https://pixabay.com/get/gbba5c97cc0e020048814bf2a670fcc227ef72ea13e635f4aedfa113fba73a08b0fd6ce8bd9161a773961e824bfc60007fb41a115820f52adbf6888481cbb4824_640.jpg",
    "largeURL": "https://pixabay.com/get/gdea785032e4ca6de9f3e72d8f7192840851feb6fecd362137ad07e19515ed53d198f2a9018c421030619af31475d75a56ce452c3f783467d6631518982fcf8b2_1280.jpg",
    "tags": "concert, stage, band, singer, drums, guitar, microphone, black and white, live performance, crowd, musicians, musical, lighting, culture, artist, club, audience, emotions, energy, entertainment",
    "user": "MyriChagnon",
    "pixabayId": 10226175
  },
  "fitness-squat-master-008": {
    "url": "https://pixabay.com/get/ge32e5dbd3f4378fc336984e9c6bada77cf68ea575569c3fa920751c51e5f44848163d6e7a1d387fd3c1ee26c1a2d08ea62ebb216cf60c5828ab658ccaabd41b0_640.jpg",
    "largeURL": "https://pixabay.com/get/ga5b1194aa0c447890889775eaf07be300a1c89e8fd068191e5fad53ac504cca5daf4c39b314ffc0e1385aead0ae8c4b2227a2c5211584ab27b681ee8f025771e_1280.jpg",
    "tags": "woman, workout, fitness, fit, exercise, wellness, squats, sport, athletic, gym, active wear, squats, gym, gym, gym, gym, gym",
    "user": "u_us19rkvq",
    "pixabayId": 7539138
  },
  "english-speak-009": {
    "url": "https://pixabay.com/get/g7dc179984081e5d2e77d04d08c5ef66c87e48b71e7cacb7057eca4212e6cc2f5af3873669667b0454ea18cb53f4a27c46b8e41eaae0fb3942a4f98e9ae96a9da_640.jpg",
    "largeURL": "https://pixabay.com/get/ga95de94e85dbd79bf7c80c925af98f4cc3c997f67345bf8da666739063f4c5d6c9b0b5091fdaa9dacad0f77a68a9813646faacc03db918dda435c701ee9dde9f_1280.jpg",
    "tags": "chalkboard, slate, green, blackboard, education, wood, frame, framed, school, chalk, chalkboard, chalkboard, chalkboard, chalkboard, blackboard, blackboard, blackboard, blackboard, blackboard",
    "user": "4Me2Design",
    "pixabayId": 2629436
  },
  "kids-story-010": {
    "url": "https://pixabay.com/get/g156b9d4084ccd51f4d728c6bde76eccfe2450c2e33a0b5edd7a343450ddd2fa6089e2af4838d981d227270cf18ff91bfae032498f7da497f0cbfae59518f4140_640.jpg",
    "largeURL": "https://pixabay.com/get/g864d063ffb85829de4329a4b0f44161c605566853605170e566caee3187a733142b5041bd90cab46839e17682138a9e1b81b7ba8b384e33e0dbe4eb59915e705_1280.jpg",
    "tags": "children, books, reading, learning, preschool, graphics, infants, playing, babies, toddler, childhood, brown learning, brown reading, preschool, preschool, preschool, preschool, preschool",
    "user": "ParentiPacek",
    "pixabayId": 4624899
  },
  "travel-vlog-011": {
    "url": "https://pixabay.com/get/g7262c809b4747347ac8e0df19d6767467d0b5ba551fae8c277e8b46aa6a651f7d749b9304f4322296b2869159572b8fe_640.jpg",
    "largeURL": "https://pixabay.com/get/gf953bab708f778a917d73ecfe90c7ad05073a75c666aaf21a89745088fd0ce03b8fc9b36f1004ef6999b3e7312e4000433f9a4902d29f4c650edea07bd53a0b1_1280.jpg",
    "tags": "girl, camera, old, nature, retro, holds, travel, summer, photographer, old camera, holding",
    "user": "Alexsander-777",
    "pixabayId": 549154
  },
  "hiphop-cypher-012": {
    "url": "https://pixabay.com/get/gc882e6ff8287d8a675b0b74ef0506fe28971529e68cc1f9a0d2dfd7e8cfaa9761a23d02dbdf59cc804c967d1578635a47f1d50b7a6753acc8c7f424965686ee5_640.jpg",
    "largeURL": "https://pixabay.com/get/g86084680e87e11843c96d1cacdba0d496be98a024e7038c132f91edc2738e56033bd71ad825fd23e31af1a4f882b26fcb344b16e14919cff7e2bfdbcd9d98167_1280.jpg",
    "tags": "man, microphone, music, musician, recording, singer, rapper, rap, singing, audio equipment, recording studio, microphone, singer, singer, rapper, rapper, rapper, rap, rap, rap, rap, rap, singing, singing, singing, recording studio",
    "user": "Pexels",
    "pixabayId": 1845432
  },
  "fitness-squat-001": {
    "url": "https://pixabay.com/get/g0c108c49a3b180afc0f01aa6f49ee4b0eafb69d6b60143e900dfc4944c6f65dc48288bd556f3ec942ceddf4945cc3734_640.jpg",
    "largeURL": "https://pixabay.com/get/ge1cebec58a44db19c16b31238decb3743e46ba38ba320d4323fca0459b359d860e383f005bb05e0e32617087734c22f4e6c35b4d69400ce3b37500b92f9fdea8_1280.jpg",
    "tags": "legs, woman, skirt, the shade, heel shoes, tango shoes, dance, move, light, dance floor, parquet, dancer",
    "user": "pavstern",
    "pixabayId": 191543
  },
  "fitness-plank-001": {
    "url": "https://pixabay.com/get/g04b9ebd327e0aea93d23adc9b92afe1ea46076e2f8253e9f9817fe95ce0f3711de924e84c2323a82797f7a13eaec62bf4e72b4df977ed9de84c51e79ac7e77d4_640.jpg",
    "largeURL": "https://pixabay.com/get/g6a8fd83e5c20b997c311791a97259f25bcbfbd86b161689492f1ea906313132d814cd5da9401b0030b5e004b8fc0339f975964b86214936b6ad6f1c7ad30ca78_1280.jpg",
    "tags": "woman, crunches, sport, training, exercise, fit, fitness, wellness, body, abdominals, movement, sporty, active, condition, shoes, sneakers, health, healthy, sport, sport, exercise, exercise, exercise, exercise, fitness, fitness, fitness, fitness, fitness, health, health",
    "user": "5132824",
    "pixabayId": 2250970
  },
  "dance-kpop-001": {
    "url": "https://pixabay.com/get/g90a358d809c374951c89b4aa2c433566741d01443d0aa6ee7c4759f28103efb66629326dcca1ab46a8be7c62e6e0adb166b2b1837ec11566cad4c249e24780a3_640.jpg",
    "largeURL": "https://pixabay.com/get/g2a73e891350332647246fb8c8f1e281331068978b29c599baa49c971b2b80dc249f23018bdcb8cf0b3edc012544bc8a9c0f10d91217210c340fd999e4bb7842d_1280.jpg",
    "tags": "music, concert, night, guitarist, stage, performance, singer, artist, crowd, smoke, lighting, viral, rock, live, inspirational, live performance, musician, shadowy, electric guitar, musical group",
    "user": "Chandrak",
    "pixabayId": 9963662
  },
  "meditation-001": {
    "url": "https://pixabay.com/get/g8188c9055b3ec1ba3fd3bf04b655ab92d599450b14af8a6099d12b457072a4c82ff65f5da87842330fe65940cf51de37f462dc679528ddbaa8315ec20c6a01b6_640.jpg",
    "largeURL": "https://pixabay.com/get/gda21d7a0011aaf98d58b467485e2c3d97212a6c8424e9289184b296bb8414dbede6676773fce1238f835647ba10fb8d03c2b9ab10efb079a1160935f458962b5_1280.jpg",
    "tags": "people, woman, meditation, outdoor, relax, health, meditation, meditation, meditation, meditation, meditation, health, health, health",
    "user": "StockSnap",
    "pixabayId": 2564459
  },
  "fitness-pushup-001": {
    "url": "https://pixabay.com/get/g80ec547b6796273a2e32dd85df55a8d1b7ddfe2be293178cf70ed1427e0678a95dced3678ed4c62afb0b8b4f68a40150_640.jpg",
    "largeURL": "https://pixabay.com/get/g3b13a4131ccc295b426bcfdf5e08066c8fdbae48aa2ed341b1665c184e800e42857d8740d1fcc08d4906e9148117d6fbf9e64e843e5fcfdf66ed707788769fc9_1280.jpg",
    "tags": "crossfit, sports, fitness, training, exercise, athlete, young, healthy, workout, fit, muscular, body, people, strength, power, strong, female, sport, woman, athletic, girl, women, active, gym, exercising, weight lifting, weight, gray fitness, gray gym, gray exercise, gray training, gray healthy, gray workout, gray sports, gray body, gray power, sports, fitness, fitness, exercise, workout, sport, gym, gym, gym, gym, gym",
    "user": "Ichigo121212",
    "pixabayId": 534615
  },
  "dance-hiphop-001": {
    "url": "https://pixabay.com/get/g7cb9fc01e9d689c2d7394144c2852f70fe85d0b5990646fc8031e1c253bd2ca33bfe975b568990a61018640a4071ddeb_640.jpg",
    "largeURL": "https://pixabay.com/get/gefb2fff5186ee559a58ddf85322821805d43c72fcee1c5a22301f161b58fcef3d59ee825fafb574170b95158d05779d51b5ec3a04d2c3f9ffc2e68ec02a95621_1280.jpg",
    "tags": "tango argentino, few, move, music, to dance, people, dance style",
    "user": "joakant",
    "pixabayId": 688728
  },
  "fitness-squat-50": {
    "url": "https://pixabay.com/get/g3abaf7691a02e249f7298e270fd2f86f0fca622bb153c85efe42c9c5cae2bca66bdcdee179da753e2f1213da5a727c2c1a4fd23d750bb93d9a26266942fd2b75_640.jpg",
    "largeURL": "https://pixabay.com/get/gca143af1d7e2bfa6a205fceba57ce5b599a62864451b2b715a6f6987b094a6eea2b305a1193b385f716a3399b70d84d26a64012e65974cd5889399ace4127db0_1280.jpg",
    "tags": "fitness, woman, exercise, workout, fitness model, sports, yoga, stretching, trainer, personal trainer, sportswear, training, caucasian, workout, fitness model, yoga, stretching, stretching, stretching, trainer, trainer, personal trainer, personal trainer, personal trainer, personal trainer, sportswear, sportswear, sportswear, sportswear, sportswear",
    "user": "OlgaVolkovitskaia",
    "pixabayId": 6996771
  }
} as const;
