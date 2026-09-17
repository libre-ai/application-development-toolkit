import { describe, expect, it } from "bun:test";
import { addNote, createJournal, type Journal, listNotes, type Outcome } from "./journal";

describe("Journal domain", () => {
  describe("createJournal", () => {
    it("creates an empty frozen journal", () => {
      const journal = createJournal();
      expect(journal.notes).toHaveLength(0);
      expect(Object.isFrozen(journal)).toBe(true);
      expect(Object.isFrozen(journal.notes)).toBe(true);
    });
  });

  describe("addNote", () => {
    it("adds a valid note to the journal", () => {
      const journal = createJournal();
      const result = addNote(journal, "Hello world", "2026-07-22T10:30:45Z");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.notes).toHaveLength(1);
        expect(result.value.notes[0]).toMatchObject({
          id: 1,
          text: "Hello world",
          createdAt: "2026-07-22T10:30:45Z",
        });
      }
    });

    it("increments note ids deterministically", () => {
      const journal = createJournal();
      const result1 = addNote(journal, "First", "2026-07-22T10:30:45Z");
      expect(result1.ok).toBe(true);

      if (result1.ok) {
        const result2 = addNote(result1.value, "Second", "2026-07-22T10:31:00Z");
        expect(result2.ok).toBe(true);

        if (result2.ok) {
          expect(result2.value.notes.length).toBe(2);
          expect(result2.value.notes[1]?.id).toBe(2);
        }
      }
    });

    it("refuses empty text", () => {
      const journal = createJournal();
      const result = addNote(journal, "", "2026-07-22T10:30:45Z");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal).toBe("starter.note_invalid");
      }
    });

    it("refuses whitespace-only text", () => {
      const journal = createJournal();
      const result = addNote(journal, "   \t\n  ", "2026-07-22T10:30:45Z");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal).toBe("starter.note_invalid");
      }
    });

    it("refuses text longer than 2000 characters", () => {
      const journal = createJournal();
      const longText = "a".repeat(2001);
      const result = addNote(journal, longText, "2026-07-22T10:30:45Z");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal).toBe("starter.note_invalid");
      }
    });

    it("accepts text exactly 2000 characters", () => {
      const journal = createJournal();
      const text2000 = "a".repeat(2000);
      const result = addNote(journal, text2000, "2026-07-22T10:30:45Z");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.notes.length).toBe(1);
        expect(result.value.notes[0]?.text).toHaveLength(2000);
      }
    });

    it("refuses invalid ISO-8601 timestamps", () => {
      const journal = createJournal();
      const invalidTimestamps = [
        "2026-07-22T10:30:45", // missing Z
        "2026/07/22 10:30:45Z", // wrong format
        "2026-07-22", // date only
        "10:30:45Z", // time only
        "2026-07-22T10:30:45+00:00", // UTC offset (not Z)
        "invalid",
        "",
      ];

      for (const ts of invalidTimestamps) {
        const result = addNote(journal, "test", ts);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.refusal).toBe("starter.note_invalid");
        }
      }
    });

    it("accepts valid ISO-8601 UTC timestamps with Z", () => {
      const journal = createJournal();
      const validTimestamps = [
        "2026-01-01T00:00:00Z",
        "2026-12-31T23:59:59Z",
        "2026-07-22T10:30:45Z",
      ];

      let currentJournal = journal;
      for (const ts of validTimestamps) {
        const result = addNote(currentJournal, "test", ts);
        expect(result.ok).toBe(true);
        if (result.ok) {
          currentJournal = result.value;
        }
      }
    });

    it("never mutates the input journal", () => {
      const journal = createJournal();
      const originalLength = journal.notes.length;

      const result = addNote(journal, "test note", "2026-07-22T10:30:45Z");

      expect(journal.notes).toHaveLength(originalLength);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toBe(journal);
        expect(result.value.notes).not.toBe(journal.notes);
      }
    });

    it("returns frozen result journal", () => {
      const journal = createJournal();
      const result = addNote(journal, "test", "2026-07-22T10:30:45Z");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Object.isFrozen(result.value)).toBe(true);
        expect(Object.isFrozen(result.value.notes)).toBe(true);
      }
    });
  });

  describe("listNotes", () => {
    it("returns empty list for empty journal", () => {
      const journal = createJournal();
      const notes = listNotes(journal);

      expect(notes).toHaveLength(0);
    });

    it("returns notes in newest-first order", () => {
      let journal = createJournal();

      const result1 = addNote(journal, "First", "2026-07-22T10:00:00Z");
      expect(result1.ok).toBe(true);
      if (!result1.ok) return;
      journal = result1.value;

      const result2 = addNote(journal, "Second", "2026-07-22T11:00:00Z");
      expect(result2.ok).toBe(true);
      if (!result2.ok) return;
      journal = result2.value;

      const result3 = addNote(journal, "Third", "2026-07-22T09:00:00Z");
      expect(result3.ok).toBe(true);
      if (!result3.ok) return;
      journal = result3.value;

      const notes = listNotes(journal);
      expect(notes).toHaveLength(3);
      expect(notes[0]?.id).toBe(3);
      expect(notes[1]?.id).toBe(2);
      expect(notes[2]?.id).toBe(1);
    });

    it("returns readonly notes array", () => {
      const journal = createJournal();
      const result = addNote(journal, "test", "2026-07-22T10:30:45Z");

      if (result.ok) {
        const notes = listNotes(result.value);
        expect(Object.isFrozen(notes)).toBe(true);
      }
    });
  });

  describe("Outcome type", () => {
    it("distinguishes success from failure", () => {
      const journal = createJournal();

      const success: Outcome<Journal> = addNote(journal, "valid", "2026-07-22T10:30:45Z");
      const failure: Outcome<Journal> = addNote(journal, "", "2026-07-22T10:30:45Z");

      expect(success.ok).toBe(true);
      expect(failure.ok).toBe(false);
    });
  });
});
