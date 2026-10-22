# Rest audio and quick preparation verification

## Confirmed findings in the previous release

- `RestChime.play()` returned `false` immediately whenever its AudioContext was
  suspended or interrupted. It never attempted foreground recovery. The previous
  unit test explicitly expected this silent result after suspension.
- `Test sound` displayed “Sound played” as soon as nodes were scheduled. That
  did not establish that the audio clock advanced, that a speaker received the
  signal, or that the person heard it.
- Audio used local oscillators, not a downloaded sound file. There was no sound
  asset loading, decoding, cache or network request to fail in that path.
- The rest deadline was already timestamp based and the audio hook lived above
  tab navigation. Neither timer drift nor changing tabs was a confirmed cause.

These are confirmed code findings. They do **not** identify the exact hardware,
Silent mode, Bluetooth or operating-system condition on the reporting iPhone.

## Changes

The foreground audio engine primes from a real tap, requests a short notification audio
session where supported (with a playback fallback), and attempts bounded recovery of suspended/interrupted
contexts. A cached local double-beep uses the same playback path for Test sound
and rest completion. Volume is adjustable; the iPhone's output volume still
applies. Cancellation invalidates pending recovery so an old timer cannot ring
later. Overdue background timers update silently when the app returns.

Test sound asks whether both beeps were heard. A successful browser request is
not described as verified audibility. Failure/no-sound guidance covers media
volume, connected output, Silent mode compatibility, reopening the app, and the
reported audio-engine state. Unsupported audio-session APIs are optional.

Quick preparation shows a small, workout-specific selection on one screen, with
one-line cues and optional details. Mark warm-up complete checks that selection;
Already warmed up records a separate acknowledgment. Start workout is available
without completing a checklist. Full saved preparation and custom instructions
remain available. Unchecked preparation is never recorded as completed.

## Exact physical-iPhone check (still required)

This cloud environment cannot test the phone's physical speakers or iOS Safari
hardware routing. Automated Chromium tests and rendered audio samples cannot
replace these steps:

1. Open the installed Setline PWA. Go to You → Settings → Rest timer, or Train →
   Session tools → Rest timer → Timer sound.
2. Enable Timer sounds, set alert volume to about 85%, and tap Test sound. Raise
   iPhone **media** volume during playback. Confirm that both beeps are audible.
   Tap Heard it only if you actually hear them. Otherwise tap No sound and follow
   the displayed checks; note the Audio check values and your iOS version.
3. Close Settings. In Train → Session tools → Rest timer choose 60s, start rest,
   then tap −15 three times for a 15-second countdown. Keep Setline visible and
   verify one double-beep at zero plus the Rest complete state.
4. Start another short rest, change between Today, Train and Progress, and verify
   one alert. Start again and Skip rest; verify no alert at the old deadline.
5. Turn Timer sounds off and repeat: the timer must finish visually and silently.
6. Restore sound. During a longer rest, switch away and return **before** zero;
   verify the real remaining time and foreground alert. Return **after** zero;
   verify completion without a stale surprise alarm.
7. Repeat Test sound and a short rest inside Safari. Record any difference from
   the installed PWA. Test your usual headphones separately if you use them.

Locked-phone/background sound is not guaranteed by this PWA. If the foreground
check still fails, report whether Test sound or only timed completion is silent,
the iOS version, installed-PWA versus Safari, and the displayed Audio check state.
No microphone recording or external diagnostic upload is used.

## Browser API evidence

Official MDN reference content was read during this task:

- https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/audiocontext/resume/index.md — suspended audio clocks require resumption; automatic recovery can still be refused by a browser.
- https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/audiosession/type/index.md — transient audio suits short notifications; exclusive playback can interrupt another player. Setline requests transient where supported, falls back to playback, and restores the previous hint after the alert. Silent gesture priming does not change another media session.

Automated tests include a real running AudioContext and an AnalyserNode detecting
nonzero output samples from the actual alert path. This establishes rendered
browser output, **not** that a physical iPhone speaker was heard.
