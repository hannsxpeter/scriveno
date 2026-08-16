# Voice DNA Guide

Scriveno's core value is simple: **drafted prose sounds like the writer, not like AI.** The Voice DNA system makes this possible by profiling your writing voice across 15+ dimensions and loading that profile into every drafter agent invocation. If voice fidelity breaks, trust breaks, and no other feature matters.

This guide explains how Voice DNA works, what each dimension controls, and how to calibrate your profile.

## What is Voice DNA?

Voice DNA is your writing fingerprint captured in a single file: `STYLE-GUIDE.md`. This file lives in your `.manuscript/` directory and is the single most important artifact in your project.

If you want a concrete proof artifact before reading the full theory, start with `data/proof/voice-dna/README.md`. That bundle compares one fixed brief before and after style-guide guidance is applied.

When the drafter agent writes a scene, chapter, procedure, section, stanza, commentary, or passage, it loads STYLE-GUIDE.md first -- before the outline, before the characters, before anything else. Every sentence it writes gets checked against your voice profile. Does this sentence match the writer's typical sentence length? Does this metaphor, evidence, or image density match their style? Does its dialogue, instruction tone, line rhythm, citation stance, or tradition register match how they write?

STYLE-GUIDE.md profiles your voice across 15+ dimensions organized into 9 parts. The next section walks through each one.

## The Voice Dimensions

### Part 1: Narrative Architecture

This section defines how your story is told at the highest structural level.

**Narrative perspective:**
- **POV** -- First person, close third, distant third, omniscient, or second person
- **POV consistency** -- Single POV throughout, multi-POV by chapter, or shifting within scenes
- **Narrator reliability** -- Reliable, unreliable, or ambiguous
- **Narrator distance** -- Intimate, observational, detached, or cinematic

**Tense:**
- **Primary tense** -- Past, present, or mixed
- **Tense shifts** -- Where and why tense shifts are allowed (e.g., flashbacks in present tense)

**Narrative stance:**
- **Knowing vs. discovering** -- Does the narrator know what's coming, or discover it alongside the reader?
- **Emotional distance** -- Warm or cool, sympathetic or critical or neutral
- **Judgment** -- Moralistic, withholding, ironic, or compassionate

**Example:** Two writers with different narrative architecture settings produce very different openings. A close-third, past-tense, intimate narrator might write: *She pressed her palm against the cold glass and watched the street below empty out.* An omniscient, present-tense, detached narrator might write: *The street empties. In the apartment above the bakery, a woman stands at the window, though she cannot see what is coming.*

### Part 2: Sentence and Paragraph Architecture

This section controls the rhythm and texture of your prose at the sentence and paragraph level.

**Sentence architecture:**
- **Average sentence length** -- A target word count (e.g., 12 words, 22 words)
- **Sentence variation** -- High variation, mostly short, mostly long, or rhythmic alternation
- **Complex structures** -- Preference for embedded clauses, parallel structures, fragments
- **Sentence music** -- Staccato, flowing, punchy, or lyrical

**Paragraph architecture:**
- **Paragraph length** -- Short, medium, long, or variable
- **White space** -- Dense, generous, or rhythmic
- **Paragraph breaks** -- When to break: beat shift, POV shift, emphasis

**Example:** A writer who favors short sentences with staccato music and generous white space:

*He sat down. The chair creaked. Outside, rain.*

A writer who favors long, flowing sentences with dense paragraphs:

*He lowered himself into the chair, which creaked beneath him the way old things do when they remember what they once held, and through the window the rain came down in sheets that blurred the garden into something impressionist and half-remembered.*

### Part 3: Vocabulary and Diction

This section governs word choice and language register.

**Vocabulary:**
- **Register** -- Formal, conversational, lyrical, colloquial, or literary
- **Complexity** -- Accessible, elevated, or specialized
- **Word origin** -- Preference for Anglo-Saxon (gut, blood, dark) vs. Latinate (intestinal, sanguine, tenebrous)
- **Jargon handling** -- How domain-specific terms are introduced and used
- **Profanity** -- None, mild, moderate, explicit, or character-specific

