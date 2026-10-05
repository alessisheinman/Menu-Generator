import { formatHeader, printableLines } from '../model/format';
import type { MenuEvent } from '../model/types';

/** On-screen replica of the Word output: one US Letter page per meal. */
export function Preview({ event, activeMealId }: { event: MenuEvent; activeMealId?: string }) {
  const pages = event.days.flatMap((day) => day.meals.map((meal) => ({ day, meal })));
  if (pages.length === 0) return <p className="empty">Add a day and a meal to see the preview.</p>;
  return (
    <div className="pages">
      {pages.map(({ day, meal }) => (
        <article key={meal.id} id={`page-${meal.id}`} className={`page ${meal.id === activeMealId ? 'active' : ''}`}>
          <div className="page-inner">
            {formatHeader(day.label, event.venueLabel, meal).filter(Boolean).map((l, i) => <p key={i} className="red">{l}</p>)}
            <p>&nbsp;</p>
            {printableLines(meal).map((l, i) => <p key={i}>{l}</p>)}
          </div>
        </article>
      ))}
    </div>
  );
}
