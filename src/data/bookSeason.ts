// Seasonal flavour for the book club (M7). A tiny, pure helper that maps a date to a
// season so the Library can show a small seasonal sign — cheap "the room changes through
// the year" polish with no art pipeline. (Named bookSeason to avoid the inherited
// season.ts, which is Isotopia's unrelated academic-season RTDB epoch.)
//
// Northern-hemisphere, meteorological seasons by month (the club is in Maine).

export interface BookSeason { name: string; emoji: string; blurb: string; }

const SEASONS: Record<string, BookSeason> = {
    winter: { name: 'Winter', emoji: '❄️', blurb: 'Cozy up with a long read.' },
    spring: { name: 'Spring', emoji: '🌱', blurb: 'New chapters are sprouting.' },
    summer: { name: 'Summer', emoji: '☀️', blurb: 'Beach reads welcome.' },
    autumn: { name: 'Autumn', emoji: '🍂', blurb: 'Leaves fall, pages turn.' },
};

// Dec-Feb winter, Mar-May spring, Jun-Aug summer, Sep-Nov autumn.
export function currentSeason(date: Date = new Date()): BookSeason {
    const m = date.getMonth(); // 0-11
    if (m === 11 || m <= 1) return SEASONS.winter;
    if (m <= 4) return SEASONS.spring;
    if (m <= 7) return SEASONS.summer;
    return SEASONS.autumn;
}
