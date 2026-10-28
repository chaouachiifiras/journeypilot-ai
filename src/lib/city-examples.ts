/**
 * A few well-known cities per country (ISO 3166-1 alpha-2), shown as the
 * planner's city placeholder once a country is picked, so the hint matches
 * the chosen destination instead of a fixed "Kyoto, Marrakech, Rome…".
 * Countries not listed fall back to a generic "type a city" hint.
 *
 * Each city is [English, Arabic, Chinese, French/German/Dutch names where
 * they differ from the English one].
 */
type Localized = Partial<Record<"fr" | "de" | "nl", string>>;
type City = readonly [en: string, ar: string, zh: string, other?: Localized];

const CITY_EXAMPLES: Record<string, readonly City[]> = {
  AE: [["Dubai", "دبي", "迪拜", { fr: "Dubaï" }], ["Abu Dhabi", "أبوظبي", "阿布扎比"], ["Sharjah", "الشارقة", "沙迦", { fr: "Charjah" }]],
  AR: [["Buenos Aires", "بوينس آيرس", "布宜诺斯艾利斯"], ["Mendoza", "مندوزا", "门多萨"], ["Bariloche", "باريلوتشي", "巴里洛切"]],
  AT: [["Vienna", "فيينا", "维也纳", { fr: "Vienne", de: "Wien", nl: "Wenen" }], ["Salzburg", "سالزبورغ", "萨尔茨堡", { fr: "Salzbourg" }], ["Innsbruck", "إنسبروك", "因斯布鲁克"]],
  AU: [["Sydney", "سيدني", "悉尼"], ["Melbourne", "ملبورن", "墨尔本"], ["Brisbane", "بريزبن", "布里斯班"]],
  BE: [["Brussels", "بروكسل", "布鲁塞尔", { fr: "Bruxelles", de: "Brüssel", nl: "Brussel" }], ["Bruges", "بروج", "布鲁日", { de: "Brügge", nl: "Brugge" }], ["Ghent", "غنت", "根特", { fr: "Gand", de: "Gent", nl: "Gent" }]],
  BR: [["Rio de Janeiro", "ريو دي جانيرو", "里约热内卢"], ["São Paulo", "ساو باولو", "圣保罗"], ["Salvador", "سلفادور", "萨尔瓦多"]],
  CA: [["Montreal", "مونتريال", "蒙特利尔", { fr: "Montréal" }], ["Vancouver", "فانكوفر", "温哥华"], ["Toronto", "تورونتو", "多伦多"]],
  CH: [["Zurich", "زيورخ", "苏黎世", { de: "Zürich" }], ["Geneva", "جنيف", "日内瓦", { fr: "Genève", de: "Genf", nl: "Genève" }], ["Lucerne", "لوسيرن", "卢塞恩", { de: "Luzern", nl: "Luzern" }]],
  CL: [["Santiago", "سانتياغو", "圣地亚哥"], ["Valparaíso", "فالبارايسو", "瓦尔帕莱索"], ["San Pedro de Atacama", "سان بيدرو دي أتاكاما", "阿塔卡马圣佩德罗"]],
  CN: [["Beijing", "بكين", "北京", { fr: "Pékin", de: "Peking", nl: "Peking" }], ["Shanghai", "شنغهاي", "上海"], ["Xi'an", "شيان", "西安"]],
  CO: [["Bogotá", "بوغوتا", "波哥大"], ["Cartagena", "قرطاجنة", "卡塔赫纳", { fr: "Carthagène" }], ["Medellín", "ميديلين", "麦德林"]],
  CR: [["San José", "سان خوسيه", "圣何塞"], ["La Fortuna", "لا فورتونا", "拉福图纳"], ["Tamarindo", "تاماريندو", "塔马林多"]],
  CU: [["Havana", "هافانا", "哈瓦那", { fr: "La Havane", de: "Havanna" }], ["Trinidad", "ترينيداد", "特立尼达"], ["Viñales", "فينياليس", "比尼亚莱斯"]],
  CZ: [["Prague", "براغ", "布拉格", { de: "Prag", nl: "Praag" }], ["Český Krumlov", "تشيسكي كروملوف", "克鲁姆洛夫"], ["Brno", "برنو", "布尔诺"]],
  DE: [["Berlin", "برلين", "柏林"], ["Munich", "ميونخ", "慕尼黑", { de: "München", nl: "München" }], ["Hamburg", "هامبورغ", "汉堡", { fr: "Hambourg" }]],
  DK: [["Copenhagen", "كوبنهاغن", "哥本哈根", { fr: "Copenhague", de: "Kopenhagen", nl: "Kopenhagen" }], ["Aarhus", "آرهوس", "奥胡斯"], ["Odense", "أودنسه", "欧登塞"]],
  DZ: [["Algiers", "الجزائر العاصمة", "阿尔及尔", { fr: "Alger", de: "Algier" }], ["Oran", "وهران", "奥兰"], ["Constantine", "قسنطينة", "君士坦丁"]],
  EG: [["Cairo", "القاهرة", "开罗", { fr: "Le Caire", de: "Kairo", nl: "Caïro" }], ["Luxor", "الأقصر", "卢克索", { fr: "Louxor" }], ["Alexandria", "الإسكندرية", "亚历山大", { fr: "Alexandrie", nl: "Alexandrië" }]],
  ES: [["Barcelona", "برشلونة", "巴塞罗那", { fr: "Barcelone" }], ["Madrid", "مدريد", "马德里"], ["Seville", "إشبيلية", "塞维利亚", { fr: "Séville", de: "Sevilla", nl: "Sevilla" }]],
  FI: [["Helsinki", "هلسنكي", "赫尔辛基"], ["Rovaniemi", "روفانيمي", "罗瓦涅米"], ["Turku", "توركو", "图尔库"]],
  FR: [["Paris", "باريس", "巴黎"], ["Lyon", "ليون", "里昂"], ["Nice", "نيس", "尼斯", { de: "Nizza" }]],
  GB: [["London", "لندن", "伦敦", { fr: "Londres", nl: "Londen" }], ["Edinburgh", "إدنبرة", "爱丁堡", { fr: "Édimbourg" }], ["Manchester", "مانشستر", "曼彻斯特"]],
  GR: [["Athens", "أثينا", "雅典", { fr: "Athènes", de: "Athen", nl: "Athene" }], ["Santorini", "سانتوريني", "圣托里尼", { fr: "Santorin", de: "Santorin" }], ["Thessaloniki", "سالونيك", "塞萨洛尼基", { fr: "Thessalonique" }]],
  HR: [["Dubrovnik", "دوبروفنيك", "杜布罗夫尼克"], ["Split", "سبليت", "斯普利特"], ["Zagreb", "زغرب", "萨格勒布"]],
  HU: [["Budapest", "بودابست", "布达佩斯"], ["Eger", "إيغر", "埃格尔"], ["Pécs", "بيتش", "佩奇"]],
  ID: [["Bali", "بالي", "巴厘岛"], ["Jakarta", "جاكرتا", "雅加达"], ["Yogyakarta", "يوغياكارتا", "日惹"]],
  IE: [["Dublin", "دبلن", "都柏林"], ["Galway", "غالواي", "戈尔韦"], ["Cork", "كورك", "科克"]],
  IN: [["Delhi", "دلهي", "德里"], ["Jaipur", "جايبور", "斋浦尔"], ["Mumbai", "مومباي", "孟买", { fr: "Bombay" }]],
  IS: [["Reykjavik", "ريكيافيك", "雷克雅未克"], ["Akureyri", "أكوريري", "阿克雷里"], ["Vík", "فيك", "维克"]],
  IT: [["Rome", "روما", "罗马", { de: "Rom" }], ["Florence", "فلورنسا", "佛罗伦萨", { de: "Florenz" }], ["Venice", "البندقية", "威尼斯", { fr: "Venise", de: "Venedig", nl: "Venetië" }]],
  JO: [["Amman", "عمّان", "安曼"], ["Petra", "البتراء", "佩特拉", { fr: "Pétra" }], ["Aqaba", "العقبة", "亚喀巴"]],
  JP: [["Tokyo", "طوكيو", "东京", { de: "Tokio", nl: "Tokio" }], ["Kyoto", "كيوتو", "京都"], ["Osaka", "أوساكا", "大阪"]],
  KR: [["Seoul", "سيول", "首尔", { fr: "Séoul" }], ["Busan", "بوسان", "釜山"], ["Jeju", "جيجو", "济州"]],
  LB: [["Beirut", "بيروت", "贝鲁特", { fr: "Beyrouth" }], ["Byblos", "جبيل", "比布鲁斯"], ["Batroun", "البترون", "巴特伦"]],
  MA: [["Marrakech", "مراكش", "马拉喀什", { de: "Marrakesch" }], ["Fes", "فاس", "非斯", { fr: "Fès" }], ["Chefchaouen", "شفشاون", "舍夫沙万"]],
  MT: [["Valletta", "فاليتا", "瓦莱塔", { fr: "La Valette" }], ["Sliema", "سليمة", "斯利马"], ["Mdina", "مدينا", "姆迪纳"]],
  MV: [["Malé", "ماليه", "马累"], ["Maafushi", "مافوشي", "马富士岛"], ["Hulhumalé", "هولهومالي", "胡鲁马累"]],
  MX: [["Mexico City", "مكسيكو سيتي", "墨西哥城", { fr: "Mexico", de: "Mexiko-Stadt", nl: "Mexico-Stad" }], ["Cancún", "كانكون", "坎昆"], ["Oaxaca", "أواكساكا", "瓦哈卡"]],
  MY: [["Kuala Lumpur", "كوالالمبور", "吉隆坡"], ["Penang", "بينانغ", "槟城"], ["Langkawi", "لنكاوي", "兰卡威"]],
  NL: [["Amsterdam", "أمستردام", "阿姆斯特丹"], ["Rotterdam", "روتردام", "鹿特丹"], ["Utrecht", "أوترخت", "乌得勒支"]],
  NO: [["Oslo", "أوسلو", "奥斯陆"], ["Bergen", "بيرغن", "卑尔根"], ["Tromsø", "ترومسو", "特罗姆瑟"]],
  NZ: [["Auckland", "أوكلاند", "奥克兰"], ["Queenstown", "كوينزتاون", "皇后镇"], ["Wellington", "ويلينغتون", "惠灵顿"]],
  OM: [["Muscat", "مسقط", "马斯喀特", { fr: "Mascate", de: "Maskat" }], ["Nizwa", "نزوى", "尼兹瓦"], ["Salalah", "صلالة", "塞拉莱"]],
  PE: [["Cusco", "كوسكو", "库斯科"], ["Lima", "ليما", "利马"], ["Arequipa", "أريكيبا", "阿雷基帕"]],
  PH: [["Manila", "مانيلا", "马尼拉", { fr: "Manille" }], ["Cebu", "سيبو", "宿务"], ["El Nido", "إل نيدو", "爱妮岛"]],
  PL: [["Kraków", "كراكوف", "克拉科夫", { fr: "Cracovie", de: "Krakau", nl: "Krakau" }], ["Warsaw", "وارسو", "华沙", { fr: "Varsovie", de: "Warschau", nl: "Warschau" }], ["Gdańsk", "غدانسك", "格但斯克", { de: "Danzig" }]],
  PT: [["Lisbon", "لشبونة", "里斯本", { fr: "Lisbonne", de: "Lissabon", nl: "Lissabon" }], ["Porto", "بورتو", "波尔图"], ["Lagos", "لاغوس", "拉古什"]],
  QA: [["Doha", "الدوحة", "多哈"], ["Al Wakrah", "الوكرة", "沃克拉"], ["Al Khor", "الخور", "豪尔"]],
  RO: [["Bucharest", "بوخارست", "布加勒斯特", { fr: "Bucarest", de: "Bukarest", nl: "Boekarest" }], ["Brașov", "براشوف", "布拉索夫"], ["Cluj-Napoca", "كلوج نابوكا", "克卢日-纳波卡"]],
  SA: [["Riyadh", "الرياض", "利雅得", { fr: "Riyad", de: "Riad" }], ["Jeddah", "جدة", "吉达", { fr: "Djeddah", de: "Dschidda" }], ["AlUla", "العلا", "欧拉"]],
  SE: [["Stockholm", "ستوكهولم", "斯德哥尔摩"], ["Gothenburg", "غوتنبرغ", "哥德堡", { fr: "Göteborg", de: "Göteborg", nl: "Göteborg" }], ["Malmö", "مالمو", "马尔默"]],
  SG: [["Singapore", "سنغافورة", "新加坡", { fr: "Singapour", de: "Singapur" }]],
  SN: [["Dakar", "داكار", "达喀尔"], ["Saint-Louis", "سان لوي", "圣路易"], ["Saly", "سالي", "萨利"]],
  TH: [["Bangkok", "بانكوك", "曼谷"], ["Chiang Mai", "شيانغ ماي", "清迈"], ["Phuket", "بوكيت", "普吉岛"]],
  TN: [["Tunis", "تونس", "突尼斯"], ["Sousse", "سوسة", "苏塞"], ["Djerba", "جربة", "杰尔巴岛"]],
  TR: [["Istanbul", "إسطنبول", "伊斯坦布尔"], ["Cappadocia", "كابادوكيا", "卡帕多奇亚", { fr: "Cappadoce", de: "Kappadokien", nl: "Cappadocië" }], ["Antalya", "أنطاليا", "安塔利亚"]],
  US: [["New York", "نيويورك", "纽约"], ["San Francisco", "سان فرانسيسكو", "旧金山"], ["Miami", "ميامي", "迈阿密"]],
  VN: [["Hanoi", "هانوي", "河内"], ["Ho Chi Minh City", "مدينة هو تشي منه", "胡志明市", { fr: "Hô Chi Minh-Ville", de: "Ho-Chi-Minh-Stadt", nl: "Ho Chi Minhstad" }], ["Hoi An", "هوي آن", "会安"]],
  ZA: [["Cape Town", "كيب تاون", "开普敦", { fr: "Le Cap", de: "Kapstadt", nl: "Kaapstad" }], ["Johannesburg", "جوهانسبرغ", "约翰内斯堡", { fr: "Johannesbourg" }], ["Durban", "ديربان", "德班"]],
};

function cityName([en, ar, zh, other]: City, lang: string) {
  if (lang === "ar") return ar;
  if (lang === "zh") return zh;
  return other?.[lang as keyof Localized] ?? en;
}

/** "Rome, Florence, Venice…" in the UI language for a country code, or null when none are known. */
export function cityExamplesFor(countryCode: string | null, lang: string): string | null {
  const cities = countryCode ? CITY_EXAMPLES[countryCode.toUpperCase()] : undefined;
  if (!cities?.length) return null;
  const base = lang.split("-")[0] ?? "en";
  const sep = base === "ar" ? "، " : base === "zh" ? "、" : ", ";
  return `${cities.map((c) => cityName(c, base)).join(sep)}…`;
}
