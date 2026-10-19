---
name: meeting-notes-to-recap
description: Use this skill when the client shares raw meeting notes, a transcript, or a voice-memo dump and wants a clean recap. Triggers on requests like "summarize this meeting," "turn these notes into a recap," "what were the action items," or when a transcript file is dropped into the project folder.
---

# Meeting Notes → Client Recap

Turn messy meeting notes or transcripts into a short, professional recap the client can send to attendees or file for their records.

## Steps

1. Read the full notes/transcript provided. If a file path is given, read that file directly rather than asking the client to paste it in.
2. Identify: attendees (if named), key decisions made, open questions, and action items with owners (if stated).
3. Produce a recap with this structure:
   - **Meeting:** [inferred title/topic] — [date if known]
   - **Attendees:** [list, or "not specified"]
   - **Summary:** 2–4 sentences on what was discussed and decided
   - **Action items:** bullet list, each with an owner if one is stated, otherwise mark "unassigned"
   - **Open questions:** bullet list, omit section if none
4. Keep the recap under 300 words. Do not editorialize or add opinions not present in the source notes.
5. If the client's context file specifies a tone or format preference, follow it here too.
6. Offer to save the recap into the project's Outputs folder as a `.md` file, or paste it inline if no folder is connected.

## Notes

- If the notes are too sparse to identify action items, say so plainly rather than inventing them.
- If multiple meetings are in one file, ask the client to confirm before splitting into multiple recaps.