**Example:** An Anglo-Saxon-preferring writer with conversational register: *He walked into the dark room and felt sick.* A Latinate-preferring writer with literary register: *He entered the tenebrous chamber and experienced a wave of nausea.*

### Part 4: Figurative Language

This section controls metaphor, simile, symbolism, and imagery.

- **Metaphor density** -- Sparse, moderate, or dense
- **Metaphor style** -- Grounded/concrete, abstract/philosophical, or sensory
- **Recurring image systems** -- Motifs that should recur throughout the work (e.g., water imagery, mechanical metaphors)
- **Similes** -- Frequency and style preferences
- **Symbolism** -- Overt, buried, or emergent

**Example:** A writer with sparse, grounded metaphors: *The argument sat between them like a third plate at the table.* A writer with dense, abstract metaphors: *Their words were architectures of evasion, each sentence a buttress holding up the cathedral of what they would not say.*

### Part 5: Dialogue

This section defines how characters speak and how dialogue is presented on the page.

- **Dialogue ratio** -- What percentage of text is dialogue
- **Tag style** -- Said-bookish ("said" only), creative tags ("exclaimed," "murmured"), action beats, or minimal (no tags)
- **Subtext level** -- On-the-nose, moderately layered, or heavily subtextual
- **Dialect/accent** -- Phonetic spelling, light suggestion, or none
- **Interrupted speech** -- Frequency and handling (em-dashes, ellipses, trailing off)

**Cast voice differentiation:** Each cast entry should sound distinct. The adapted cast surface holds individual voice anchors -- speech patterns, vocabulary, rhythms, tics.

**Example:** A writer who favors action beats over dialogue tags with heavily subtextual dialogue:

*She set the glass down. "It's fine."*
*He looked at the glass. "Sure."*
*"I said it's fine."*

vs. a writer who uses creative tags with on-the-nose dialogue:

*"I'm upset about what happened," she declared firmly.*
*"I understand completely," he reassured her.*

### Part 6: Description and Sensory Detail

This section controls how the physical world appears in your prose.

**Description density:**
- **Overall density** -- Sparse, moderate, rich, or lush
- **Sense mix** -- Visual-dominant, multi-sensory, or synesthetic
- **Specificity** -- General, specific, or hyper-specific with brand names

**Physicality:**
- **Body awareness** -- How often characters' physical sensations appear
- **Place** -- How strongly setting is felt
- **Time of day/weather** -- How often atmosphere is referenced

**Example:** A sparse, visual-dominant writer: *The room was small and white.* A lush, multi-sensory writer: *The room smelled of camphor and old paper, and the walls had that particular yellow-white of teeth, and somewhere a radiator ticked like a slow clock.*

### Part 7: Pacing and Rhythm

This section governs the speed and flow of narrative.

**Pacing:**
- **Default pace** -- Slow-burn, steady, brisk, or breakneck
- **Pace variation** -- Where and how pace shifts (action scenes speed up, emotional scenes slow down)
- **Scene-to-summary ratio** -- How much is dramatized vs. summarized

**Transitions:**
- **Between scenes** -- Hard cuts, soft fades, or hooks
- **Between chapters** -- Cliffhangers, echoes, or clean breaks
- **Time jumps** -- How they're signaled, how frequent, how handled

### Part 8: Reference Influences

This section captures the authors, works, and passages that anchor your voice.

- **Authors/works to evoke** -- The writers whose style yours echoes or aspires to
- **Reference passages** -- 500-word samples from your own previous work or selected reference authors, used by the drafter as voice anchors

These references give the drafter concrete examples to calibrate against, not to copy but to understand the register you're aiming for.

### Part 9: Always / Never / Consider

This section holds your explicit rules -- the things the drafter should always do, never do, or consider doing.

- **Always** -- Hard rules (e.g., "Always use Oxford commas," "Always ground abstract moments in physical sensation")
- **Never** -- Prohibitions (e.g., "Never use the word 'whilst'," "Never start a chapter with dialogue")
- **Consider** -- Soft guidance (e.g., "Consider using shorter paragraphs in action scenes," "Consider echoing the opening image at chapter ends")

