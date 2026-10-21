package com.rakubo.probe;

import android.app.Activity;
import android.app.Instrumentation;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.Trace;
import android.text.TextUtils;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.accessibility.AccessibilityNodeInfo;
import android.app.UiAutomation;
import android.content.Intent;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

public final class TransitionProbe extends Instrumentation {
    private static final String TARGET_PACKAGE = "com.rakubo.app.debug";
    private static final int COLOR_TOLERANCE = 32;
    private static final double REQUIRED_MATCH_RATIO = 0.97;
    private static final int SAMPLE_STEP = 8;
    private static final int MIN_DISTINCT_SAMPLES = 128;
    private static final long HOME_TIMEOUT_MS = 120_000L;
    private static final long DESTINATION_TIMEOUT_MS = 15_000L;
    private static final String[] ROUTES = {"home", "history", "shifts", "planned"};
    private static final String[] TAB_DESCRIPTIONS = {
            "🏠, ホーム", "📋, 履歴", "📅, シフト", "📆, 支出予定"
    };
    private static final String[] HEADINGS = {
            "らく〜ぼ", "支出履歴", "シフト・収入見込み", "支出予定"
    };

    private UiAutomation automation;
    private Activity targetActivity;
    private Bundle instrumentationArgs;
    private int screenWidth;
    private int screenHeight;
    private int repeats = 7;
    private int settleMs = 500;
    private String phase = "startup";
    private int completedTransitions;
    private final Point[] tabPoints = new Point[ROUTES.length];

