// Privacy policy text, kept here rather than in src/locales because it is long and
// structured. Languages without their own version (de, nl, zh) show the English one.
export type PolicyBlock = { text: string } | { items: { label?: string; text: string }[] };
export type PolicySection = { title: string; blocks: PolicyBlock[]; email?: boolean };
export type Policy = { title: string; updated: string; sections: PolicySection[] };

const fr: Policy = {
  title: "Politique de confidentialité",
  updated: "Dernière mise à jour : 4 novembre 2026",
  sections: [
    {
      title: "1. À propos",
      blocks: [
        {
          text: "JourneyPilot AI (\"nous\", \"l'application\") est une application de planification de voyages assistée par IA. Cette politique explique quelles données nous collectons, pourquoi, et comment vous pouvez les contrôler.",
        },
      ],
    },
    {
      title: "2. Données que nous collectons",
      blocks: [
        {
          items: [
            {
              label: "Compte :",
              text: "si vous créez un compte, nous stockons votre adresse e-mail et, si vous vous connectez avec Google, les informations de base de votre profil Google (nom, e-mail). Vous pouvez aussi utiliser l'application en tant qu'invité, sans créer de compte — une session anonyme est alors utilisée.",
            },
            {
              label: "Voyages :",
              text: "les informations que vous saisissez pour générer un itinéraire (destination, dates, budget, style de voyage, centres d'intérêt, préférences alimentaires, besoins d'accessibilité) et les itinéraires générés.",
            },
            {
              label: "Données techniques :",
              text: "des informations d'usage de base (pages visitées, type d'appareil) pour le bon fonctionnement et l'amélioration du service.",
            },
            {
              label: "Mesure d'audience (application mobile) :",
              text: "des événements d'utilisation (première ouverture, itinéraire généré, souscription d'un abonnement avec son montant et sa devise), un identifiant d'installation de l'application et, sur Android, l'identifiant publicitaire de l'appareil.",
            },
            {
              label: "Abonnements :",
              text: "l'état de votre abonnement Premium. Le paiement est traité par l'App Store ou Google Play : nous n'avons jamais accès à vos coordonnées bancaires.",
            },
          ],
        },
      ],
    },
    {
      title: "3. Comment nous utilisons ces données",
      blocks: [
        { text: "Vos données servent uniquement à :" },
        {
          items: [
            { text: "Générer et personnaliser vos itinéraires de voyage." },
            { text: "Sauvegarder vos voyages pour que vous puissiez les retrouver sur n'importe quel appareil." },
            { text: "Faire fonctionner et sécuriser l'application (authentification, prévention des abus)." },
            { text: "Gérer votre abonnement Premium." },
            {
              text: "Mesurer l'utilisation de l'application et l'efficacité de nos campagnes publicitaires (par exemple, savoir combien d'installations et d'abonnements proviennent d'une publicité).",
            },
          ],
        },
        { text: "Nous ne vendons jamais vos données personnelles." },
      ],
    },
    {
      title: "4. Services tiers",
      blocks: [
        {
          text: "Pour fonctionner, l'application partage certaines données (destination, préférences) avec les services suivants, uniquement dans la mesure nécessaire à la fonctionnalité concernée :",
        },
        {
          items: [
            { label: "Supabase / Lovable Cloud", text: "— hébergement de la base de données et de l'authentification." },
            {
              label: "Fournisseurs de modèles IA",
              text: "— génération du contenu de l'itinéraire (texte uniquement, pas de données d'identification directe).",
            },
            { label: "Google Maps / Places", text: "— photos de lieux, informations sur les hôtels/restaurants/activités." },
            { label: "OpenStreetMap (Nominatim), Photon", text: "— recherche et suggestion de villes/pays." },
            { label: "Wikimedia Commons", text: "— photos de lieux sous licence libre." },
            { label: "Google Sign-In, Sign in with Apple", text: "— connexion optionnelle par compte Google ou Apple." },
            {
              label: "Google Firebase Analytics",
              text: "— mesure d'audience de l'application mobile et mesure des conversions de nos campagnes Google Ads.",
            },
            { label: "RevenueCat", text: "— gestion des abonnements achetés via l'App Store ou Google Play." },
          ],
        },
      ],
    },
    {
      title: "5. Conservation des données",
      blocks: [
        {
          text: "Vos voyages et votre compte sont conservés tant que vous utilisez l'application. Vous pouvez supprimer votre compte et toutes vos données à tout moment depuis le menu du compte (\"Supprimer mon compte\"), ou en faire la demande par e-mail (voir Contact ci-dessous). Les données de mesure d'audience sont conservées au maximum 14 mois par Google Analytics.",
        },
      ],
    },
    {
      title: "6. Cookies et stockage local",
      blocks: [
        {
          text: "L'application utilise le stockage local de votre navigateur (localStorage/sessionStorage) pour maintenir votre session connectée, notamment via l'option \"Rester connecté\". Aucun cookie publicitaire tiers n'est utilisé sur le site web.",
        },
        {
          text: "Dans l'application mobile, Firebase Analytics utilise un identifiant d'installation et, sur Android, l'identifiant publicitaire. Vous pouvez réinitialiser ou supprimer l'identifiant publicitaire dans les paramètres de votre appareil (Paramètres → Google → Annonces). Sur iOS, l'application n'accède pas à l'identifiant publicitaire (IDFA).",
        },
      ],
    },
    {
      title: "7. Vos droits",
      blocks: [
        {
          text: "Vous pouvez accéder à, corriger ou supprimer vos données, ou retirer votre consentement à tout moment, en nous contactant à l'adresse ci-dessous.",
        },
      ],
    },
    {
      title: "8. Confidentialité des enfants",
      blocks: [
        { text: "L'application ne s'adresse pas aux enfants de moins de 13 ans et ne collecte pas sciemment de données les concernant." },
      ],
    },
    {
      title: "9. Modifications",
      blocks: [
        { text: "Cette politique peut être mise à jour occasionnellement. La date de dernière mise à jour figure en haut de cette page." },
      ],
    },
    {
      title: "10. Contact",
      blocks: [{ text: "Pour toute question ou demande relative à vos données :" }],
      email: true,
    },
  ],
};

