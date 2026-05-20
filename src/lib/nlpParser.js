// Hebrew NLP Parser for Smart Dishwasher Scheduling
// Built for absolute local reliability, privacy, speed, and zero API costs.

const APPLIANCES = {
  DAIRY: {
    id: '401020522686007368',
    name: 'מדיח חלבי 🥛',
    nameHe: 'מדיח חלבי',
    type: 'dishwasher'
  },
  MEATY: {
    id: '403120522686006531',
    name: 'מדיח בשרי 🥩',
    nameHe: 'מדיח בשרי',
    type: 'dishwasher'
  },
  COFFEE: {
    id: '9103117a-3163-4aa6-a4fb-b0a50acf832a',
    name: 'מכונת קפה ☕',
    nameHe: 'מכונת קפה',
    type: 'coffee'
  }
};

const PROGRAMS = {
  Eco50: { key: 'Dishcare.Dishwasher.Program.Eco50', name: 'חיסכון (Eco 50°C)' },
  Auto2: { key: 'Dishcare.Dishwasher.Program.Auto2', name: 'אוטומטי (Auto 45-65°C)' },
  Intensiv70: { key: 'Dishcare.Dishwasher.Program.Intensiv70', name: 'אינטנסיבי (Intensive 70°C)' },
  Quick65: { key: 'Dishcare.Dishwasher.Program.Quick65', name: 'מהיר שעה (Quick 65°C)' },
  PreRinse: { key: 'Dishcare.Dishwasher.Program.PreRinse', name: 'שטיפה מוקדמת (Pre-Rinse)' },
  MachineCare: { key: 'Dishcare.Dishwasher.Program.MachineCare', name: 'ניקוי מכונה (Machine Care)' }
};

const COFFEE_PROGRAMS = {
  Full: { key: 'coffee.full', name: 'הדלקה + הכנה + כיבוי' },
  BrewOnly: { key: 'coffee.brew_only', name: 'הכנת קפה בלבד' }
};

const HEBREW_NUMBERS = {
  'אחת': 1, 'שתיים': 2, 'שתים': 2, 'שלוש': 3, 'ארבע': 4, 'חמש': 5, 
  'שש': 6, 'שבע': 7, 'שמונה': 8, 'תשע': 9, 'עשר': 10, 
  'אחת עשרה': 11, 'אחת-עשרה': 11, 'שתים עשרה': 12, 'שתים-עשרה': 12
};

