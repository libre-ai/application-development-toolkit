export interface JournalNote {
  readonly id: number;
  readonly text: string;
  readonly createdAt: string;
}

export interface Journal {
  readonly notes: readonly JournalNote[];
}

export type RefusalCode = "starter.note_invalid";

export type Outcome<T> = { ok: true; value: T } | { ok: false; refusal: RefusalCode };

const ISO_8601_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function isValidTimestamp(timestamp: string): boolean {
  if (!ISO_8601_UTC_PATTERN.test(timestamp)) {
    return false;
  }

  try {
    const date = new Date(timestamp);
    // Check if the date is valid by ensuring it's a real date
    // (Invalid dates parse but getTime() returns NaN)
    if (Number.isNaN(date.getTime())) {
      return false;
    }
    // Verify that when we construct a date from this string and convert back to ISO,
    // the date components are still valid (e.g., reject 2026-13-45)
    const isoString = date.toISOString();
    // Match the year-month-day-hour-minute-second parts only, ignoring milliseconds
    const inputMatch = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/);
    const isoMatch = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d{3}Z$/);
    if (!inputMatch || !isoMatch) {
      return false;
    }
    // Check that all date/time components match
    for (let i = 1; i <= 6; i++) {
      if (inputMatch[i] !== isoMatch[i]) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function createJournal(): Journal {
  const journal: Journal = {
    notes: Object.freeze([]),
  };
  return Object.freeze(journal);
}

export function addNote(journal: Journal, text: string, createdAt: string): Outcome<Journal> {
  // Validate text: not empty/whitespace, and <= 2000 chars
  if (!text.trim() || text.length > 2000) {
    return {
      ok: false,
      refusal: "starter.note_invalid",
    };
  }

  // Validate timestamp: ISO-8601 UTC seconds format (YYYY-MM-DDTHH:mm:ssZ)
  if (!isValidTimestamp(createdAt)) {
    return {
      ok: false,
      refusal: "starter.note_invalid",
    };
  }

  // Calculate next ID: max ID + 1, or 1 if empty
  const maxId = journal.notes.length > 0 ? Math.max(...journal.notes.map((n) => n.id)) : 0;
  const nextId = maxId + 1;

  const newNote: JournalNote = Object.freeze({
    id: nextId,
    text,
    createdAt,
  });

  const updatedNotes = Object.freeze([...journal.notes, newNote]);
  const updatedJournal = Object.freeze({
    notes: updatedNotes,
  });

  return {
    ok: true,
    value: updatedJournal,
  };
}

export function listNotes(journal: Journal): readonly JournalNote[] {
  // Return notes in newest-first order (by id, since ids increment)
  const sorted = [...journal.notes].sort((a, b) => b.id - a.id);
  return Object.freeze(sorted);
}
