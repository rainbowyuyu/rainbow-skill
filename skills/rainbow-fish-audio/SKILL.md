---
name: rainbow-fish-audio
description: Archived Fish Audio workflow. Disabled globally by the user on 2026-10-28; use the original personal TTS workflow in D:/projects/tts instead. Historical evidence only unless the user explicitly reverses this preference.
---

# Fish Audio author narration

## Current routing: disabled by the user, 2026-10-28

Do not generate Fish TTS, create Fish voices, use the website route or fall back to Fish in any Codex task. The user restored the original personal-voice TTS pipeline in `D:/projects/tts`. Read its `RAINBOW_AUDIO_WORKFLOW.md` and `BROADCAST_NARRATION.md`; use actual local Qwen3-TTS entry points and the original author reference. Rebuild video/subtitle/action timing from that audio. The global client enforces `usage-policy.json` before speech or voice-creation calls. The remaining content below is archived documentation and evidence, not active authorization. Only a new explicit user instruction can reverse this setting.

Read `C:/Users/USER/.codex/tools/fish-audio/README.md` and `config.json` before use. The reusable client is `fish_audio.py`; do not recreate authentication or guess endpoints. The configured TTS is `s2.1-pro`; ASR is `transcribe-1-pro`. Verify the current official schema when changing capabilities.

## Credentials and author voice

In the same PowerShell invocation as each client launch, dot-source `C:/Users/USER/.codex/tools/fish-audio/Load-FishAudio.ps1`. It reads the current user's DPAPI-protected key and loads it in the process. Never put keys in arguments, code, prompts, logs or replies.

The existing original author sample is `D:/projects/tts/work/clone-reference.wav`; its matching transcript and source cuts are in `clone-reference.json`. Use this only for an authorized own-voice task. Check sample/transcript agreement and preserve originals. Do not use previously synthesized narration as if it were the original speaker.

A private voice ID may be stored in global config only after a verified successful private creation. On 2026-10-27 the authenticated Fish website successfully created the private author voice **rainbow鱼 · 科普讲解**, ID `7ae2ad1d7b3747c0b88a3a9ac434fdd8`, from the existing original author reference. The private badge and Use voice link were verified, and this ID is recorded in global config. Reuse it instead of creating another clone.

Website membership and API credit are separate. During this task the website showed active Plus, 250,000/250,000 platform credits and 10 private voice slots before production; API credit was 0. API creation returned HTTP 403 and the `s2.1-pro` API reference pilot returned HTTP 402 for insufficient credit, producing no speech. The first opening narration `s01-b01` was subsequently generated through the website using the private author voice, S2.1 Pro and 1× speed. Both completed candidates were downloaded; the first is about 16.405 seconds and its saved SHA256 matches the generation manifest. This verifies first-shot website generation and download, not full-film completion, subjective voice quality or API production success. These are dated observations, not permanent account limitations.

The official inline-reference method uses MessagePack and reference WAV plus transcript. Use the client's validated reference method when appropriate. Do not substitute a public voice or silently downgrade to a free model. If API credit is unavailable, check whether the user's existing website membership supports the requested task; lack of API credit does not block an already authorized website generation. Do not purchase credit or change subscription settings automatically.

Dated production update, 2026-10-28: Chapter6 world-model V10 now has71/71 downloaded, fully decoded and locally aligned website sources, and a40793-frame measured timeline. The previously unknown s08-b05 submission remains preserved; a separate explicitly authorized single retry supplied its completed source. This establishes website source/timing completion only, not final-film rendering, subjective listening, pronunciation or API synthesis success. API production has not succeeded; API credit and Plus platform credits remain separate. The250000 platform-credit observation was before production, not a current remaining balance. See the global README production-progress section for project evidence; do not carry the earlier70/71 blocker forward as current state.

Later on2026-10-28, the production lead read227946/250000 remaining Plus platform credits and next billing date2026-11-27 from the authenticated website billing page. API balance was not rechecked. Treat both website and historical API balances as dated observations, not guarantees for a later task.

## Browser-backed generation

Use Ego for the authenticated website route. Read `C:/Users/USER/.agents/skills/ego-browser/SKILL.md` and the complete current `ego-browser skill` guide. Reuse a single goal TaskSpace and its existing pages. The full UI workflow is in the global Fish README under Browser-backed generation. Open the known private voice, verify identity/privacy and chosen S2.1 Pro model, submit complete-shot text via visible controls, retain visible job/history evidence, then download and validate completed audio. Preserve original downloads. An uncertain submission is checked in visible history, not repeated.

Never extract session credentials, cookies, hidden endpoints or page tokens to manufacture an unofficial API route. Do not alter user sign-in state. Browser success and API success must be reported separately; no API top-up is required merely to use available Plus website credits.

## Produce continuous narration

Use one complete semantic shot per TTS unit, with stable shot ID, display text and spoken text. Preserve raw WAV. Start with an actual production opening and one technical-term segment; inspect complete output, pronunciation, tone and voice similarity before expanding. Keep mixed-language language override unset unless there is a tested reason. Do not invent provider emotional tokens or phoneme tags.

Use at most2–3 concurrent requests, hash each input/result and retain the provider task/request records. Explicit429 refusals may follow the bounded client policy. A timeout or unknown result requires reconciliation; do not blindly resubmit or remove duplicate-prevention journals.

After a verified account change and user-authorized retry, the client's offline `reconcile-rejected` command can archive an explicit 402/403 refusal and prepare a separately launched attempt. Read the README recovery section; never use it while funding/model choice is pending, or for an unknown/completed request. Preserve the archive and audit.

## Timing and quality

Rebuild timing from the new source waveform and measured transcript. Keep the full original waveform; add small front protection and about0.67seconds after the last voiced sound. Padding does not repair missing words. Re-record the complete semantic shot if source speech is truncated.

Map display captions, animation cues and mouth amplitude from the actual source. If ASR offers only coarse segments, label interpolation honestly; do not call it phoneme/word alignment. Verify English terms, homophones, endpoints and representative transitions. Do not label RMS mouth movement as phonetic lip sync.

Preserve user-selected BGM, duck smoothly around speech, and measure the final encoded soundtrack. For these video projects target roughly-14LUFS and no more than-1dBTP; do not pitch/time-stretch the author's voice to hit old durations.

Store task media in its project or designated cache, keep prior finished versions, and distinguish actual listening from ASR/content checks in the report. Installing this skill does not replace other established TTS workflows for unrelated work.