export function parseText(text, coffeeMode) {
  if (!text || !text.trim()) {
    return {
      device: APPLIANCES.DAIRY,
      program: PROGRAMS.Quick65,
      date: null,
      dateStr: null,
      time: null,
      isCoffee: false,
      rawText: ''
    };
  }

  text = text.toLowerCase().trim();
  const isCoffee = text.startsWith('קפה');
  const result = {
    device: null,
    program: null,
    date: null,
    dateStr: null,
    time: null,
    isCoffee,
    rawText: text
  };

  // 1. Device Identification
  if (isCoffee) {
    result.device = APPLIANCES.COFFEE;
    result.program = coffeeMode === 'brew_only' ? COFFEE_PROGRAMS.BrewOnly : COFFEE_PROGRAMS.Full;
    text = text.replace(/^קפה\s*/, '');
  } else if (text.includes('חלבי') || text.includes('milky') || text.includes('dairy')) {
    result.device = APPLIANCES.DAIRY;
  } else if (text.includes('בשרי') || text.includes('meat') || text.includes('meaty')) {
    result.device = APPLIANCES.MEATY;
  }

  // 2. Program Identification (skip for coffee — already set above)
  if (isCoffee) {
    // no-op: coffee program is set during device identification
  } else if (text.includes('מהיר') || text.includes('מהירה') || text.includes('שעה') || text.includes('quick')) {
    result.program = PROGRAMS.Quick65;
  } else if (text.includes('חיסכון') || text.includes('אקו') || text.includes('eco') || text.includes('הכי חסכוני')) {
    result.program = PROGRAMS.Eco50;
  } else if (text.includes('אוטומט') || text.includes('אוטומטית') || text.includes('auto')) {
    result.program = PROGRAMS.Auto2;
  } else if (text.includes('אינטנסיבי') || text.includes('אינטנסיבית') || text.includes('חזק') || text.includes('70')) {
    result.program = PROGRAMS.Intensiv70;
  } else if (text.includes('שטיפה') || text.includes('pre-rinse') || text.includes('pre rinse')) {
    result.program = PROGRAMS.PreRinse;
  } else if (text.includes('ניקוי מכונה') || text.includes('machine care')) {
    result.program = PROGRAMS.MachineCare;
  }

  // 3. Date Parsing
  const today = new Date();
  let targetDate = new Date(today);

  if (text.includes('היום') || text.includes('הערב היום') || text.includes('הלילה היום')) {
    result.dateStr = 'היום';
  } else if (text.includes('מחר') || text.includes('למחר')) {
    targetDate.setDate(today.getDate() + 1);
    result.dateStr = 'מחר';
  } else if (text.includes('מחרתיים') || text.includes('מחרתים')) {
    targetDate.setDate(today.getDate() + 2);
    result.dateStr = 'מחרתיים';
  } else {
    // Check for days of the week: "ביום ראשון", "ביום שני", etc.
    const weekDays = [
      { names: ['ראשון', 'בראשון'], dayIndex: 0 },
      { names: ['שני', 'בשני'], dayIndex: 1 },
      { names: ['שלישי', 'בשלישי'], dayIndex: 2 },
      { names: ['רביעי', 'ברביעי'], dayIndex: 3 },
      { names: ['חמישי', 'בחמישי'], dayIndex: 4 },
      { names: ['שישי', 'בשישי'], dayIndex: 5 },
      { names: ['שבת', 'בשבת'], dayIndex: 6 }
    ];

    for (let day of weekDays) {
      if (day.names.some(name => text.includes(name))) {
        const currentDayIndex = today.getDay(); // 0 is Sunday
        let diff = day.dayIndex - currentDayIndex;
        if (diff <= 0) diff += 7; // Get next week's day
        targetDate.setDate(today.getDate() + diff);
        result.dateStr = 'יום ' + day.names[0].replace('ב', '');
        break;
      }
    }
  }
  
  // Format YYYY-MM-DD
  const formattedDate = targetDate.getFullYear() + '-' + 
                        String(targetDate.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(targetDate.getDate()).padStart(2, '0');
  result.date = formattedDate;

  // 4. Time Parsing (Hours & Minutes)
  let hour = null;
  let minute = 0; // Default to top of the hour
  let matched = false;
  let matchIndex = -1;
  let matchLength = 0;

  // Step 4.1: Check for explicit digital times with colon, e.g. "ב-14:30", "בשעה 14:30", "9:32", "09:32"
  const colonTimeReg = /(?:ב(?:\s*|-)|בשעה\s+|\b)(\d{1,2}):(\d{2})(?![0-9])/;
  const colonMatch = text.match(colonTimeReg);
  if (colonMatch) {
    hour = parseInt(colonMatch[1]);
    minute = parseInt(colonMatch[2]);
    matched = true;
  }

  // Step 4.2: If no colon match, let's find the hour first
  if (!matched) {
    // Check for written hour words first (e.g. "בתשע", "בשתיים")
    for (let word in HEBREW_NUMBERS) {
      // Using Unicode Lookaround to replace \b for Hebrew characters!
      const wordReg = new RegExp('(?<![\\u0590-\\u05FF])(?:בשעה\\s+|ב|)(' + word + ')(?![\\u0590-\\u05FF])');
      const wordMatch = text.match(wordReg);
      if (wordMatch) {
        hour = HEBREW_NUMBERS[word];
        matched = true;
        matchIndex = wordMatch.index;
        matchLength = wordMatch[0].length;
        break;
      }
    }

    // If still not matched, check for plain digit hour patterns like "ב-9", "בשעה 9", "ב 2"
    if (!matched) {
      const digitHourReg = /(?:ב(?:\s*|-)|בשעה\s+)(\d{1,2})(?![0-9])/;
      const digitMatch = text.match(digitHourReg);
      if (digitMatch) {
        hour = parseInt(digitMatch[1]);
        matched = true;
        matchIndex = digitMatch.index;
        matchLength = digitMatch[0].length;
      }
    }

    // Step 4.3: If we matched an hour (either word or digit), check for minutes following it!
    if (matched && hour !== null && matchIndex !== -1) {
      const remainingText = text.substring(matchIndex + matchLength).trim();

      // Check for digit minutes like "תשע 32", "תשע ו-32", "9 ו32"
      const digitMinutesReg = /^(?:\s*ו\s*|-|\s*)(\d{1,2})(?![0-9])/;
      const minMatch = remainingText.match(digitMinutesReg);
      if (minMatch) {
        minute = parseInt(minMatch[1]);
      } else {
        // Check for common written minutes
        const writtenMinutes = [
          { words: ['וחצי', 'ושלושים', 'ושלושים דקות'], val: 30 },
          { words: ['ורבע', 'וחמש עשרה', 'וחמש עשרה דקות'], val: 15 },
          { words: ['ושלושים וחמש', 'ושלושים וחמישה'], val: 35 },
          { words: ['ועשרים וחמש', 'ועשרים וחמישה'], val: 25 },
          { words: ['ועשרים', 'ועשרים דקות'], val: 20 },
          { words: ['וחמישה', 'וחמש', 'וחמש דקות', 'וחמישה דקות'], val: 5 },
          { words: ['ועשרה', 'ועשר', 'ועשר דקות', 'ועשרה דקות'], val: 10 },
          { words: ['וארבעים וחמש', 'וארבעים וחמישה'], val: 45 },
          { words: ['וארבעים', 'וארבעים דקות'], val: 40 },
          { words: ['וחמישים וחמש', 'וחמישים וחמישה'], val: 55 },
          { words: ['וחמישים', 'וחמישים דקות'], val: 50 }
        ];

        for (let minOpt of writtenMinutes) {
          if (minOpt.words.some(w => remainingText.startsWith(w) || remainingText.startsWith(' ' + w))) {
            minute = minOpt.val;
            break;
          }
        }
      }
    }
  }

  // Adjust AM/PM based on context
  if (hour !== null) {
    if (hour <= 12) {
      if (text.includes('צהריים') || text.includes('צהרים') || text.includes('אחהצ') || text.includes('אחר הצהריים') || text.includes('הצהריים')) {
        if (hour < 12) hour += 12; // 2 in afternoon -> 14:00
      } else if (text.includes('ערב') || text.includes('בלילה') || text.includes('לילה')) {
        // "שתיים בלילה" -> 2 AM (02:00) so keep 2.
        // "שמונה בערב" -> 8 PM (20:00) so add 12.
        // "עשר בלילה" -> 10 PM (22:00) so add 12.
        if (hour >= 6 && hour < 12) {
          hour += 12;
        }
      }
    }
    
    result.time = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');

    // Roll over to tomorrow if the parsed time today has already passed and no explicit day was specified
    if (!result.dateStr) {
      const currentHour = today.getHours();
      const currentMinute = today.getMinutes();
      
      if (hour < currentHour || (hour === currentHour && minute <= currentMinute)) {
        // Time has passed today, schedule for tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        const formattedTomorrow = tomorrow.getFullYear() + '-' + 
                                  String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + 
                                  String(tomorrow.getDate()).padStart(2, '0');
        
        result.date = formattedTomorrow;
        result.dateStr = 'מחר';
      } else {
        // Time is later today
        result.dateStr = 'היום';
      }
    }
  }

  // 5. Apply defaults if not specified (Default to Dairy dishwasher and Quick program)
  if (!result.device) {
    result.device = APPLIANCES.DAIRY;
  }
  if (!result.program) {
    result.program = result.isCoffee ? COFFEE_PROGRAMS.Full : PROGRAMS.Quick65;
  }

  return result;
}