These rules override everything else. If the writer says "never use semicolons," the drafter does not use semicolons, even if a semicolon would be grammatically ideal.

## Setting Up Your Voice Profile

Your STYLE-GUIDE.md starts as a template during project setup, then gets filled in through Voice DNA profiling. There are two main paths:

### Path 1: Interview (recommended)

Run `/scr:profile-writer --questionnaire` (or simply `/scr:profile-writer`) and Scriveno interviews you about your writing preferences. It asks about sentence style, dialogue or interaction preferences, evidence stance, instruction tone, line rhythm, figurative language density, and other dimensions, then writes those decisions into STYLE-GUIDE.md.

### Path 2: Writing sample

Run `/scr:profile-writer --analyze <file>` with a sample of your existing writing (500-1000 words works well) and Scriveno analyzes it to extract your voice profile automatically. This works especially well if you have published work or a manuscript-in-progress that represents the voice you want.

After profiling, run `/scr:voice-test` before drafting. `/scr:discuss` comes later in the workflow and assumes STYLE-GUIDE.md already exists for the unit-planning conversation.

## Calibrating with voice-test

Before drafting your first unit, run:

```
/scr:voice-test
```

This command drafts a short work-type-aware sample using your current STYLE-GUIDE.md profile. You read the sample and tell Scriveno what sounds right and what sounds off. "The dialogue is too formal." "The instructions are too casual." "The sentences are too long." "I would never use that word." Scriveno adjusts your profile based on your feedback.

Think of voice-test as a sound check before a concert. You're making sure the drafter will sound like you before it writes 80,000 words.

After your first draft units are complete, you can also run:

```
/scr:voice-check
```

This compares drafted prose, scripts, procedures, verse, or commentary against your STYLE-GUIDE.md and flags anything that drifted -- sentences that are too long relative to your profile, metaphor density that crept up, dialogue tags that shifted style, instruction tone that got vague, evidence stance that changed, or line rhythm that flattened. For sacred work types, the same `/scr:voice-check` command shifts into a register-check role and verifies voice register consistency.

## Sacred Voice Registers

Sacred and historical work types support 10 specialized voice registers. These go beyond your personal writing voice to capture the distinct tones found in religious and historical literature.

The 10 registers are:

| Register | Character | Example Pattern |
|----------|-----------|-----------------|
| **Prophetic** | Urgent, declarative, oracular | "Thus says the Lord" framing, imperative mood, repetition for emphasis |
| **Wisdom** | Aphoristic, reflective, balanced | Parallelism, "Better X than Y" structures, observational tone |
| **Legal / Halakhic** | Precise, conditional, imperative | Case-law structure, exhaustive enumeration, binding weight |
| **Liturgical** | Formal, rhythmic, responsive | Call-and-response, doxological language, musical awareness |
| **Narrative-historical** | Chronicle-like, temporal, factual | Sequential narration, genealogical asides, minimal editorializing |
| **Apocalyptic** | Visionary, symbolic, cosmic | "I saw..." framing, symbolic numbers, throne-room scenes |
| **Epistolary** | Personal, didactic, pastoral | Greeting formula, practical instruction, closing benediction |
| **Poetic / Psalmic** | Musical, metaphorical, parallelism-heavy | Hebrew parallelism patterns, emotional range, chiastic structures |
| **Parabolic** | Allegorical, story-within-story | "The kingdom of heaven is like..." concrete daily-life imagery |
| **Didactic** | Instructional, systematic, expository | Topic-by-topic structure, teacher-student dynamic, Q&A format |

Each unit's plan file specifies which register to use. Your STYLE-GUIDE.md "Sacred voice registers" part (Part 8 in the shipped template) describes how YOU handle each register -- the drafter always defers to your personalized register style over the generic descriptions.

If no register is specified in a plan file, the drafter defaults to narrative-historical.

For full details on sacred work types, exclusive commands, and tradition-specific configuration, see the Sacred Text Guide.

## How Voice Stays Consistent

