import React, { useMemo, useState } from 'react';

// Renders attendance rate-by-day as a register-book style grid:
// rows = weekdays (Mon-Fri), columns = weeks. Each cell is colored by
// that day's overall attendance rate, with a mono numeral on hover.
export default function Ledger({ data }) {
  const [hover, setHover] = useState(null);

  const { weeks, weekdayLabels } = useMemo(() => {
    const byDate = new Map(data.map((d) => [d.date, d.rate]));
    if (data.length === 0) return { weeks: [], weekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] };

    const first = new Date(data[0].date);
    const last = new Date(data[data.length - 1].date);

    // align to the Monday on/before the first date
    const start = new Date(first);
    const dow = start.getDay();
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    start.setDate(start.getDate() + diffToMonday);

    const weeksArr = [];
    let cursor = new Date(start);
    while (cursor <= last) {
      const week = [];
      for (let i = 0; i < 5; i++) {
        const dateStr = cursor.toISOString().slice(0, 10);
        week.push({ date: dateStr, rate: byDate.has(dateStr) ? byDate.get(dateStr) : null });
        cursor.setDate(cursor.getDate() + 1);
      }
      cursor.setDate(cursor.getDate() + 2); // skip weekend
      weeksArr.push(week);
    }
    return { weeks: weeksArr, weekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] };
  }, [data]);

  function levelFor(rate) {
    if (rate === null || rate === undefined) return 'empty';
    if (rate >= 90) return 'l3';
    if (rate >= 75) return 'l2';
    if (rate >= 60) return 'l1';
    return 'l0';
  }

  if (weeks.length === 0) {
    return <div className="empty-state">No attendance sessions recorded yet.</div>;
  }

  return (
    <div className="ledger-wrap">
      <div className="ledger-rows">
        {weekdayLabels.map((label, rowIdx) => (
          <div className="ledger-row" key={label}>
            <div className="ledger-row-label">{label}</div>
            <div className="ledger-cells">
              {weeks.map((week, colIdx) => {
                const cell = week[rowIdx];
                const level = levelFor(cell.rate);
                return (
                  <div
                    key={colIdx}
                    className={`ledger-cell-grid l-${level}`}
                    onMouseEnter={() => setHover(cell)}
                    onMouseLeave={() => setHover(null)}
                    title={cell.rate !== null ? `${cell.date}: ${cell.rate}%` : `${cell.date}: no session`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="ledger-footer">
        <div className="ledger-hover">
          {hover
            ? hover.rate !== null
              ? <span><strong className="mono">{hover.rate}%</strong> attendance on {hover.date}</span>
              : <span>No session on {hover.date}</span>
            : <span>Hover a cell to see the day's attendance rate</span>}
        </div>
        <div className="ledger-legend">
          <span>Low</span>
          <div className="legend-cell l-l0" />
          <div className="legend-cell l-l1" />
          <div className="legend-cell l-l2" />
          <div className="legend-cell l-l3" />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