const en: Policy = {
  title: "Privacy Policy",
  updated: "Last updated: November 4, 2026",
  sections: [
    {
      title: "1. About",
      blocks: [
        {
          text: "JourneyPilot AI (\"we\", \"the app\") is an AI-assisted travel planning app. This policy explains what data we collect, why, and how you can control it.",
        },
      ],
    },
    {
      title: "2. Data we collect",
      blocks: [
        {
          items: [
            {
              label: "Account:",
              text: "if you create an account, we store your email address and, if you sign in with Google, the basic information from your Google profile (name, email). You can also use the app as a guest without creating an account, in which case an anonymous session is used.",
            },
            {
              label: "Trips:",
              text: "the information you enter to generate an itinerary (destination, dates, budget, travel style, interests, food preferences, accessibility needs) and the generated itineraries.",
            },
            {
              label: "Technical data:",
              text: "basic usage information (pages visited, device type) to operate and improve the service.",
            },
            {
              label: "Audience measurement (mobile app):",
              text: "usage events (first open, itinerary generated, subscription purchase with its amount and currency), an app installation identifier and, on Android, the device's advertising ID.",
            },
            {
              label: "Subscriptions:",
              text: "the status of your Premium subscription. Payment is handled by the App Store or Google Play: we never have access to your banking details.",
            },
          ],
        },
      ],
    },
    {
      title: "3. How we use this data",
      blocks: [
        { text: "Your data is used only to:" },
        {
          items: [
            { text: "Generate and personalize your travel itineraries." },
            { text: "Save your trips so you can find them on any device." },
            { text: "Operate and secure the app (authentication, abuse prevention)." },
            { text: "Manage your Premium subscription." },
            {
              text: "Measure how the app is used and how effective our advertising campaigns are (for example, how many installs and subscriptions come from an ad).",
            },
          ],
        },
        { text: "We never sell your personal data." },
      ],
    },
    {
      title: "4. Third-party services",
      blocks: [
        {
          text: "To work, the app shares certain data (destination, preferences) with the following services, only to the extent needed for the feature concerned:",
        },
        {
          items: [
            { label: "Supabase / Lovable Cloud", text: "— database and authentication hosting." },
            { label: "AI model providers", text: "— generation of itinerary content (text only, no directly identifying data)." },
            { label: "Google Maps / Places", text: "— place photos, information on hotels, restaurants and activities." },
            { label: "OpenStreetMap (Nominatim), Photon", text: "— city and country search and suggestions." },
            { label: "Wikimedia Commons", text: "— freely licensed place photos." },
            { label: "Google Sign-In, Sign in with Apple", text: "— optional sign-in with a Google or Apple account." },
            {
              label: "Google Firebase Analytics",
              text: "— audience measurement for the mobile app and conversion measurement for our Google Ads campaigns.",
            },
            { label: "RevenueCat", text: "— management of subscriptions purchased through the App Store or Google Play." },
          ],
        },
      ],
    },
    {
      title: "5. Data retention",
      blocks: [
        {
          text: "Your trips and account are kept for as long as you use the app. You can delete your account and all your data at any time from the account menu (\"Delete account\"), or request it by email (see Contact below). Audience measurement data is kept by Google Analytics for up to 14 months.",
        },
      ],
    },
    {
      title: "6. Cookies and local storage",
      blocks: [
        {
          text: "The app uses your browser's local storage (localStorage/sessionStorage) to keep you signed in, notably through the \"Stay signed in\" option. No third-party advertising cookies are used on the website.",
        },
        {
          text: "In the mobile app, Firebase Analytics uses an installation identifier and, on Android, the advertising ID. You can reset or delete the advertising ID in your device settings (Settings → Google → Ads). On iOS, the app does not access the advertising identifier (IDFA).",
        },
      ],
    },
    {
      title: "7. Your rights",
      blocks: [
        {
          text: "You can access, correct or delete your data, or withdraw your consent at any time, by contacting us at the address below.",
        },
      ],
    },
    {
      title: "8. Children's privacy",
      blocks: [{ text: "The app is not intended for children under 13 and does not knowingly collect data about them." }],
    },
    {
      title: "9. Changes",
      blocks: [{ text: "This policy may be updated occasionally. The date of the last update appears at the top of this page." }],
    },
    {
      title: "10. Contact",
      blocks: [{ text: "For any question or request about your data:" }],
      email: true,
    },
  ],
};

