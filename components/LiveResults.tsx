"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PollResultRow } from "@/lib/room";
import { percent, plural } from "@/lib/format";

interface Props {
  pollId: string;
  initialRows: PollResultRow[];
  /** Подписаться на новые голоса (только организатор во время голосования). */
  live?: boolean;
}

export function LiveResults({ pollId, initialRows, live = false }: Props) {
  const [rows, setRows] = useState<PollResultRow[]>(initialRows);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    if (!live) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`results:${pollId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_stats", filter: `poll_id=eq.${pollId}` },
        () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(async () => {
            const { data } = await supabase.rpc("poll_results", { p_poll_id: pollId });
            if (data) setRows(data as PollResultRow[]);
          }, 250);
        },
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [live, pollId]);

  const total = rows[0]?.total_votes ?? 0;
  const voters = rows[0]?.total_voters ?? 0;
  const best = rows.reduce((max, row) => Math.max(max, row.votes), 0);

  return (
    <div className="stack">
      <div className="results" aria-live="polite">
        {rows.map((row) => {
          const share = percent(row.votes, total);
          const width = row.votes > 0 ? Math.max(share, 2) : 0;

          return (
            <div key={row.option_id} className={row.votes === best && best > 0 ? "result result--winner" : "result"}>
              <div className="result__head">
                <span className="result__label">
                  {row.label}
                  {row.is_mine ? (
                    <span className="badge badge--success" style={{ marginLeft: "var(--space-2)", verticalAlign: "middle" }}>
                      ваш выбор
                    </span>
                  ) : null}
                </span>
                <span className="result__value">
                  <b>{row.votes}</b> · {share}%
                </span>
              </div>
              <div className="meter">
                <div className={row.is_mine ? "meter__fill meter__fill--mine" : "meter__fill"} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="small muted" style={{ margin: 0 }}>
        {total === 0
          ? "Пока никто не голосовал."
          : `${total} ${plural(total, ["голос", "голоса", "голосов"])} от ${voters} ${plural(voters, [
              "участника",
              "участников",
              "участников",
            ])}.`}
      </p>
    </div>
  );
}