    @Override
    public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        instrumentationArgs = arguments;
        start();
    }

    @Override
    public void callActivityOnResume(Activity activity) {
        super.callActivityOnResume(activity);
        // Expo's launcher can replace the original Activity before the React screen opens.
        if (TARGET_PACKAGE.equals(activity.getPackageName())) targetActivity = activity;
    }

    @Override
    public void onStart() {
        super.onStart();
        Bundle result = new Bundle();
        try {
            configure();
            selfCheckMatcher();
            selfCheckTimingBounds();
            automation = getUiAutomation();
            runProbe();
            result.putString("stream", "TRANSITION_PROBE_SUMMARY {\"status\":\"ok\",\"repeats\":" + repeats
                    + ",\"transitions\":" + completedTransitions + ",\"settleMs\":" + settleMs
                    + ",\"warmOnly\":true,\"observer\":\"native-onDraw-then-screenshot\""
                    + ",\"instrumentationMayRestartTargetProcess\":true}");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable failure) {
            String message = failure.getMessage();
            String safeMessage = message == null ? "" : message.replace('"', '\'').replace('\n', ' ');
            result.putString("stream", "TRANSITION_PROBE_ERROR {\"phase\":\"" + phase + "\",\"type\":\""
                    + failure.getClass().getSimpleName() + "\",\"message\":\"" + safeMessage + "\"}");
            sendStatus(2, result);
            finish(Activity.RESULT_CANCELED, result);
        }
    }

    private void configure() {
        Bundle args = instrumentationArgs;
        if (args == null) return;
        repeats = integerArg(args, "repeats", repeats, 1, 50);
        settleMs = integerArg(args, "settleMs", settleMs, 0, 5000);
    }

    private int integerArg(Bundle args, String key, int fallback, int min, int max) {
        String raw = args.getString(key);
        if (raw == null) return fallback;
        int value;
        try {
            value = Integer.parseInt(raw);
        } catch (NumberFormatException error) {
            throw new IllegalArgumentException("Invalid -e " + key + " value");
        }
        if (value < min || value > max) throw new IllegalArgumentException("-e " + key + " must be in [" + min + "," + max + "]");
        return value;
    }

    private void runProbe() {
        phase = "launch";
        launchTarget();
        readScreenSize();
        waitForHeading(0, HOME_TIMEOUT_MS);
        SystemClock.sleep(700L);
        findTabPoints();

        Bitmap[] references = new Bitmap[ROUTES.length];
        phase = "warm-references";
        references[0] = automation.takeScreenshot();
        if (references[0] == null) throw new IllegalStateException("Could not capture Home reference");
        ensureScreenSize(references[0]);
        for (int route = 1; route < ROUTES.length; route++) {
            navigateAndCaptureReference(route, references);
        }
        navigateAndCaptureReference(0, references);

        PixelMask[] masks = new PixelMask[ROUTES.length];
        for (int route = 0; route < ROUTES.length; route++) {
            int destination = (route + 1) % ROUTES.length;
            masks[route] = buildMask(references[route], references[destination]);
            validateDiscrimination(masks[route], references[route], references[destination], route, destination);
        }

        phase = "timed-transitions";
        for (int cycle = 1; cycle <= repeats; cycle++) {
            for (int source = 0; source < ROUTES.length; source++) {
                int destination = (source + 1) % ROUTES.length;
                measureTransition(cycle, source, destination, masks[source], references[source]);
                completedTransitions++;
                if (settleMs > 0) SystemClock.sleep(settleMs);
            }
        }

        for (Bitmap reference : references) if (reference != null && !reference.isRecycled()) reference.recycle();
    }

    private void launchTarget() {
        Intent launch = getTargetContext().getPackageManager().getLaunchIntentForPackage(TARGET_PACKAGE);
        if (launch == null) throw new IllegalStateException("Target launch activity not found: " + TARGET_PACKAGE);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        targetActivity = startActivitySync(launch);
        if (targetActivity == null) throw new IllegalStateException("Target activity did not start");
    }

    private void waitForHeading(int route, long timeoutMs) {
        long deadline = SystemClock.elapsedRealtime() + timeoutMs;
        boolean openedLocalServer = false;
        while (SystemClock.elapsedRealtime() < deadline) {
            if (hasHeading(route)) return;
            if (!openedLocalServer && handleLocalDevServer()) {
                openedLocalServer = true;
                SystemClock.sleep(250L);
                continue;
            }
            SystemClock.sleep(250L);
        }
        throw new IllegalStateException("Timed out waiting for " + ROUTES[route] + " heading");
    }

    private boolean hasHeading(final int route) {
        AccessibilityNodeInfo root = automation.getRootInActiveWindow();
        if (root == null) return false;
        try {
            return visit(root, new NodeVisitor() {
                @Override
                public boolean visit(AccessibilityNodeInfo node) {
                    String text = node.getText() == null ? null : node.getText().toString();
                    String description = node.getContentDescription() == null ? null : node.getContentDescription().toString();
                    if (!HEADINGS[route].equals(text) && !HEADINGS[route].equals(description)) return false;
                    Rect bounds = new Rect();
                    node.getBoundsInScreen(bounds);
                    return bounds.top >= 0 && bounds.top < screenHeight * 0.25f;
                }
            });
        } finally {
            root.recycle();
        }
    }

    private boolean handleLocalDevServer() {
        AccessibilityNodeInfo root = automation.getRootInActiveWindow();
        if (root == null) return false;
        final Point[] serverPoint = new Point[1];
        try {
            visit(root, new NodeVisitor() {
                @Override
                public boolean visit(AccessibilityNodeInfo node) {
                    CharSequence rawText = node.getText();
                    CharSequence rawDescription = node.getContentDescription();
                    boolean localServer = isLocalServerUrl(rawText) || isLocalServerUrl(rawDescription);
                    if (!localServer) return false;
                    Rect bounds = new Rect();
                    node.getBoundsInScreen(bounds);
                    if (bounds.isEmpty() || bounds.left < 0 || bounds.top < 0
                            || bounds.right > screenWidth || bounds.bottom > screenHeight) return false;
                    serverPoint[0] = new Point(bounds.centerX(), bounds.centerY());
                    return true;
                }
            });
        } finally {
            root.recycle();
        }
        if (serverPoint[0] == null) return false;
        tap(serverPoint[0]);
        return true;
    }

    private boolean isLocalServerUrl(CharSequence value) {
        if (value == null) return false;
        String text = value.toString().trim();
        return "http://localhost:8081".equals(text) || "http://127.0.0.1:8081".equals(text);
    }

    private void readScreenSize() {
        Bitmap screenshot = automation.takeScreenshot();
        if (screenshot == null) throw new IllegalStateException("Could not capture initial screen");
        screenWidth = screenshot.getWidth();
        screenHeight = screenshot.getHeight();
        screenshot.recycle();
        if (screenWidth <= 0 || screenHeight <= 0) throw new IllegalStateException("Invalid display size");
    }

    private void findTabPoints() {
        AccessibilityNodeInfo root = automation.getRootInActiveWindow();
        if (root == null) throw new IllegalStateException("No active accessibility window on Home");
        final boolean[] found = new boolean[ROUTES.length];
        try {
            visit(root, new NodeVisitor() {
                @Override
                public boolean visit(AccessibilityNodeInfo node) {
                    CharSequence raw = node.getContentDescription();
                    if (raw == null || !node.isClickable()) return false;
                    String description = raw.toString();
                    for (int i = 0; i < TAB_DESCRIPTIONS.length; i++) {
                        if (!found[i] && TAB_DESCRIPTIONS[i].equals(description)) {
                            Rect bounds = new Rect();
                            node.getBoundsInScreen(bounds);
                            if (bounds.centerY() < screenHeight * 0.70f || bounds.isEmpty()) {
                                throw new IllegalStateException("Tab accessibility node is outside the bottom tab bar: " + ROUTES[i]);
                            }
                            tabPoints[i] = new Point(bounds.centerX(), bounds.centerY());
                            found[i] = true;
                        }
                    }
                    return false;
                }
            });
        } finally {
            root.recycle();
        }
        for (int i = 0; i < found.length; i++) {
            if (!found[i]) throw new IllegalStateException("Missing exact clickable tab content description: " + ROUTES[i]);
            for (int j = i + 1; j < found.length; j++) {
                if (tabPoints[i].x == tabPoints[j].x && tabPoints[i].y == tabPoints[j].y) {
                    throw new IllegalStateException("Tab accessibility bounds overlap: " + ROUTES[i] + " and " + ROUTES[j]);
                }
            }
        }
    }

    private void navigateAndCaptureReference(int destination, Bitmap[] references) {
        tap(tabPoints[destination]);
        waitForHeading(destination, DESTINATION_TIMEOUT_MS);
        SystemClock.sleep(700L);
        Bitmap screenshot = automation.takeScreenshot();
        if (screenshot == null) throw new IllegalStateException("Could not capture " + ROUTES[destination] + " reference");
        ensureScreenSize(screenshot);
        if (references[destination] != null) references[destination].recycle();
        references[destination] = screenshot;
    }

    private void ensureScreenSize(Bitmap bitmap) {
        if (bitmap.getWidth() != screenWidth || bitmap.getHeight() != screenHeight) {
            throw new IllegalStateException("Display size changed during reference capture");
        }
    }

    private void measureTransition(int cycle, int source, int destination, PixelMask mask, Bitmap sourceReference) {
        phase = "before-" + ROUTES[source] + "-to-" + ROUTES[destination];
        waitForHeading(source, DESTINATION_TIMEOUT_MS);
        Bitmap before = automation.takeScreenshot();
        if (before == null) throw new IllegalStateException("Could not verify source screen");
        double sourceRatio = mask.matchSource(before);
        before.recycle();
        if (sourceRatio < REQUIRED_MATCH_RATIO) {
            throw new IllegalStateException("Source screen did not match its stable reference for "
                    + ROUTES[source] + " (ratio=" + decimal(sourceRatio) + ")");
        }
        double targetOnSource = mask.matchTarget(sourceReference);
        if (targetOnSource >= REQUIRED_MATCH_RATIO) throw new IllegalStateException("Target reference is not distinct for " + ROUTES[destination]);

        final DrawWaiter drawWaiter = installHeadingDrawListener(destination);
        long tapStart = 0L;
        long drawElapsedNanos = 0L;
        long lastNonmatchingCaptureStart = 0L;
        double lastRatio = 0.0;
        int attempts = 0;
        ArrayList<Double> captureMs = new ArrayList<Double>();
        ArrayList<Double> captureStartMs = new ArrayList<Double>();
        ArrayList<Double> captureEndMs = new ArrayList<Double>();
        long matchCaptureEnd = -1L;
        double matchRatio = 0.0;
        long lowerNs = 0L;
        long upperNs = 0L;
        double drawMs = 0.0;
        boolean listenerRemoved = false;

        Trace.beginSection("TransitionProbe:" + ROUTES[source] + "->" + ROUTES[destination] + "#" + cycle);
        try {
            tapStart = SystemClock.elapsedRealtimeNanos();
            drawWaiter.tapStartNanos.set(tapStart);
            tap(tabPoints[destination]);
            long deadline = SystemClock.elapsedRealtimeNanos() + DESTINATION_TIMEOUT_MS * 1_000_000L;
            long remainingNanos = Math.max(0L, deadline - SystemClock.elapsedRealtimeNanos());
            boolean sawDestinationDraw;
            try {
                sawDestinationDraw = drawWaiter.drawLatch.await(remainingNanos, TimeUnit.NANOSECONDS);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while waiting for destination draw", error);
            }
            if (!sawDestinationDraw) {
                throw new IllegalStateException("Destination heading OnDraw timeout for " + ROUTES[destination]);
            }
            drawElapsedNanos = drawWaiter.drawElapsedNanos.get();
            if (drawElapsedNanos < tapStart) {
                throw new IllegalStateException("Destination heading draw preceded tap for " + ROUTES[destination]);
            }
            drawMs = toMs(drawElapsedNanos - tapStart);
            removeHeadingDrawListener(drawWaiter);
            listenerRemoved = true;

            lastNonmatchingCaptureStart = tapStart;
            while (SystemClock.elapsedRealtimeNanos() < deadline) {
                long captureStart = SystemClock.elapsedRealtimeNanos();
                Bitmap screenshot = automation.takeScreenshot();
                long captureEnd = SystemClock.elapsedRealtimeNanos();
                if (screenshot == null) throw new IllegalStateException("Screenshot capture failed during " + ROUTES[source] + " to " + ROUTES[destination]);
                ensureScreenSize(screenshot);
                double ratio = mask.matchTarget(screenshot);
                screenshot.recycle();
                attempts++;
                captureMs.add(toMs(captureEnd - captureStart));
                captureStartMs.add(toMs(captureStart - tapStart));
                captureEndMs.add(toMs(captureEnd - tapStart));
                lastRatio = ratio;
                if (ratio >= REQUIRED_MATCH_RATIO) {
                    matchCaptureEnd = captureEnd;
                    matchRatio = ratio;
                    break;
                }
                lastNonmatchingCaptureStart = captureStart;
                if (SystemClock.elapsedRealtimeNanos() < deadline) SystemClock.sleep(100L);
            }

            if (matchCaptureEnd < 0L) {
                throw new IllegalStateException("Destination screenshot verification timeout for " + ROUTES[source] + " to "
                        + ROUTES[destination] + " after " + attempts + " captures (last ratio=" + decimal(lastRatio) + ")");
            }

            lowerNs = lowerBoundNanos(tapStart, drawElapsedNanos, lastNonmatchingCaptureStart);
            upperNs = Math.max(0L, matchCaptureEnd - tapStart);
        } finally {
            try {
                if (!listenerRemoved) removeHeadingDrawListener(drawWaiter);
            } finally {
                Trace.endSection();
            }
        }

        emitTransition(cycle, source, destination, lowerNs, upperNs, captureMs, captureStartMs,
                captureEndMs, matchRatio, attempts, sourceRatio, mask.samples.size(), drawMs);
    }

    private DrawWaiter installHeadingDrawListener(final int destination) {
        final DrawWaiter waiter = new DrawWaiter();
        runOnMainSync(new Runnable() {
            @Override
            public void run() {
                if (targetActivity == null || targetActivity.getWindow() == null) {
                    throw new IllegalStateException("Target Activity window is unavailable");
                }
                waiter.decor = targetActivity.getWindow().getDecorView();
                waiter.observer = waiter.decor.getViewTreeObserver();
                if (!waiter.observer.isAlive()) throw new IllegalStateException("Target Activity view tree is not alive");
                waiter.listener = new ViewTreeObserver.OnDrawListener() {
                    private final Rect visibleBounds = new Rect();
                    private final int[] screenLocation = new int[2];

                    @Override
                    public void onDraw() {
                        if (waiter.drawElapsedNanos.get() != 0L || waiter.tapStartNanos.get() == 0L) return;
                        if (containsVisibleHeading(waiter.decor, HEADINGS[destination], visibleBounds, screenLocation)) {
                            long observedAt = SystemClock.elapsedRealtimeNanos();
                            if (observedAt >= waiter.tapStartNanos.get()
                                    && waiter.drawElapsedNanos.compareAndSet(0L, observedAt)) {
                                waiter.drawLatch.countDown();
                            }
                        }
                    }
                };
                waiter.observer.addOnDrawListener(waiter.listener);
            }
        });
        return waiter;
    }

    private boolean containsVisibleHeading(View view, String expected, Rect visibleBounds, int[] screenLocation) {
        if (view.getVisibility() != View.VISIBLE || !view.isShown() || view.getAlpha() <= 0.0f
                || view.getWidth() <= 0 || view.getHeight() <= 0) return false;
        if (view instanceof TextView && TextUtils.equals(expected, ((TextView) view).getText())) {
            view.getLocationOnScreen(screenLocation);
            return screenLocation[1] >= 0 && screenLocation[1] < screenHeight * 0.25f
                    && view.getGlobalVisibleRect(visibleBounds) && visibleBounds.top < screenHeight * 0.25f;
        }
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                if (containsVisibleHeading(group.getChildAt(i), expected, visibleBounds, screenLocation)) return true;
            }
        }
        return false;
    }

    private void removeHeadingDrawListener(final DrawWaiter waiter) {
        if (waiter == null || waiter.listener == null || waiter.decor == null) return;
        runOnMainSync(new Runnable() {
            @Override
            public void run() {
                ViewTreeObserver observer = waiter.decor.getViewTreeObserver();
                if (waiter.observer.isAlive()) {
                    waiter.observer.removeOnDrawListener(waiter.listener);
                } else if (observer.isAlive()) {
                    observer.removeOnDrawListener(waiter.listener);
                }
            }
        });
    }

    private void tap(Point point) {
        long downTime = SystemClock.uptimeMillis();
        MotionEvent down = MotionEvent.obtain(downTime, downTime, MotionEvent.ACTION_DOWN, point.x, point.y, 0);
        down.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        boolean downInjected;
        try {
            downInjected = automation.injectInputEvent(down, true);
        } finally {
            down.recycle();
        }
        if (!downInjected) throw new IllegalStateException("Could not inject touch DOWN");
        SystemClock.sleep(20L);
        long upTime = SystemClock.uptimeMillis();
        MotionEvent up = MotionEvent.obtain(downTime, upTime, MotionEvent.ACTION_UP, point.x, point.y, 0);
        up.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        boolean upInjected;
        try {
            upInjected = automation.injectInputEvent(up, true);
        } finally {
            up.recycle();
        }
        if (!upInjected) throw new IllegalStateException("Could not inject touch UP");
    }

    private PixelMask buildMask(Bitmap source, Bitmap destination) {
        ensureScreenSize(source);
        ensureScreenSize(destination);
        int top = statusBarHeight() + 2;
        int bottom = Math.round(screenHeight * 0.78f);
        int left = Math.round(screenWidth * 0.04f);
        int right = Math.round(screenWidth * 0.96f);
        ArrayList<PixelSample> samples = new ArrayList<PixelSample>();
        for (int y = top; y < bottom; y += SAMPLE_STEP) {
            for (int x = left; x < right; x += SAMPLE_STEP) {
                int sourceColor = source.getPixel(x, y);
                int targetColor = destination.getPixel(x, y);
                if (differs(sourceColor, targetColor, COLOR_TOLERANCE)) {
                    samples.add(new PixelSample(x, y, sourceColor, targetColor));
                }
            }
        }
        if (samples.size() < MIN_DISTINCT_SAMPLES) {
            throw new IllegalStateException("Reference pair has too few distinct pixels: " + samples.size());
        }
        return new PixelMask(samples);
    }

    private void validateDiscrimination(PixelMask mask, Bitmap source, Bitmap destination, int sourceRoute, int destinationRoute) {
        double sourceRatio = mask.matchSource(source);
        double targetRatio = mask.matchTarget(destination);
        double sourceAsTarget = mask.matchTarget(source);
        if (sourceRatio < REQUIRED_MATCH_RATIO || targetRatio < REQUIRED_MATCH_RATIO || sourceAsTarget >= REQUIRED_MATCH_RATIO) {
            throw new IllegalStateException("Reference mask failed discrimination for " + ROUTES[sourceRoute] + " to "
                    + ROUTES[destinationRoute] + " (source=" + decimal(sourceRatio) + ", target="
                    + decimal(targetRatio) + ", sourceAsTarget=" + decimal(sourceAsTarget) + ")");
        }
    }

    private int statusBarHeight() {
        int id = getTargetContext().getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (id == 0) return Math.round(screenHeight * 0.04f);
        return getTargetContext().getResources().getDimensionPixelSize(id);
    }

    private static boolean differs(int a, int b, int tolerance) {
        return Math.abs(((a >> 16) & 0xff) - ((b >> 16) & 0xff)) > tolerance
                || Math.abs(((a >> 8) & 0xff) - ((b >> 8) & 0xff)) > tolerance
                || Math.abs((a & 0xff) - (b & 0xff)) > tolerance;
    }

    private static boolean matchesColor(int actual, int expected, int tolerance) {
        return Math.abs(((actual >> 16) & 0xff) - ((expected >> 16) & 0xff)) <= tolerance
                && Math.abs(((actual >> 8) & 0xff) - ((expected >> 8) & 0xff)) <= tolerance
                && Math.abs((actual & 0xff) - (expected & 0xff)) <= tolerance;
    }

    private void selfCheckMatcher() {
        int[] source = {0xff000000, 0xff101010, 0xff202020, 0xff303030};
        int[] target = {0xffffffff, 0xffeeeeee, 0xffdddddd, 0xffcccccc};
        int[] modified = {0xffeeeeee, 0xffdddddd, 0xffcccccc, 0xff000000};
        ArrayList<PixelSample> samples = new ArrayList<PixelSample>();
        for (int i = 0; i < source.length; i++) {
            if (differs(source[i], target[i], COLOR_TOLERANCE)) samples.add(new PixelSample(i, 0, source[i], target[i]));
        }
        if (samples.size() < 3) throw new IllegalStateException("Synthetic mask was not discriminatory");
        PixelMask mask = new PixelMask(samples);
        if (mask.matchSource(source) < 1.0 || mask.matchTarget(target) < 1.0 || mask.matchTarget(source) >= 0.97
                || mask.matchTarget(modified) >= 0.97) {
            throw new IllegalStateException("Synthetic matcher self-check failed");
        }
    }

    private static long lowerBoundNanos(long tapStart, long destinationDraw, long lastNonmatchingCaptureStart) {
        return Math.max(0L, Math.max(destinationDraw, lastNonmatchingCaptureStart) - tapStart);
    }

    private void selfCheckTimingBounds() {
        long tapStart = 1_000_000L;
        long drawAt = 1_040_000L;
        long lastNonmatchAt = 1_060_000L;
        long upperAt = 1_090_000L;
        long lower = lowerBoundNanos(tapStart, drawAt, lastNonmatchAt);
        if (lower != 60_000L || lower < drawAt - tapStart || lower > upperAt - tapStart) {
            throw new IllegalStateException("Synthetic timing-bound self-check failed");
        }
        long noScreenshotMismatchLower = lowerBoundNanos(tapStart, drawAt, tapStart);
        if (noScreenshotMismatchLower != drawAt - tapStart || noScreenshotMismatchLower > upperAt - tapStart) {
            throw new IllegalStateException("Synthetic timing-bound draw-floor self-check failed");
        }
    }

    private void emitTransition(int cycle, int source, int destination, long lowerNs, long upperNs,
            List<Double> captureMs, List<Double> starts, List<Double> ends, double matchRatio,
            int attempts, double sourceRatio, int maskSamples, double drawMs) {
        StringBuilder json = new StringBuilder(256 + attempts * 24);
        json.append("{\"warmOnly\":true,\"observer\":\"native-onDraw-then-screenshot\",\"cycle\":").append(cycle)
                .append(",\"route\":\"").append(ROUTES[source]).append("->").append(ROUTES[destination]).append('\"')
                .append(",\"drawMs\":").append(decimal(drawMs))
                .append(",\"lowerMs\":").append(decimal(toMs(lowerNs)))
                .append(",\"upperMs\":").append(decimal(toMs(upperNs)))
                .append(",\"captureMs\":");
        appendNumbers(json, captureMs);
        json.append(",\"captureWindowsMs\":[");
        for (int i = 0; i < starts.size(); i++) {
            if (i > 0) json.append(',');
            json.append('[').append(decimal(starts.get(i))).append(',').append(decimal(ends.get(i))).append(']');
        }
        json.append("],\"matchRatio\":").append(decimal(matchRatio))
                .append(",\"sourceRatio\":").append(decimal(sourceRatio))
                .append(",\"maskSamples\":").append(maskSamples)
                .append(",\"screenshotCount\":").append(attempts).append('}');
        Bundle status = new Bundle();
        status.putString("stream", "TRANSITION_PROBE " + json);
        sendStatus(0, status);
    }

    private void appendNumbers(StringBuilder out, List<Double> values) {
        out.append('[');
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) out.append(',');
            out.append(decimal(values.get(i)));
        }
        out.append(']');
    }

    private static double toMs(long nanos) {
        return nanos / 1_000_000.0;
    }

    private static String decimal(double value) {
        return String.format(Locale.US, "%.3f", value);
    }

    private boolean visit(AccessibilityNodeInfo node, NodeVisitor visitor) {
        if (visitor.visit(node)) return true;
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child == null) continue;
            boolean found;
            try {
                found = visit(child, visitor);
            } finally {
                child.recycle();
            }
            if (found) return true;
        }
        return false;
    }

    private interface NodeVisitor {
        boolean visit(AccessibilityNodeInfo node);
    }

    private static final class Point {
        final int x;
        final int y;
        Point(int x, int y) { this.x = x; this.y = y; }
    }

    private static final class PixelSample {
        final int x;
        final int y;
        final int source;
        final int target;
        PixelSample(int x, int y, int source, int target) {
            this.x = x;
            this.y = y;
            this.source = source;
            this.target = target;
        }
    }

    private static final class PixelMask {
        final List<PixelSample> samples;
        PixelMask(List<PixelSample> samples) { this.samples = samples; }

        double matchSource(Bitmap bitmap) {
            int matched = 0;
            for (PixelSample sample : samples) if (matchesColor(bitmap.getPixel(sample.x, sample.y), sample.source, COLOR_TOLERANCE)) matched++;
            return matched / (double) samples.size();
        }

        double matchTarget(Bitmap bitmap) {
            int matched = 0;
            for (PixelSample sample : samples) if (matchesColor(bitmap.getPixel(sample.x, sample.y), sample.target, COLOR_TOLERANCE)) matched++;
            return matched / (double) samples.size();
        }

        double matchSource(int[] pixels) {
            int matched = 0;
            for (int i = 0; i < samples.size(); i++) if (matchesColor(pixels[i], samples.get(i).source, COLOR_TOLERANCE)) matched++;
            return matched / (double) samples.size();
        }

        double matchTarget(int[] pixels) {
            int matched = 0;
            for (int i = 0; i < samples.size(); i++) if (matchesColor(pixels[i], samples.get(i).target, COLOR_TOLERANCE)) matched++;
            return matched / (double) samples.size();
        }
    }

    private static final class DrawWaiter {
        final CountDownLatch drawLatch = new CountDownLatch(1);
        final AtomicLong tapStartNanos = new AtomicLong(0L);
        final AtomicLong drawElapsedNanos = new AtomicLong(0L);
        View decor;
        ViewTreeObserver observer;
        ViewTreeObserver.OnDrawListener listener;
    }
}