const ar: Policy = {
  title: "سياسة الخصوصية",
  updated: "آخر تحديث: 4 نوفمبر 2026",
  sections: [
    {
      title: "1. نبذة عنا",
      blocks: [
        {
          text: "JourneyPilot AI (\"نحن\"، \"التطبيق\") هو تطبيق لتخطيط الرحلات بمساعدة الذكاء الاصطناعي. توضح هذه السياسة البيانات التي نجمعها وسبب جمعها وكيف يمكنك التحكم فيها.",
        },
      ],
    },
    {
      title: "2. البيانات التي نجمعها",
      blocks: [
        {
          items: [
            {
              label: "الحساب:",
              text: "إذا أنشأت حسابًا، نحفظ عنوان بريدك الإلكتروني، وإذا سجّلت الدخول عبر Google، نحفظ المعلومات الأساسية من ملفك الشخصي في Google (الاسم والبريد الإلكتروني). يمكنك أيضًا استخدام التطبيق كضيف دون إنشاء حساب، وفي هذه الحالة تُستخدم جلسة مجهولة.",
            },
            {
              label: "الرحلات:",
              text: "المعلومات التي تُدخلها لإنشاء خط سير الرحلة (الوجهة والتواريخ والميزانية ونمط السفر والاهتمامات والتفضيلات الغذائية واحتياجات إمكانية الوصول) وخطوط السير التي يتم إنشاؤها.",
            },
            {
              label: "البيانات التقنية:",
              text: "معلومات أساسية عن الاستخدام (الصفحات التي تمت زيارتها ونوع الجهاز) لتشغيل الخدمة وتحسينها.",
            },
            {
              label: "قياس الجمهور (تطبيق الهاتف):",
              text: "أحداث الاستخدام (أول فتح للتطبيق، إنشاء خط سير، الاشتراك مع مبلغه وعملته)، ومعرّف لتثبيت التطبيق، ومعرّف الإعلانات الخاص بالجهاز على Android.",
            },
            {
              label: "الاشتراكات:",
              text: "حالة اشتراكك في Premium. تتم معالجة الدفع عبر App Store أو Google Play، ولا يمكننا أبدًا الوصول إلى بياناتك المصرفية.",
            },
          ],
        },
      ],
    },
    {
      title: "3. كيف نستخدم هذه البيانات",
      blocks: [
        { text: "تُستخدم بياناتك فقط من أجل:" },
        {
          items: [
            { text: "إنشاء خطوط سير رحلاتك وتخصيصها." },
            { text: "حفظ رحلاتك لتتمكن من الوصول إليها من أي جهاز." },
            { text: "تشغيل التطبيق وتأمينه (المصادقة ومنع إساءة الاستخدام)." },
            { text: "إدارة اشتراكك في Premium." },
            {
              text: "قياس استخدام التطبيق وفعالية حملاتنا الإعلانية (مثل معرفة عدد عمليات التثبيت والاشتراكات الناتجة عن إعلان).",
            },
          ],
        },
        { text: "نحن لا نبيع بياناتك الشخصية أبدًا." },
      ],
    },
    {
      title: "4. خدمات الجهات الخارجية",
      blocks: [
        {
          text: "لكي يعمل التطبيق، فإنه يشارك بعض البيانات (الوجهة والتفضيلات) مع الخدمات التالية، وذلك بالقدر اللازم للميزة المعنية فقط:",
        },
        {
          items: [
            { label: "Supabase / Lovable Cloud", text: "— استضافة قاعدة البيانات والمصادقة." },
            { label: "مزوّدو نماذج الذكاء الاصطناعي", text: "— إنشاء محتوى خط السير (نص فقط، دون بيانات تعريف مباشرة)." },
            { label: "Google Maps / Places", text: "— صور الأماكن ومعلومات عن الفنادق والمطاعم والأنشطة." },
            { label: "OpenStreetMap (Nominatim), Photon", text: "— البحث عن المدن والدول واقتراحها." },
            { label: "Wikimedia Commons", text: "— صور أماكن بترخيص حر." },
            { label: "Google Sign-In, Sign in with Apple", text: "— تسجيل دخول اختياري بحساب Google أو Apple." },
            {
              label: "Google Firebase Analytics",
              text: "— قياس جمهور تطبيق الهاتف وقياس التحويلات لحملاتنا على Google Ads.",
            },
            { label: "RevenueCat", text: "— إدارة الاشتراكات المشتراة عبر App Store أو Google Play." },
          ],
        },
      ],
    },
    {
      title: "5. الاحتفاظ بالبيانات",
      blocks: [
        {
          text: "نحتفظ برحلاتك وحسابك طالما كنت تستخدم التطبيق. يمكنك حذف حسابك وجميع بياناتك في أي وقت من قائمة الحساب (\"حذف الحساب\")، أو طلب ذلك عبر البريد الإلكتروني (انظر قسم التواصل أدناه). تحتفظ Google Analytics ببيانات قياس الجمهور لمدة أقصاها 14 شهرًا.",
        },
      ],
    },
    {
      title: "6. ملفات تعريف الارتباط والتخزين المحلي",
      blocks: [
        {
          text: "يستخدم التطبيق التخزين المحلي في متصفحك (localStorage/sessionStorage) لإبقائك مسجّلًا للدخول، وبخاصة عبر خيار \"البقاء متصلاً\". لا تُستخدم أي ملفات تعريف ارتباط إعلانية تابعة لجهات خارجية على الموقع الإلكتروني.",
        },
        {
          text: "في تطبيق الهاتف، تستخدم Firebase Analytics معرّفًا للتثبيت، ومعرّف الإعلانات على Android. يمكنك إعادة تعيين معرّف الإعلانات أو حذفه من إعدادات جهازك (الإعدادات ← Google ← الإعلانات). على iOS، لا يصل التطبيق إلى معرّف الإعلانات (IDFA).",
        },
      ],
    },
    {
      title: "7. حقوقك",
      blocks: [
        { text: "يمكنك الوصول إلى بياناتك أو تصحيحها أو حذفها، أو سحب موافقتك في أي وقت، عبر التواصل معنا على العنوان أدناه." },
      ],
    },
    {
      title: "8. خصوصية الأطفال",
      blocks: [{ text: "التطبيق غير موجّه للأطفال دون سن 13 عامًا، ولا يجمع عن قصد أي بيانات تخصهم." }],
    },
    {
      title: "9. التعديلات",
      blocks: [{ text: "قد يتم تحديث هذه السياسة من حين لآخر. يظهر تاريخ آخر تحديث في أعلى هذه الصفحة." }],
    },
    {
      title: "10. التواصل",
      blocks: [{ text: "لأي سؤال أو طلب يتعلق ببياناتك:" }],
      email: true,
    },
  ],
};

const POLICIES: Record<string, Policy> = { fr, en, ar };

export function privacyPolicyFor(language: string | undefined) {
  return POLICIES[language?.split("-")[0] ?? "en"] ?? en;
}
