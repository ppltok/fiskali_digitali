'use client';

const STARTERS = [
  {
    q: 'כמה תקציב קיבל משרד החינוך ב-2025, ואיך זה השתנה בחמש השנים האחרונות?',
    tag: 'מגמה',
  },
  {
    q: 'מהן עשר העמותות שקיבלו את התמיכות הגבוהות ביותר מהמדינה ב-2024?',
    tag: 'תמיכות',
  },
  {
    q: 'איך מתחלקות הכנסות המדינה ב-2025 בין מסים ישירים, עקיפים ואחרים?',
    tag: 'הכנסות',
  },
  {
    q: 'מי הספקים הגדולים ביותר של משרד הביטחון בהתקשרויות רכש?',
    tag: 'התקשרויות',
  },
  {
    q: 'כמה מתקציב 2024 בוצע בפועל לעומת מה שתוכנן?',
    tag: 'ביצוע',
  },
  {
    q: 'איזה חלק מהתקציב הולך להחזר חובות וריבית?',
    tag: 'חוב',
  },
];

export default function StarterQuestions({
  onSelect,
}: {
  onSelect: (question: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {STARTERS.map((starter, i) => (
        <button
          key={starter.q}
          onClick={() => onSelect(starter.q)}
          className="rise-in group relative overflow-hidden rounded-xl border border-hairline bg-surface p-4 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_8px_30px_-12px_rgba(12,107,90,0.35)]"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <span className="mb-2 inline-block rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-strong">
            {starter.tag}
          </span>
          <p className="text-sm leading-relaxed text-ink-soft transition-colors group-hover:text-ink">
            {starter.q}
          </p>
          <span
            aria-hidden
            className="absolute bottom-0 start-0 h-0.5 w-0 bg-accent transition-all duration-300 group-hover:w-full"
          />
        </button>
      ))}
    </div>
  );
}