Scriveno uses a **fresh-context-per-unit** architecture. Here's how it works:

1. Each atomic unit (scene, passage, verse, beat, procedure, section, stanza, or commentary unit) gets its own fresh drafter agent invocation
2. The drafter loads STYLE-GUIDE.md first -- before anything else
3. The drafter then loads two optional rule layers (see "Three rule layers" below) that scaffold weaker models against AI tells without overriding the writer's voice
4. The drafter also receives the last 200 words of the previous unit for continuity
5. The drafter writes the unit, checking every sentence against your voice profile
6. After drafting, a voice-check pass flags any drift

Why fresh context? Because AI agents accumulate context over a conversation, and accumulated context causes voice drift. After 10,000 words of continuous generation, the AI starts sounding like itself instead of like you. By giving each unit a clean slate with STYLE-GUIDE.md loaded fresh, Scriveno keeps every unit at peak voice fidelity.

This is the same principle behind recording each instrument separately in a studio -- isolation gives you control.

### Three rule layers

Starting in `1.6.0`, Scriveno loads three rule layers in this order on every drafter invocation:

1. **STYLE-GUIDE.md** (sovereign): your Voice DNA. Always loaded; nothing overrides it.
2. **WRITING-RULES.md** (universal, optional): human-first restraint, variance over substitution, factual integrity, soft-inference discipline, register awareness, detector-aware authenticity, sourced stance, artifact cleanup, and canonical AI-tell don'ts. It tells the drafter to avoid hedging, throat-clearing, balanced-both-sides constructions, generic metaphors, symmetrical rhythm, moralizing closings, AI tics in dialogue, invented support, truncated beats, copied chat residue, over-polishing human texture, and replacing one machine signature with a new humanizer signature. Loaded if the file is present in `.manuscript/` or the installed templates.
3. **Pitfall pack** (type-specific, optional): traps unique to your `work_type`. Filter words for prose, unfilmable description for screenplays, missing-precondition checks for runbooks, anachronism for sacred commentary, and so on. Loaded from `.manuscript/PITFALLS.md` if you've authored a project-local override, otherwise from the installed `templates/pitfalls/<work_type>.md`.

Conflict resolution is top-down: STYLE-GUIDE.md beats WRITING-RULES.md beats the pitfall pack. If your voice in STYLE-GUIDE.md says you hedge, fragment, moralize, use formal register, or keep period diction deliberately, that voice wins. The rule layers are scaffolding, not constraints.

Three knobs in `.manuscript/config.json` tune the system:

- `draft.rigor`: `standard` (defaults) or `strict` (per-sentence rules check; useful when routing to a weaker model)
- `draft.context_profile`: `minimal`, `standard`, or `full` (controls how much context the drafter loads per unit; `minimal` saves tokens on weaker models)
- `draft.pitfalls_enabled`: `true` (default) or `false` (skip the pitfall pack when the writer's voice deliberately leans into a trap)

The same rule layer also has a diagnostic side. When you ask "is this AI" or "does this still sound like me," `/scr:voice-check` and `/scr:originality-check` read the rules from the other side: they report an authenticity band (Reads human / Mixed signals / Reads AI-generated) first, then a 0-100 score, then flagged spans with reasons, and they never rewrite. They match scrutiny to evidence (low density biases hard toward a high score, because over-flagging genuine human prose is the worst error here), credit strong false positives as score-raising human markers, and always name what they deliberately did not flag. If you bring an outside detector report, they record it as context only and include process evidence such as plans, drafts, reviews, HISTORY.log, saves, and accepted revisions. Fixing flagged prose is a separate step (`/scr:line-edit`, `/scr:polish`, or a re-draft) you choose, after which the check re-runs as a fresh read. Diagnosis and rewriting stay apart on purpose, with you between them.

See [docs/drafter-quality.md](drafter-quality.md) for the full system, including model-tier recommendations. See [Authenticity And AI Detectors](authenticity-and-detectors.md) for the external-detector policy.

## Evaluation Harness

Scriveno now ships a small deterministic Voice DNA replay harness:

- [data/proof/voice-dna/eval-fixtures.json](../data/proof/voice-dna/eval-fixtures.json) defines paired sample checks for the watchmaker proof bundle.
- [lib/voice-dna-eval.js](../lib/voice-dna-eval.js) counts expected voice markers and forbidden generic patterns.
- [test/proof-replay.test.js](../test/proof-replay.test.js) verifies that the guided sample passes and the unguided baseline fails for the intended reasons.

This is not a fake objective prose score. It is a regression guard for Scriveno's most important claim: style guidance should move output toward the writer's specific voice rather than toward polished generic prose.

## Troubleshooting

### Voice drift

**Symptom:** Later units sound different from earlier ones.
**Fix:** Run `/scr:voice-check` to identify specific dimensions that drifted. Update STYLE-GUIDE.md if your preferences have evolved, or flag the drifted units for redraft.

### Too formal / too stiff

**Symptom:** Prose sounds like an essay or press release instead of a story.
**Fix:** Check your register setting in STYLE-GUIDE.md Part 3 (Vocabulary). If it's set to "formal" or "literary," try "conversational." Also check sentence length -- longer average sentences tend to read more formally.

### Too informal / too loose

**Symptom:** Prose sounds like a blog post or chat message.
**Fix:** Increase register complexity, lengthen average sentence length, or add "Consider" rules like "Consider varying sentence openings" to add structural sophistication.

### Characters sound the same

**Symptom:** All dialogue sounds like it comes from the same person.
**Fix:** Check CHARACTERS.md -- each character needs distinct voice anchors (vocabulary, sentence patterns, speech tics). The drafter uses these to differentiate character speech from narrative voice.

### Too many metaphors / not enough metaphors

**Symptom:** Prose is either overwritten or too bare.
**Fix:** Adjust metaphor density in STYLE-GUIDE.md Part 3 (vocabulary and figurative language). "Sparse" means one metaphor per page at most. "Dense" means multiple per paragraph. Find your natural density by looking at your existing writing.

### AI-sounding hedging

**Symptom:** Phrases like "perhaps," "it could be argued," "in a sense" appearing in drafted prose.
**Fix:** Two complementary remedies. (1) Add to your "Never" list: "Never use hedging language (perhaps, it could be argued, in a sense, to some degree)." The drafter respects Never rules absolutely. (2) Confirm `WRITING-RULES.md` is present in `.manuscript/`; its "Hedging and qualifiers" subsection is loaded by the drafter and voice-checker as the canonical AI-tell list. If voice-check reports keep flagging hedges, set `draft.rigor` to `strict` in `config.json` to enforce per-sentence checks.

### Is this draft AI, or does it still sound like me?

**Symptom:** You want an honest read of how authentically a draft reads as your own work, or which spans sound machine-written.
**Fix:** Run `/scr:voice-check` (with STYLE-GUIDE.md present it measures deviation from your voice) or `/scr:originality-check`. You get a band, a 0-100 score, flagged spans with reasons, and a "Reads as human" section naming what was deliberately not flagged. If you have an outside detector report, include the detector name, score, date, scope, and highlighted spans so Scriveno can triage without obeying the score. These commands diagnose only; they never rewrite and never carry a target score into a fix. If you want flagged prose improved, run `/scr:line-edit` or `/scr:polish`, then re-run the check as a fresh re-verify. This is an honest read, not a detector-beating tool, and it names no detector.

## See Also

- [Proof Artifacts](proof-artifacts.md) -- inspect the Voice DNA before/after bundle first if you want the fastest concrete evidence
- [Getting Started](getting-started.md) -- Install Scriveno and write your first draft
- [Drafter Quality](drafter-quality.md) -- the three rule layers, the `draft` config block, and model-tier recommendations
- [Authenticity And AI Detectors](authenticity-and-detectors.md) -- external detector scores, process evidence, and detector-aware authenticity
- [Proof Badges](proof-badges.md) -- evidence levels for major product claims
- [Command Reference](command-reference.md) -- Full list of all 127 commands with usage and examples
- [Work Types Guide](work-types.md) -- How work types adapt Scriveno's vocabulary and commands
