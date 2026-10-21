# Native transition probe

This standalone Android Instrumentation APK measures tab taps inside the Android process. It installs a native `ViewTreeObserver.OnDrawListener` before injecting a 20 ms touch with `UiAutomation`, then waits on a latch for the exact destination header to be drawn. It takes no screenshots while waiting for that draw. Afterward it verifies destination pixels with the reference mask, retrying screenshots at 100 ms intervals if needed. No host ADB or UiAutomator polling occurs during a timed transition.

Build with `pwsh -NoProfile -File .\build.ps1`. The signed APK is written to the ignored `build/` directory. It targets the installed `com.rakubo.app.debug` package and uses the same local debug keystore as the app.

After the probe APK is installed, run it with:

```powershell
adb shell am instrument -w -r -e repeats 7 -e settleMs 500 com.rakubo.probe/.TransitionProbe
```

It opens the app through its launcher intent, waits up to 120 seconds for Home, follows only the four tab buttons, and reads only accessibility labels and screenshots. It does not create, edit, delete, or submit records and does not log or save screenshot pixels. Android may restart the target process when instrumentation attaches; persisted app state is outside the probe's control.

The probe warms and captures one reference per tab, then measures seven Home → History → Shifts → Planned → Home cycles by default. Results are warm-route measurements; cold first-tab timings are excluded. `-e repeats N` changes the number of cycles and `-e settleMs N` changes the quiet time between completed taps. Each row reports tap-to-painted lower and upper bounds, all screenshot capture durations and offsets, the match ratio, and capture count. A timeout or non-discriminatory reference mask fails the run instead of producing a timing value.

Each row includes the destination heading's first `OnDraw` time as `drawMs`; `lowerMs` is at least that draw time and advances to the start of the last nonmatching screenshot when later pixel confirmation is needed. `upperMs` is the end of the first matching screenshot, relative to the injected DOWN event. Capture durations and windows show the confirmation overhead. These are draw and paint observation bounds, not exact display-present timestamps; compare runs with the same device, probe, and capture settings.

The destination mask samples the pixels that differ between the source and destination references, above the tab bar and below the status bar, and requires 97% agreement within RGB tolerance 32. It does not prove that every pixel, animation, or background request has finished. Warm routes can still trigger the app's normal 30-second cache refresh. A changing source (including a development error banner) fails validation; do not lower the threshold or include the partial run in a comparison.

Check for exactly one `TRANSITION_PROBE_SUMMARY` with `status: "ok"`; `adb` can return exit code zero even when instrumentation reports a failure. Aggregate successful runs only:

```powershell
node summarize.cjs --self-check
node summarize.cjs --before before.txt --after after.txt --after after-repeat.txt --before before-repeat.txt
```

The summary includes all validated timing rows and median observation intervals. The reduction interval covers observation delay only; it is not a statistical confidence interval. Positive reduction values mean faster. For the collected comparison and environment limitations, see [the measurement report](../../../docs/performance-transition-2026-10-21.md).

`node summarize-profile.cjs profile.json` aggregates the Hermes `Tracing` export's complete `ProfileChunk` data into fixed function names and timing totals. It combines every call site, deduplicates recursive occurrences within an inclusive stack, validates sample/delta lengths and parent chains, and exports no URLs or app records. `node summarize-profile.cjs --self-check` checks known sample durations and recursive stack deduplication. Keep the raw profile outside Git because it can contain private source paths and URLs.
